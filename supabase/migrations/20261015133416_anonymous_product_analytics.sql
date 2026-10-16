alter table public.user_activity_logs
  add column if not exists visitor_id uuid,
  add column if not exists session_id uuid,
  add column if not exists consent_version text;

create index if not exists user_activity_logs_visitor_created_idx
  on public.user_activity_logs (visitor_id, created_at desc)
  where visitor_id is not null;

drop policy if exists "Consented anonymous product events" on public.user_activity_logs;
create policy "Consented anonymous product events"
on public.user_activity_logs
for insert
to anon, authenticated
with check (
  user_id is null
  and visitor_id is not null
  and session_id is not null
  and consent_version = 'analytics-v1'
  and action in (
    'consent_granted','page_view','guest_check_started','pro_plan_viewed',
    'signup_completed','login_completed','trial_started','checkout_started',
    'billing_return_success','billing_return_cancelled','monthly_report_viewed'
  )
  and char_length(coalesce(page, '')) <= 80
  and octet_length(metadata::text) <= 4096
);

comment on column public.user_activity_logs.visitor_id is
  'Random browser identifier created only after analytics consent; contains no account identifier.';
comment on column public.user_activity_logs.session_id is
  'Random identifier scoped to one browser tab session.';
comment on column public.user_activity_logs.consent_version is
  'Consent text version accepted before the event was collected.';;

