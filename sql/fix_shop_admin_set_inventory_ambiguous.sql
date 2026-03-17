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
#variable_conflict use_column
declare
  v_before integer;
  v_after integer;
  v_product record;
begin
  if p_remaining_quantity < 0 then
    return query
      select false, '재고는 음수가 될 수 없습니다.', null::uuid, null::integer, null::integer;
    return;
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return query
      select false, '수정 사유를 입력해 주세요.', null::uuid, null::integer, null::integer;
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
    return query
      select false, '상품을 찾을 수 없습니다.', null::uuid, null::integer, null::integer;
    return;
  end if;

  v_before := v_product.remaining_quantity;
  v_after := p_remaining_quantity;

  update public.box_inventory as bi
  set
    remaining_quantity = v_after,
    updated_at = now()
  where bi.product_id = p_product_id;

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

  return query
    select true, '재고 수정 완료', p_product_id, v_before, v_after;
end;
$$;
