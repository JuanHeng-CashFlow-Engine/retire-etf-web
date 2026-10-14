-- One-time Pro trial activation and server-owned subscription state.
begin;

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
update public.subscriptions set status = 'trialing' where status = 'trial';
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('trialing','active','paid','past_due','expired','cancelled'));

drop policy if exists "Users can create own trial subscription" on public.subscriptions;
revoke insert, update, delete on public.subscriptions from anon, authenticated;

create table if not exists public.subscription_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
alter table public.subscription_webhook_events enable row level security;
revoke all on public.subscription_webhook_events from anon, authenticated;
comment on table public.subscription_webhook_events is
  'Stripe webhook idempotency ledger. Service role only; no browser policies.';

create or replace function public.start_retirement_trial()
returns table (subscription_status text, trial_end_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  existing public.subscriptions%rowtype;
  profile_trial_started timestamptz;
  trial_end timestamptz := now() + interval '7 days';
begin
  if caller is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into existing from public.subscriptions where user_id = caller for update;
  if found then
    if existing.status = 'trialing' and existing.trial_end_at >= now() then
      return query select existing.status, existing.trial_end_at;
      return;
    end if;
    if existing.status in ('active','paid') and
       (existing.current_period_end is null or existing.current_period_end >= now()) then
      return query select existing.status, existing.current_period_end;
      return;
    end if;
    raise exception 'TRIAL_ALREADY_USED' using errcode = 'P0001';
  end if;

  select trial_started_at into profile_trial_started
  from public.user_profiles where id = caller for update;
  if profile_trial_started is not null then
    raise exception 'TRIAL_ALREADY_USED' using errcode = 'P0001';
  end if;

  insert into public.subscriptions
    (user_id, plan_code, status, price, currency, trial_start_at, trial_end_at, provider)
  values
    (caller, 'pro_monthly', 'trialing', 99, 'TWD', now(), trial_end, 'internal_trial');

  update public.user_profiles
  set trial_started_at = now(), trial_ends_at = trial_end, updated_at = now()
  where id = caller;

  return query select 'trialing'::text, trial_end;
end;
$$;

revoke all on function public.start_retirement_trial() from public, anon;
grant execute on function public.start_retirement_trial() to authenticated;

commit;

