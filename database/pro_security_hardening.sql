begin;
revoke insert,update,delete on public.subscriptions from anon,authenticated;
revoke insert,update,delete on public.user_profiles from anon,authenticated;
revoke insert(trial_started_at,trial_ends_at),update(trial_started_at,trial_ends_at) on public.user_profiles from anon,authenticated;
grant update(email,current_age,monthly_expense,monthly_contribution,onboarding_completed,onboarding_completed_at,dividend_email_alert_enabled) on public.user_profiles to authenticated;
-- Profiles are created by the existing Auth signup trigger; entitlement fields are server-owned.
create policy pro_snapshot_insert_gate on public.retirement_snapshots_v3 as restrictive for insert to authenticated with check ((select public.retirement_pro_enabled()));
create policy pro_stress_insert_gate on public.retirement_ai_stress_snapshots as restrictive for insert to authenticated with check ((select public.retirement_pro_enabled()));
revoke all on public.dividend_history,public.financial_ai_usage_daily from anon,authenticated;
comment on table public.dividend_history is 'Internal market-data ingestion/cache. No client policy; service role only.';
comment on table public.financial_ai_usage_daily is 'Internal server-side AI rate counter. No client policy; service role only.';
create index if not exists retirement_gps_goal_id_idx on public.retirement_gps(goal_id);
create index if not exists user_activity_logs_user_id_idx on public.user_activity_logs(user_id);
create index if not exists fund_distribution_records_asset_id_idx on public.fund_distribution_records(asset_id);
do $fix$ declare p record; q text; w text; stmt text; begin
for p in select * from pg_policies where schemaname='public' loop
q:=p.qual; w:=p.with_check;
if q like '%auth.uid()%' and q not ilike '%select%' then q:=replace(q,'auth.uid()','(select auth.uid())'); end if;
if w like '%auth.uid()%' and w not ilike '%select%' then w:=replace(w,'auth.uid()','(select auth.uid())'); end if;
if q is distinct from p.qual or w is distinct from p.with_check then
stmt:=format('alter policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
if q is not null then stmt:=stmt||' using ('||q||')'; end if;
if w is not null then stmt:=stmt||' with check ('||w||')'; end if;
execute stmt;
end if;
end loop;
end $fix$;
alter function public.retirement_pro_enabled() security invoker;
commit;
