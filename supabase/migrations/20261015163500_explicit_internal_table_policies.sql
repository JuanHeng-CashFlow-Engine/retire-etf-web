do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'dividend_history',
    'financial_ai_usage_daily',
    'market_data_sync_runs',
    'market_dividend_staging',
    'subscription_webhook_events'
  ] loop
    execute format('drop policy if exists deny_client_access on public.%I', table_name);
    execute format(
      'create policy deny_client_access on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      table_name
    );
  end loop;
end $$;

comment on policy deny_client_access on public.dividend_history is 'Internal market-data cache; browser roles are explicitly denied. Service role bypasses RLS.';
comment on policy deny_client_access on public.financial_ai_usage_daily is 'Internal AI quota ledger; browser roles are explicitly denied. Updates happen through the controlled quota RPC.';
comment on policy deny_client_access on public.market_data_sync_runs is 'Internal ingestion audit trail; browser roles are explicitly denied.';
comment on policy deny_client_access on public.market_dividend_staging is 'Internal ingestion staging; browser roles are explicitly denied.';
comment on policy deny_client_access on public.subscription_webhook_events is 'Internal payment webhook ledger; browser roles are explicitly denied.';
