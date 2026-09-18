-- Apply once after the existing bootstrap schema. The browser cannot grant itself Pro access.
-- Existing owner_access allows every authenticated owner to write monthly reports;
-- replace it with a subscription-aware write policy while preserving owner reads.
drop policy if exists owner_access on public.retirement_monthly_reports;
drop policy if exists monthly_report_owner_read on public.retirement_monthly_reports;
drop policy if exists monthly_report_member_insert on public.retirement_monthly_reports;
drop policy if exists monthly_report_member_update on public.retirement_monthly_reports;

create policy monthly_report_owner_read on public.retirement_monthly_reports
  for select to authenticated using ((select auth.uid()) = user_id);

create policy monthly_report_member_insert on public.retirement_monthly_reports
  for insert to authenticated with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.subscriptions s where s.user_id = (select auth.uid())
        and ((s.status in ('active', 'paid') and (s.current_period_end is null or s.current_period_end >= now()))
          or (s.status = 'trialing' and s.trial_end_at >= now()))
    )
  );

create policy monthly_report_member_update on public.retirement_monthly_reports
  for update to authenticated using (
    (select auth.uid()) = user_id and exists (
      select 1 from public.subscriptions s where s.user_id = (select auth.uid())
        and ((s.status in ('active', 'paid') and (s.current_period_end is null or s.current_period_end >= now()))
          or (s.status = 'trialing' and s.trial_end_at >= now()))
    )
  ) with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.subscriptions s where s.user_id = (select auth.uid())
        and ((s.status in ('active', 'paid') and (s.current_period_end is null or s.current_period_end >= now()))
          or (s.status = 'trialing' and s.trial_end_at >= now()))
    )
  );
