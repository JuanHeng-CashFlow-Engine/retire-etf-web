
create table if not exists public.financial_ai_usage_daily (
  usage_date date not null,
  client_hash text not null,
  call_count integer not null default 0 check (call_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_date, client_hash)
);

alter table public.financial_ai_usage_daily enable row level security;

revoke all on public.financial_ai_usage_daily from anon, authenticated;

create or replace function public.claim_financial_ai_call(
  p_client_hash text,
  p_per_client_limit integer,
  p_global_limit integer
)
returns table (
  allowed boolean,
  client_count integer,
  client_limit integer,
  global_count integer,
  global_limit integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Taipei')::date;
  v_client_count integer;
  v_global_count integer;
begin
  insert into public.financial_ai_usage_daily(usage_date, client_hash, call_count)
  values (v_day, p_client_hash, 0)
  on conflict do nothing;

  insert into public.financial_ai_usage_daily(usage_date, client_hash, call_count)
  values (v_day, '__global__', 0)
  on conflict do nothing;

  select call_count into v_client_count
  from public.financial_ai_usage_daily
  where usage_date = v_day and client_hash = p_client_hash
  for update;

  select call_count into v_global_count
  from public.financial_ai_usage_daily
  where usage_date = v_day and client_hash = '__global__'
  for update;

  if v_client_count >= p_per_client_limit or v_global_count >= p_global_limit then
    return query select false, v_client_count, p_per_client_limit, v_global_count, p_global_limit;
    return;
  end if;

  update public.financial_ai_usage_daily
  set call_count = call_count + 1, updated_at = now()
  where usage_date = v_day and client_hash = p_client_hash
  returning call_count into v_client_count;

  update public.financial_ai_usage_daily
  set call_count = call_count + 1, updated_at = now()
  where usage_date = v_day and client_hash = '__global__'
  returning call_count into v_global_count;

  return query select true, v_client_count, p_per_client_limit, v_global_count, p_global_limit;
end;
$$;

create or replace function public.refund_financial_ai_call(p_client_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Taipei')::date;
begin
  update public.financial_ai_usage_daily
  set call_count = greatest(call_count - 1, 0), updated_at = now()
  where usage_date = v_day and client_hash = p_client_hash;

  update public.financial_ai_usage_daily
  set call_count = greatest(call_count - 1, 0), updated_at = now()
  where usage_date = v_day and client_hash = '__global__';
end;
$$;

revoke all on function public.claim_financial_ai_call(text, integer, integer) from public, anon, authenticated;
revoke all on function public.refund_financial_ai_call(text) from public, anon, authenticated;
grant execute on function public.claim_financial_ai_call(text, integer, integer) to service_role;
grant execute on function public.refund_financial_ai_call(text) to service_role;
;

