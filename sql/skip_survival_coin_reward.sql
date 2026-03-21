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
  if upper(coalesce(new.season, '')) = 'SP' then
    return new;
  end if;

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
