-- Shop system schema + transactional functions
-- Run this file in Supabase SQL Editor before using /shop routes.

create extension if not exists pgcrypto;

alter table public.students
  add column if not exists coin_balance integer not null default 0;

create table if not exists public.shop_boxes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  coin_cost integer not null check (coin_cost >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code in ('bronze', 'silver', 'gold', 'diamond'))
);

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.shop_boxes(id) on delete cascade,
  name text not null,
  base_probability_percent numeric(8, 4),
  is_rare boolean not null default false,
  reward_coin_delta integer not null default 0,
  reward_coin_multiplier numeric(10, 4) not null default 1.0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (box_id, name),
  check (reward_coin_multiplier > 0)
);

create table if not exists public.box_inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.shop_products(id) on delete cascade,
  initial_quantity integer not null check (initial_quantity >= 0),
  remaining_quantity integer not null check (remaining_quantity >= 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.draw_logs (
  id bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  student_name_snapshot text not null,
  student_phone_snapshot text not null,
  box_code text not null,
  product_id uuid references public.shop_products(id) on delete set null,
  product_name text not null,
  product_base_probability_percent numeric(8, 4),
  is_rare boolean not null default false,
  inventory_before integer not null,
  inventory_after integer not null,
  coin_before integer not null,
  coin_after integer not null,
  actor_role text not null check (actor_role in ('student', 'admin', 'system')),
  actor_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.coin_ledger (
  id bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'score_auto_reward',
      'admin_adjustment',
      'draw_result',
      'manual_credit',
      'manual_debit'
    )
  ),
  reason text not null,
  delta integer not null,
  coin_before integer not null,
  coin_after integer not null check (coin_after >= 0),
  related_box_code text,
  related_product_id uuid references public.shop_products(id) on delete set null,
  related_product_name text,
  draw_log_id bigint references public.draw_logs(id) on delete set null,
  actor_role text not null check (actor_role in ('student', 'admin', 'system')),
  actor_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_action_logs (
  id bigserial primary key,
  admin_id uuid references public.students(id) on delete set null,
  action_type text not null,
  target_student_id uuid references public.students(id) on delete set null,
  target_product_id uuid references public.shop_products(id) on delete set null,
  target_box_code text,
  reason text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_score_records (
  id bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  season text not null,
  round integer not null check (round >= 1 and round <= 100),
  score numeric(8, 2),
  source_key text,
  recorded_by uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, season, round)
);

create unique index if not exists exam_score_records_source_key_uniq
  on public.exam_score_records (source_key)
  where source_key is not null;

create index if not exists idx_shop_products_box_id on public.shop_products (box_id);
create index if not exists idx_draw_logs_created_at on public.draw_logs (created_at desc);
create index if not exists idx_draw_logs_student_id on public.draw_logs (student_id, created_at desc);
create index if not exists idx_coin_ledger_student_id on public.coin_ledger (student_id, created_at desc);
create index if not exists idx_admin_action_logs_created_at on public.admin_action_logs (created_at desc);
create index if not exists idx_admin_action_logs_target_student_id on public.admin_action_logs (target_student_id, created_at desc);

create or replace function public.shop_draw_box(
  p_student_id uuid,
  p_box_code text,
  p_actor_role text default 'student',
  p_actor_id uuid default null
)
returns table (
  ok boolean,
  message text,
  draw_log_id bigint,
  box_code text,
  product_name text,
  coin_before integer,
  coin_after integer,
  remaining_quantity integer,
  is_rare boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_box public.shop_boxes%rowtype;
  v_student record;
  v_total_weight numeric(18, 6);
  v_pick numeric(18, 6);
  v_selected record;
  v_inventory_before integer;
  v_inventory_after integer;
  v_coin_before integer;
  v_coin_after integer;
  v_draw_id bigint;
  v_delta integer;
  v_reason text;
  v_reward_delta integer := 0;
  v_reward_multiplier numeric(10, 4) := 1.0;
begin
  select *
  into v_box
  from public.shop_boxes
  where code = lower(trim(p_box_code))
    and is_active = true
  for update;

  if not found then
    return query select false, '상자를 찾을 수 없습니다.', null::bigint, lower(trim(p_box_code)), null::text, null::integer, null::integer, null::integer, false;
    return;
  end if;

  select id, name, phone, coin_balance
  into v_student
  from public.students
  where id = p_student_id
  for update;

  if not found then
    return query select false, '학생 정보를 찾을 수 없습니다.', null::bigint, v_box.code, null::text, null::integer, null::integer, null::integer, false;
    return;
  end if;

  v_coin_before := coalesce(v_student.coin_balance, 0);
  if v_coin_before < v_box.coin_cost then
    return query select false, '코인이 부족합니다.', null::bigint, v_box.code, null::text, v_coin_before, v_coin_before, null::integer, false;
    return;
  end if;

  with candidates as (
    select
      p.id as product_id,
      p.name as product_name,
      p.base_probability_percent,
      p.is_rare,
      p.reward_coin_delta,
      p.reward_coin_multiplier,
      i.remaining_quantity,
      i.remaining_quantity::numeric as weight,
      p.created_at,
      p.id as order_id
    from public.shop_products p
    join public.box_inventory i on i.product_id = p.id
    where p.box_id = v_box.id
      and p.is_active = true
      and i.remaining_quantity > 0
    order by p.created_at asc, p.id asc
    for update of i
  )
  select coalesce(sum(weight), 0)
  into v_total_weight
  from candidates;

  if v_total_weight <= 0 then
    return query select false, '남은 상품이 없습니다.', null::bigint, v_box.code, null::text, v_coin_before, v_coin_before, null::integer, false;
    return;
  end if;

  v_pick := random() * v_total_weight;

  with candidates as (
    select
      p.id as product_id,
      p.name as product_name,
      p.base_probability_percent,
      p.is_rare,
      p.reward_coin_delta,
      p.reward_coin_multiplier,
      i.remaining_quantity,
      i.remaining_quantity::numeric as weight,
      p.created_at,
      p.id as order_id
    from public.shop_products p
    join public.box_inventory i on i.product_id = p.id
    where p.box_id = v_box.id
      and p.is_active = true
      and i.remaining_quantity > 0
    order by p.created_at asc, p.id asc
    for update of i
  ),
  ranked as (
    select
      c.*,
      sum(c.weight) over (order by c.created_at asc, c.order_id asc) as cumulative_weight
    from candidates c
  )
  select *
  into v_selected
  from ranked
  where cumulative_weight >= v_pick
  order by cumulative_weight asc
  limit 1;

  if not found then
    with candidates as (
      select
        p.id as product_id,
        p.name as product_name,
        p.base_probability_percent,
        p.is_rare,
        p.reward_coin_delta,
        p.reward_coin_multiplier,
        i.remaining_quantity,
        i.remaining_quantity::numeric as weight,
        p.created_at,
        p.id as order_id
      from public.shop_products p
      join public.box_inventory i on i.product_id = p.id
      where p.box_id = v_box.id
        and p.is_active = true
        and i.remaining_quantity > 0
      order by p.created_at asc, p.id asc
      for update of i
    ),
    ranked as (
      select
        c.*,
        sum(c.weight) over (order by c.created_at asc, c.order_id asc) as cumulative_weight
      from candidates c
    )
    select *
    into v_selected
    from ranked
    order by cumulative_weight desc
    limit 1;
  end if;

  update public.box_inventory as bi
  set
    remaining_quantity = remaining_quantity - 1,
    updated_at = now()
  where bi.product_id = v_selected.product_id
    and bi.remaining_quantity > 0
  returning bi.remaining_quantity + 1, bi.remaining_quantity
  into v_inventory_before, v_inventory_after;

  if v_inventory_before is null then
    return query select false, '재고 반영 중 충돌이 발생했습니다. 다시 시도해 주세요.', null::bigint, v_box.code, null::text, v_coin_before, v_coin_before, null::integer, false;
    return;
  end if;

  v_reward_delta := coalesce(v_selected.reward_coin_delta, 0);
  v_reward_multiplier := greatest(coalesce(v_selected.reward_coin_multiplier, 1.0), 0.0001);

  v_coin_after := v_coin_before - v_box.coin_cost;
  v_coin_after := floor(v_coin_after * v_reward_multiplier) + v_reward_delta;
  if v_coin_after < 0 then
    v_coin_after := 0;
  end if;

  update public.students
  set
    coin_balance = v_coin_after,
    updated_at = now()
  where id = p_student_id;

  insert into public.draw_logs (
    student_id,
    student_name_snapshot,
    student_phone_snapshot,
    box_code,
    product_id,
    product_name,
    product_base_probability_percent,
    is_rare,
    inventory_before,
    inventory_after,
    coin_before,
    coin_after,
    actor_role,
    actor_id,
    created_at
  )
  values (
    p_student_id,
    coalesce(v_student.name, ''),
    coalesce(v_student.phone, ''),
    v_box.code,
    v_selected.product_id,
    v_selected.product_name,
    v_selected.base_probability_percent,
    coalesce(v_selected.is_rare, false),
    v_inventory_before,
    v_inventory_after,
    v_coin_before,
    v_coin_after,
    case when p_actor_role in ('student', 'admin', 'system') then p_actor_role else 'student' end,
    p_actor_id,
    now()
  )
  returning id into v_draw_id;

  v_delta := v_coin_after - v_coin_before;
  v_reason := format('%s 상자 사용', v_box.name);
  if v_reward_delta <> 0 or v_reward_multiplier <> 1.0 then
    v_reason := format('%s (보상 반영)', v_reason);
  end if;

  insert into public.coin_ledger (
    student_id,
    event_type,
    reason,
    delta,
    coin_before,
    coin_after,
    related_box_code,
    related_product_id,
    related_product_name,
    draw_log_id,
    actor_role,
    actor_id,
    created_at
  )
  values (
    p_student_id,
    'draw_result',
    v_reason,
    v_delta,
    v_coin_before,
    v_coin_after,
    v_box.code,
    v_selected.product_id,
    v_selected.product_name,
    v_draw_id,
    case when p_actor_role in ('student', 'admin', 'system') then p_actor_role else 'student' end,
    p_actor_id,
    now()
  );

  return query
    select
      true,
      '당첨되었습니다.',
      v_draw_id,
      v_box.code,
      v_selected.product_name::text,
      v_coin_before,
      v_coin_after,
      v_inventory_after,
      coalesce(v_selected.is_rare, false);
end;
$$;

create or replace function public.shop_admin_adjust_coin(
  p_admin_id uuid,
  p_student_id uuid,
  p_delta integer,
  p_reason text
)
returns table (
  ok boolean,
  message text,
  coin_before integer,
  coin_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_before integer;
  v_after integer;
begin
  if p_reason is null or btrim(p_reason) = '' then
    return query select false, '사유를 입력해 주세요.', null::integer, null::integer;
    return;
  end if;

  if p_delta = 0 then
    return query select false, '조정 수량은 0이 될 수 없습니다.', null::integer, null::integer;
    return;
  end if;

  select id, coin_balance
  into v_student
  from public.students
  where id = p_student_id
  for update;

  if not found then
    return query select false, '학생 정보를 찾을 수 없습니다.', null::integer, null::integer;
    return;
  end if;

  v_before := coalesce(v_student.coin_balance, 0);
  v_after := v_before + p_delta;

  if v_after < 0 then
    return query select false, '코인은 0 미만으로 설정할 수 없습니다.', v_before, v_before;
    return;
  end if;

  update public.students
  set
    coin_balance = v_after,
    updated_at = now()
  where id = p_student_id;

  insert into public.coin_ledger (
    student_id,
    event_type,
    reason,
    delta,
    coin_before,
    coin_after,
    actor_role,
    actor_id,
    created_at
  )
  values (
    p_student_id,
    case when p_delta > 0 then 'manual_credit' else 'manual_debit' end,
    btrim(p_reason),
    p_delta,
    v_before,
    v_after,
    'admin',
    p_admin_id,
    now()
  );

  insert into public.admin_action_logs (
    admin_id,
    action_type,
    target_student_id,
    reason,
    before_data,
    after_data,
    created_at
  )
  values (
    p_admin_id,
    'coin_adjustment',
    p_student_id,
    btrim(p_reason),
    jsonb_build_object('coin_balance', v_before, 'delta', p_delta),
    jsonb_build_object('coin_balance', v_after),
    now()
  );

  return query select true, '코인 조정 완료', v_before, v_after;
end;
$$;

create or replace function public.shop_admin_set_inventory(
  p_admin_id uuid,
  p_product_id uuid,
  p_remaining_quantity integer,
  p_reason text
)
returns table (
  ok boolean,
  message text,
  product_id uuid,
  quantity_before integer,
  quantity_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before integer;
  v_after integer;
  v_product record;
begin
  if p_remaining_quantity < 0 then
    return query select false, '재고는 음수가 될 수 없습니다.', null::uuid, null::integer, null::integer;
    return;
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return query select false, '수정 사유를 입력해 주세요.', null::uuid, null::integer, null::integer;
    return;
  end if;

  select p.id, p.name, b.code as box_code, i.remaining_quantity
  into v_product
  from public.shop_products p
  join public.box_inventory i on i.product_id = p.id
  join public.shop_boxes b on b.id = p.box_id
  where p.id = p_product_id
  for update of i;

  if not found then
    return query select false, '상품을 찾을 수 없습니다.', null::uuid, null::integer, null::integer;
    return;
  end if;

  v_before := v_product.remaining_quantity;
  v_after := p_remaining_quantity;

  update public.box_inventory
  set
    remaining_quantity = v_after,
    updated_at = now()
  where product_id = p_product_id;

  insert into public.admin_action_logs (
    admin_id,
    action_type,
    target_product_id,
    target_box_code,
    reason,
    before_data,
    after_data,
    created_at
  )
  values (
    p_admin_id,
    'inventory_adjustment',
    p_product_id,
    v_product.box_code,
    btrim(p_reason),
    jsonb_build_object('product_name', v_product.name, 'remaining_quantity', v_before),
    jsonb_build_object('product_name', v_product.name, 'remaining_quantity', v_after),
    now()
  );

  return query select true, '재고 수정 완료', p_product_id, v_before, v_after;
end;
$$;

create or replace function public.shop_admin_add_product(
  p_admin_id uuid,
  p_box_code text,
  p_name text,
  p_quantity integer,
  p_base_probability_percent numeric,
  p_is_rare boolean,
  p_reason text
)
returns table (
  ok boolean,
  message text,
  product_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_box public.shop_boxes%rowtype;
  v_product_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    return query select false, '상품명을 입력해 주세요.', null::uuid;
    return;
  end if;

  if p_quantity < 0 then
    return query select false, '수량은 음수가 될 수 없습니다.', null::uuid;
    return;
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return query select false, '추가 사유를 입력해 주세요.', null::uuid;
    return;
  end if;

  select *
  into v_box
  from public.shop_boxes
  where code = lower(trim(p_box_code))
  for update;

  if not found then
    return query select false, '상자를 찾을 수 없습니다.', null::uuid;
    return;
  end if;

  insert into public.shop_products (
    box_id,
    name,
    base_probability_percent,
    is_rare,
    created_at,
    updated_at
  )
  values (
    v_box.id,
    btrim(p_name),
    p_base_probability_percent,
    coalesce(p_is_rare, false),
    now(),
    now()
  )
  returning id into v_product_id;

  insert into public.box_inventory (
    product_id,
    initial_quantity,
    remaining_quantity,
    updated_at,
    created_at
  )
  values (
    v_product_id,
    p_quantity,
    p_quantity,
    now(),
    now()
  );

  insert into public.admin_action_logs (
    admin_id,
    action_type,
    target_product_id,
    target_box_code,
    reason,
    before_data,
    after_data,
    created_at
  )
  values (
    p_admin_id,
    'product_create',
    v_product_id,
    v_box.code,
    btrim(p_reason),
    null,
    jsonb_build_object(
      'product_name', btrim(p_name),
      'initial_quantity', p_quantity,
      'base_probability_percent', p_base_probability_percent,
      'is_rare', coalesce(p_is_rare, false)
    ),
    now()
  );

  return query select true, '상품 추가 완료', v_product_id;
end;
$$;

create or replace function public.shop_grant_coin_on_new_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before integer;
  v_after integer;
begin
  select coin_balance
  into v_before
  from public.students
  where id = new.student_id
  for update;

  if v_before is null then
    return new;
  end if;

  v_after := v_before + 1;

  update public.students
  set
    coin_balance = v_after,
    updated_at = now()
  where id = new.student_id;

  insert into public.coin_ledger (
    student_id,
    event_type,
    reason,
    delta,
    coin_before,
    coin_after,
    actor_role,
    actor_id,
    created_at
  )
  values (
    new.student_id,
    'score_auto_reward',
    format('%s 시즌 %s회 성적 신규 입력 자동 지급', upper(new.season), new.round),
    1,
    v_before,
    v_after,
    'system',
    new.recorded_by,
    now()
  );

  insert into public.admin_action_logs (
    admin_id,
    action_type,
    target_student_id,
    reason,
    before_data,
    after_data,
    created_at
  )
  values (
    new.recorded_by,
    'score_auto_coin_reward',
    new.student_id,
    format('%s 시즌 %s회 성적 입력', upper(new.season), new.round),
    jsonb_build_object('coin_balance', v_before, 'season', upper(new.season), 'round', new.round, 'score', new.score),
    jsonb_build_object('coin_balance', v_after),
    now()
  );

  return new;
end;
$$;

drop trigger if exists trg_shop_grant_coin_on_new_score on public.exam_score_records;
create trigger trg_shop_grant_coin_on_new_score
after insert on public.exam_score_records
for each row
execute function public.shop_grant_coin_on_new_score();

alter table public.shop_boxes enable row level security;
alter table public.shop_products enable row level security;
alter table public.box_inventory enable row level security;
alter table public.draw_logs enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.admin_action_logs enable row level security;
alter table public.exam_score_records enable row level security;

revoke all on public.shop_boxes from anon, authenticated;
revoke all on public.shop_products from anon, authenticated;
revoke all on public.box_inventory from anon, authenticated;
revoke all on public.draw_logs from anon, authenticated;
revoke all on public.coin_ledger from anon, authenticated;
revoke all on public.admin_action_logs from anon, authenticated;
revoke all on public.exam_score_records from anon, authenticated;
