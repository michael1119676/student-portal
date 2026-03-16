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
    when p_product_name ~* '골드바'
      or p_product_name ~* '조말론'
      then 'physical'
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
#variable_conflict use_column
declare
  v_log record;
  v_kind text;
  v_before boolean;
  v_after boolean;
begin
  select dl.id, dl.product_name, dl.delivery_completed
  into v_log
  from public.draw_logs as dl
  where dl.id = p_draw_log_id
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

  update public.draw_logs as dl
  set
    delivery_completed = v_after,
    delivery_completed_at = case when v_after then now() else null end,
    delivery_updated_by = case when v_after then p_admin_id else null end
  where dl.id = p_draw_log_id;

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
    dl.student_id,
    dl.box_code,
    case when v_after then '상품 지급 처리' else '상품 지급 처리 취소' end,
    'delivery_status_update',
    jsonb_build_object('draw_log_id', p_draw_log_id, 'delivery_completed', v_before, 'product_name', v_log.product_name),
    jsonb_build_object('draw_log_id', p_draw_log_id, 'delivery_completed', v_after, 'product_name', v_log.product_name),
    now()
  from public.draw_logs as dl
  where dl.id = p_draw_log_id;

  return query
    select
      true,
      case when v_after then '지급 완료 처리했습니다.' else '지급 완료 처리를 취소했습니다.' end,
      v_after;
end;
$$;
