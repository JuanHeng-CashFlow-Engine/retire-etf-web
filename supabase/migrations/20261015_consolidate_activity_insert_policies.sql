drop policy if exists "Consented anonymous product events" on public.user_activity_logs;
drop policy if exists "Consented anonymous browser events" on public.user_activity_logs;
drop policy if exists "Authenticated activity and consented analytics" on public.user_activity_logs;
drop policy if exists "Users can create own activity" on public.user_activity_logs;

create policy "Consented anonymous browser events"
on public.user_activity_logs
for insert
to anon
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

create policy "Authenticated activity and consented analytics"
on public.user_activity_logs
for insert
to authenticated
with check (
  (user_id = (select auth.uid()))
  or (
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
  )
);

