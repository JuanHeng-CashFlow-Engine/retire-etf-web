begin;

drop function if exists public.start_retirement_trial();

create or replace function public.start_retirement_trial_for_user(p_user uuid)
returns table (subscription_status text, trial_end_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing public.subscriptions%rowtype;
  profile_trial_started timestamptz;
  trial_end timestamptz := now() + interval '7 days';
begin
  if p_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into existing from public.subscriptions where user_id = p_user for update;
  if found then
    if existing.status = 'trialing' and existing.trial_end_at >= now() then
      return query select existing.status, existing.trial_end_at; return;
    end if;
    if existing.status in ('active','paid') and (existing.current_period_end is null or existing.current_period_end >= now()) then
      return query select existing.status, existing.current_period_end; return;
    end if;
    raise exception 'TRIAL_ALREADY_USED';
  end if;
  select trial_started_at into profile_trial_started from public.user_profiles where id = p_user for update;
  if profile_trial_started is not null then raise exception 'TRIAL_ALREADY_USED'; end if;
  insert into public.subscriptions
    (user_id,plan_code,status,price,currency,trial_start_at,trial_end_at,provider)
  values (p_user,'pro_monthly','trialing',99,'TWD',now(),trial_end,'internal_trial');
  update public.user_profiles set trial_started_at=now(),trial_ends_at=trial_end,updated_at=now() where id=p_user;
  return query select 'trialing'::text,trial_end;
end;
$$;

revoke all on function public.start_retirement_trial_for_user(uuid) from public, anon, authenticated;
grant execute on function public.start_retirement_trial_for_user(uuid) to service_role;

commit;

;

