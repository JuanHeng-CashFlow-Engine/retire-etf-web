create table if not exists public.client_error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('window_error', 'unhandled_rejection')),
  message text not null check (char_length(message) between 1 and 1000),
  stack text check (stack is null or char_length(stack) <= 4000),
  page_path text not null check (char_length(page_path) <= 300),
  release text not null check (char_length(release) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  created_at timestamptz not null default now()
);

alter table public.client_error_logs enable row level security;

create index if not exists client_error_logs_created_at_idx on public.client_error_logs (created_at desc);
create index if not exists client_error_logs_user_id_idx on public.client_error_logs (user_id) where user_id is not null;

revoke all on public.client_error_logs from anon, authenticated;
grant insert on public.client_error_logs to anon, authenticated;

drop policy if exists "client errors anon insert" on public.client_error_logs;
create policy "client errors anon insert" on public.client_error_logs
for insert to anon with check (user_id is null);

drop policy if exists "client errors own insert" on public.client_error_logs;
create policy "client errors own insert" on public.client_error_logs
for insert to authenticated with check (user_id = (select auth.uid()));

comment on table public.client_error_logs is
'Privacy-minimized browser failures. Clients may insert only; reading is reserved for service-role operations.';
