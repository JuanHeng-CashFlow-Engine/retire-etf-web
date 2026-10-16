
create table if not exists public.retirement_ai_stress_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  scenario_label text not null default 'AI portfolio stress',
  stress_loss_pct numeric(8,4) not null default 0,
  assets_before numeric(18,2) not null default 0,
  assets_after numeric(18,2) not null default 0,
  dividend_drop_pct numeric(8,4) not null default 20,
  monthly_investment_income_before numeric(18,2) not null default 0,
  monthly_investment_income_after numeric(18,2) not null default 0,
  monthly_fixed_income numeric(18,2) not null default 0,
  monthly_expense numeric(18,2) not null default 0,
  monthly_income_after numeric(18,2) not null default 0,
  monthly_gap_after numeric(18,2) not null default 0,
  source text not null default 'financial-analysis-auth',
  analysis jsonb not null default '{}'::jsonb
);

create index if not exists retirement_ai_stress_snapshots_user_generated_idx
  on public.retirement_ai_stress_snapshots(user_id, generated_at desc);

alter table public.retirement_ai_stress_snapshots enable row level security;

drop policy if exists "Users can view own AI stress snapshots" on public.retirement_ai_stress_snapshots;
create policy "Users can view own AI stress snapshots"
on public.retirement_ai_stress_snapshots
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own AI stress snapshots" on public.retirement_ai_stress_snapshots;
create policy "Users can insert own AI stress snapshots"
on public.retirement_ai_stress_snapshots
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own AI stress snapshots" on public.retirement_ai_stress_snapshots;
create policy "Users can delete own AI stress snapshots"
on public.retirement_ai_stress_snapshots
for delete
to authenticated
using ((select auth.uid()) = user_id);
;

