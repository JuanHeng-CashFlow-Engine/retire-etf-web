-- Append-only Pro scenarios/AI results, owner-only notifications, opt-in daily rules.
begin;
create or replace function public.retirement_pro_enabled()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.subscriptions s where s.user_id = auth.uid() and
    ((s.status in ('active','paid') and (s.current_period_end is null or s.current_period_end >= now()))
      or (s.status = 'trialing' and s.trial_end_at >= now())))
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.trial_ends_at >= now());
$$;
revoke all on function public.retirement_pro_enabled() from public, anon;
grant execute on function public.retirement_pro_enabled() to authenticated;

create table if not exists public.retirement_pro_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('scenario','analysis','alert_preferences')),
  name text not null check (length(name) between 1 and 100),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 1048576),
  created_at timestamptz not null default now(),
  constraint valid_alert_preferences check (kind <> 'alert_preferences' or (
    payload ?& array['enabled','days','cut'] and
    jsonb_typeof(payload->'enabled') = 'boolean' and
    jsonb_typeof(payload->'days') = 'number' and (payload->>'days')::numeric between 1 and 90 and
    (payload->>'days')::numeric = trunc((payload->>'days')::numeric) and
    jsonb_typeof(payload->'cut') = 'number' and (payload->>'cut')::numeric between 1 and 100))
);
create index if not exists retirement_pro_records_owner_kind on public.retirement_pro_records(user_id,kind,created_at desc);
alter table public.retirement_pro_records enable row level security;
revoke all on public.retirement_pro_records from anon, authenticated;
grant select on public.retirement_pro_records to authenticated;
grant insert (user_id,kind,name,payload) on public.retirement_pro_records to authenticated;
create policy pro_records_owner_read on public.retirement_pro_records for select to authenticated using (user_id = (select auth.uid()));
create policy pro_records_owner_insert on public.retirement_pro_records for insert to authenticated with check
  (user_id = (select auth.uid()) and ((select public.retirement_pro_enabled()) or
    (kind = 'alert_preferences' and payload->>'enabled' = 'false')));

create table if not exists public.retirement_pro_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dedup_key text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id,dedup_key)
);
create index if not exists retirement_pro_notifications_owner on public.retirement_pro_notifications(user_id,created_at desc);
alter table public.retirement_pro_notifications enable row level security;
revoke all on public.retirement_pro_notifications from anon, authenticated;
grant select on public.retirement_pro_notifications to authenticated;
grant update(is_read) on public.retirement_pro_notifications to authenticated;
create policy pro_notifications_owner_read on public.retirement_pro_notifications for select to authenticated using (user_id=(select auth.uid()));
create policy pro_notifications_owner_mark on public.retirement_pro_notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create or replace function public.generate_retirement_pro_notifications()
returns integer language plpgsql security definer set search_path = '' as $$
declare inserted_count integer;
begin
  with latest as (
    select distinct on (user_id) user_id,payload from public.retirement_pro_records
    where kind='alert_preferences' order by user_id,created_at desc,id desc
  ), eligible as (
    select l.user_id,(l.payload->>'days')::integer as days,(l.payload->>'cut')::numeric as cut
    from latest l where l.payload->>'enabled'='true' and (
      exists(select 1 from public.subscriptions s where s.user_id=l.user_id and
        ((s.status in ('active','paid') and (s.current_period_end is null or s.current_period_end>=now())) or
          (s.status='trialing' and s.trial_end_at>=now()))) or
      exists(select 1 from public.user_profiles p where p.id=l.user_id and p.trial_ends_at>=now()))
  ), events as (
    select e.days,e.cut,d.*,
      d.actual_amount is not null or d.actual_payment_date is not null or coalesce(d.status,'') ~* '^(recorded|paid|actual|已入帳)$' as received,
      (now() at time zone 'Asia/Taipei')::date as today
    from eligible e join public.dividend_calendar d on d.user_id=e.user_id
  ), alerts as (
    select d.user_id,'due:'||d.id||':'||d.expected_payment_date as key,d.ticker||' 即將配息' as title,
      d.expected_payment_date||'，預期 '||coalesce(d.expected_amount::text,'待確認')||' 元（'||coalesce(d.status,'未標示')||'）。' as message
    from events d where not d.received and d.expected_payment_date between d.today and d.today+d.days
    union all
    select d.user_id,'late:'||d.id||':'||d.expected_payment_date,d.ticker||' 入帳尚未確認',
      '原訂 '||d.expected_payment_date||'；尚未記錄入帳不代表未收到款項，請核對。'
    from events d where not d.received and d.expected_payment_date<d.today
    union all
    select d.user_id,'short:'||d.id||':'||d.actual_amount,d.ticker||' 入帳低於預期',
      '預期 '||d.expected_amount||' 元，紀錄入帳 '||d.actual_amount||' 元；請核對稅費與公告。'
    from events d where d.received and d.actual_amount is not null and d.expected_amount>0 and d.actual_amount<d.expected_amount*(1-d.cut/100)
    union all
    select e.user_id,'cut:'||q.ticker||':'||q.dividend_change_pct,q.ticker||' 配息下降待核對',
      '資料來源標示配息變動 '||q.dividend_change_pct||'%；請核對相同期間每股配息。來源：'||coalesce(q.data_source,'未標示')
    from eligible e join public.user_portfolios p on p.user_id=e.user_id
    join public.etf_prices q on exists (select 1 from jsonb_array_elements_text(coalesce(p.selected_tickers,'[]'::jsonb)) t(ticker)
      where regexp_replace(upper(t.ticker),'[.](TW|TWO)$','')=regexp_replace(upper(q.ticker),'[.](TW|TWO)$',''))
    where q.dividend_change_pct<=-e.cut
  )
  insert into public.retirement_pro_notifications(user_id,dedup_key,title,message)
    select distinct user_id,key,title,message from alerts on conflict(user_id,dedup_key) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
revoke all on function public.generate_retirement_pro_notifications() from public,anon,authenticated;
-- Scheduler is database-owned; browsers cannot run it or create notifications.
create extension if not exists pg_cron;
select cron.schedule('retirement-pro-daily-alerts','0 1 * * *','select public.generate_retirement_pro_notifications();');
commit;

