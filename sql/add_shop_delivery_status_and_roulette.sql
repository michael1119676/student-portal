alter table public.shop_boxes
  drop constraint if exists shop_boxes_code_check;

alter table public.shop_boxes
  add constraint shop_boxes_code_check
  check (code in ('roulette', 'bronze', 'silver', 'gold', 'diamond'));

alter table public.student_box_tickets
  drop constraint if exists student_box_tickets_box_code_check;

alter table public.student_box_tickets
  add constraint student_box_tickets_box_code_check
  check (box_code in ('roulette', 'bronze', 'silver', 'gold', 'diamond'));

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

update public.draw_logs
set
  delivery_completed = case
    when public.shop_delivery_kind(product_name) = 'instant' then true
    else coalesce(delivery_completed, false)
  end,
  delivery_completed_at = case
    when public.shop_delivery_kind(product_name) = 'instant'
      then coalesce(delivery_completed_at, created_at)
    else delivery_completed_at
  end,
  delivery_updated_by = case
    when public.shop_delivery_kind(product_name) = 'instant'
      then coalesce(delivery_updated_by, actor_id)
    else delivery_updated_by
  end;

create or replace function public.shop_admin_set_delivery_status(
  p_admin_id uuid,
  p_draw_log_id bigint,
  p_delivery_completed boolean
)
returns table (
  ok boolean,
  message text,
  delivery_completed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log record;
  v_kind text;
  v_before boolean;
  v_after boolean;
begin
  select id, product_name, delivery_completed
  into v_log
  from public.draw_logs
  where id = p_draw_log_id
  for update;

  if not found then
    return query select false, '당첨 로그를 찾을 수 없습니다.', null::boolean;
    return;
  end if;

  v_kind := public.shop_delivery_kind(v_log.product_name);
  if v_kind = 'instant' then
    return query select false, '즉시 지급 상품은 수동 지급 처리 대상이 아닙니다.', v_log.delivery_completed;
    return;
  end if;

  v_before := coalesce(v_log.delivery_completed, false);
  v_after := coalesce(p_delivery_completed, false);

  update public.draw_logs
  set
    delivery_completed = v_after,
    delivery_completed_at = case when v_after then now() else null end,
    delivery_updated_by = case when v_after then p_admin_id else null end
  where id = p_draw_log_id;

  insert into public.admin_action_logs (
    admin_id,
    target_student_id,
    target_box_code,
    reason,
    action_type,
    before_data,
    after_data,
    created_at
  )
  select
    p_admin_id,
    student_id,
    box_code,
    case when v_after then '상품 지급 처리' else '상품 지급 처리 취소' end,
    'delivery_status_update',
    jsonb_build_object('draw_log_id', p_draw_log_id, 'delivery_completed', v_before, 'product_name', v_log.product_name),
    jsonb_build_object('draw_log_id', p_draw_log_id, 'delivery_completed', v_after, 'product_name', v_log.product_name),
    now()
  from public.draw_logs
  where id = p_draw_log_id;

  return query
    select
      true,
      case when v_after then '지급 완료 처리했습니다.' else '지급 완료 처리를 취소했습니다.' end,
      v_after;
end;
$$;

insert into public.shop_boxes (
  code,
  name,
  coin_cost,
  sort_order,
  is_active,
  created_at,
  updated_at
)
values (
  'roulette',
  '1코인 룰렛',
  1,
  0,
  true,
  now(),
  now()
)
on conflict (code)
do update
set
  name = excluded.name,
  coin_cost = excluded.coin_cost,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

with roulette_box as (
  select id
  from public.shop_boxes
  where code = 'roulette'
),
roulette_products(name, quantity, probability_percent, reward_coin_delta) as (
  values
    ('꽝!', 560000, 53.8899::numeric, 0),
    ('코인 1개', 250000, 25::numeric, 1),
    ('코인 2개', 150000, 15::numeric, 2),
    ('코인 5개', 50000, 5::numeric, 5),
    ('코인 10개', 10000, 1::numeric, 10),
    ('코인 30개', 1000, 0.1::numeric, 30),
    ('코인 50개', 100, 0.01::numeric, 50),
    ('코인 777개', 1, 0.0001::numeric, 777)
)
insert into public.shop_products (
  box_id,
  name,
  base_probability_percent,
  is_rare,
  reward_coin_delta,
  reward_coin_multiplier,
  is_active,
  created_at,
  updated_at
)
select
  roulette_box.id,
  roulette_products.name,
  roulette_products.probability_percent,
  roulette_products.probability_percent < 5,
  roulette_products.reward_coin_delta,
  1.0,
  true,
  now(),
  now()
from roulette_box
cross join roulette_products
on conflict (box_id, name)
do update
set
  base_probability_percent = excluded.base_probability_percent,
  is_rare = excluded.is_rare,
  reward_coin_delta = excluded.reward_coin_delta,
  reward_coin_multiplier = excluded.reward_coin_multiplier,
  is_active = true,
  updated_at = now();

with roulette_box as (
  select id
  from public.shop_boxes
  where code = 'roulette'
),
roulette_products(name, quantity) as (
  values
    ('꽝!', 560000),
    ('코인 1개', 250000),
    ('코인 2개', 150000),
    ('코인 5개', 50000),
    ('코인 10개', 10000),
    ('코인 30개', 1000),
    ('코인 50개', 100),
    ('코인 777개', 1)
)
insert into public.box_inventory (
  product_id,
  initial_quantity,
  remaining_quantity,
  updated_at,
  created_at
)
select
  p.id,
  rp.quantity,
  rp.quantity,
  now(),
  now()
from roulette_box rb
join roulette_products rp on true
join public.shop_products p
  on p.box_id = rb.id
 and p.name = rp.name
on conflict (product_id)
do update
set
  initial_quantity = excluded.initial_quantity,
  remaining_quantity = greatest(
    0,
    excluded.initial_quantity - greatest(public.box_inventory.initial_quantity - public.box_inventory.remaining_quantity, 0)
  ),
  updated_at = now();
