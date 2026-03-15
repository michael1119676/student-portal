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
