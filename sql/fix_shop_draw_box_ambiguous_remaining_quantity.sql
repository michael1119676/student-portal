create table if not exists public.student_box_tickets (
  id bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  box_code text not null check (box_code in ('roulette', 'bronze', 'silver', 'gold', 'diamond')),
  remaining_count integer not null default 0 check (remaining_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, box_code)
);

create index if not exists idx_student_box_tickets_student_id
  on public.student_box_tickets (student_id, box_code);

alter table public.student_box_tickets enable row level security;
revoke all on public.student_box_tickets from anon, authenticated;

alter table public.draw_logs
  add column if not exists delivery_completed boolean not null default false;

alter table public.draw_logs
  add column if not exists delivery_completed_at timestamptz;

alter table public.draw_logs
  add column if not exists delivery_updated_by uuid references public.students(id) on delete set null;

create or replace function public.shop_delivery_kind(
  p_product_name text
)
returns text
language sql
immutable
as $$
  select case
    when p_product_name is null or btrim(p_product_name) = '' then 'instant'
    when p_product_name ~* '꽝'
      or p_product_name ~* '뽑기권'
      or p_product_name ~* '코인[^0-9]*[0-9]+[[:space:]]*개([[:space:]]*추가)?$'
      or (p_product_name ~* '코인' and p_product_name ~* '배')
      then 'instant'
    when p_product_name ~* 'CU'
      or p_product_name ~* '스타벅스'
      or p_product_name ~* '굽네'
      or p_product_name ~* '베스킨'
      or p_product_name ~* '페레로'
      or p_product_name ~* '페로로'
      or p_product_name ~* '마이쮸'
      then 'gifticon'
    else 'physical'
  end
$$;

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
#variable_conflict use_column
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
  v_delivery_kind text;
  v_delivery_completed boolean := false;
  v_used_ticket boolean := false;
  v_ticket_before integer := 0;
  v_ticket_after integer := 0;
  v_grant_ticket_box_code text;
  v_grant_ticket_count integer := 0;
  v_grant_ticket_box_name text;
  v_coin_delta_match text[];
  v_coin_multiplier_match text[];
  v_ticket_match text[];
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

  insert into public.student_box_tickets (student_id, box_code, remaining_count)
  values (p_student_id, v_box.code, 0)
  on conflict on constraint student_box_tickets_student_id_box_code_key do nothing;

  select sbt.remaining_count
  into v_ticket_before
  from public.student_box_tickets sbt
  where sbt.student_id = p_student_id
    and sbt.box_code = v_box.code
  for update;

  v_ticket_before := coalesce(v_ticket_before, 0);
  if v_ticket_before > 0 then
    v_used_ticket := true;
    update public.student_box_tickets sbt
    set
      remaining_count = greatest(sbt.remaining_count - 1, 0),
      updated_at = now()
    where sbt.student_id = p_student_id
      and sbt.box_code = v_box.code
    returning sbt.remaining_count into v_ticket_after;
  else
    if v_coin_before < v_box.coin_cost then
      return query select false, '코인이 부족합니다.', null::bigint, v_box.code, null::text, v_coin_before, v_coin_before, null::integer, false;
      return;
    end if;
    v_ticket_after := v_ticket_before;
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
    remaining_quantity = bi.remaining_quantity - 1,
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

  if v_reward_delta = 0 then
    v_coin_delta_match := regexp_match(
      v_selected.product_name,
      '코인[^0-9]*([0-9]+)[[:space:]]*개[[:space:]]*추가'
    );
    if v_coin_delta_match is not null and array_length(v_coin_delta_match, 1) >= 1 then
      v_reward_delta := greatest(coalesce(v_coin_delta_match[1]::integer, 0), 0);
    end if;
  end if;

  if v_reward_multiplier = 1.0 then
    v_coin_multiplier_match := regexp_match(
      v_selected.product_name,
      '코인[^0-9]*([0-9]+(\.[0-9]+)?)[[:space:]]*배'
    );
    if v_coin_multiplier_match is not null and array_length(v_coin_multiplier_match, 1) >= 1 then
      v_reward_multiplier := greatest(coalesce(v_coin_multiplier_match[1]::numeric, 1.0), 0.0001);
    end if;
  end if;

  if v_used_ticket then
    v_coin_after := v_coin_before;
  else
    v_coin_after := v_coin_before - v_box.coin_cost;
  end if;
  v_coin_after := floor(v_coin_after * v_reward_multiplier) + v_reward_delta;
  if v_coin_after < 0 then
    v_coin_after := 0;
  end if;

  v_delivery_kind := public.shop_delivery_kind(v_selected.product_name);
  v_delivery_completed := v_delivery_kind = 'instant';

  v_ticket_match := regexp_match(
    v_selected.product_name,
    '(브론즈|실버|골드|다이아)[[:space:]]*상자[^0-9]*([0-9]+)[[:space:]]*회'
  );
  if v_ticket_match is not null and array_length(v_ticket_match, 1) >= 2 then
    v_grant_ticket_box_code := case v_ticket_match[1]
      when '브론즈' then 'bronze'
      when '실버' then 'silver'
      when '골드' then 'gold'
      when '다이아' then 'diamond'
      else null
    end;
    v_grant_ticket_count := greatest(coalesce(v_ticket_match[2]::integer, 0), 0);

    if v_grant_ticket_box_code is not null and v_grant_ticket_count > 0 then
      insert into public.student_box_tickets (
        student_id,
        box_code,
        remaining_count,
        updated_at
      )
      values (
        p_student_id,
        v_grant_ticket_box_code,
        v_grant_ticket_count,
        now()
      )
      on conflict on constraint student_box_tickets_student_id_box_code_key
      do update
      set
        remaining_count = public.student_box_tickets.remaining_count + excluded.remaining_count,
        updated_at = now();
    end if;
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
    delivery_completed,
    delivery_completed_at,
    delivery_updated_by,
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
    v_delivery_completed,
    case when v_delivery_completed then now() else null end,
    case when v_delivery_completed then p_actor_id else null end,
    case when p_actor_role in ('student', 'admin', 'system') then p_actor_role else 'student' end,
    p_actor_id,
    now()
  )
  returning id into v_draw_id;

  v_delta := v_coin_after - v_coin_before;
  v_reason := format('%s 상자 사용', v_box.name);
  if v_used_ticket then
    v_reason := format('%s (무료 뽑기권 사용)', v_reason);
  end if;
  if v_reward_delta <> 0 or v_reward_multiplier <> 1.0 then
    v_reason := format('%s (보상 반영)', v_reason);
  end if;
  if v_grant_ticket_box_code is not null and v_grant_ticket_count > 0 then
    v_grant_ticket_box_name := case v_grant_ticket_box_code
      when 'bronze' then '브론즈'
      when 'silver' then '실버'
      when 'gold' then '골드'
      when 'diamond' then '다이아'
      else v_grant_ticket_box_code
    end;
    v_reason := format('%s (%s 상자 %s회 뽑기권 지급)', v_reason, v_grant_ticket_box_name, v_grant_ticket_count);
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
      case
        when v_grant_ticket_box_code is not null and v_grant_ticket_count > 0
          then format('%s 상자 %s회 뽑기권이 지급되었습니다.', coalesce(v_grant_ticket_box_name, '추가'), v_grant_ticket_count)
        else '당첨되었습니다.'
      end,
      v_draw_id,
      v_box.code,
      v_selected.product_name::text,
      v_coin_before,
      v_coin_after,
      v_inventory_after,
      coalesce(v_selected.is_rare, false);
end;
$$;
