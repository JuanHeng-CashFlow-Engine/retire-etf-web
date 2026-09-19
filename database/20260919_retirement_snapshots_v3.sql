-- V3 monthly reports are append-only user snapshots. Historical rows are never overwritten.
create table if not exists public.retirement_snapshots_v3 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_month date not null,
  as_of date not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint retirement_snapshots_v3_month_start check (snapshot_month = date_trunc('month', snapshot_month)::date),
  constraint retirement_snapshots_v3_as_of_not_future check (as_of <= current_date),
  constraint retirement_snapshots_v3_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint retirement_snapshots_v3_schema check (payload ? 'schema_version' and (payload->>'schema_version')::integer = 1),
  constraint retirement_snapshots_v3_payload_as_of check (payload ? 'as_of' and (payload->>'as_of')::date = as_of)
);

create index if not exists retirement_snapshots_v3_user_created_idx
  on public.retirement_snapshots_v3 (user_id, created_at desc);

alter table public.retirement_snapshots_v3 enable row level security;

revoke all on table public.retirement_snapshots_v3 from anon;
revoke update, delete, truncate, references, trigger on table public.retirement_snapshots_v3 from authenticated;
grant select, insert on table public.retirement_snapshots_v3 to authenticated;

drop policy if exists retirement_snapshots_v3_owner_select on public.retirement_snapshots_v3;
create policy retirement_snapshots_v3_owner_select on public.retirement_snapshots_v3
  for select using (auth.uid() = user_id);

drop policy if exists retirement_snapshots_v3_owner_insert on public.retirement_snapshots_v3;
create policy retirement_snapshots_v3_owner_insert on public.retirement_snapshots_v3
  for insert with check (auth.uid() = user_id);

-- Deliberately no UPDATE or DELETE policy: a snapshot is an audit record.
