-- Apply once to the Supabase project before enabling fixed-income entry in React.
-- Existing retirement tables are left unchanged.
create table if not exists public.retirement_fixed_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null default 'other' check (category in ('labor_insurance', 'labor_pension', 'annuity', 'rent', 'other')),
  monthly_amount numeric(18,2) not null check (monthly_amount >= 0),
  start_month date not null,
  end_month date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retirement_fixed_incomes_month_bounds check (end_month is null or end_month >= start_month)
);

create index if not exists retirement_fixed_incomes_user_id_idx
  on public.retirement_fixed_incomes(user_id);

alter table public.retirement_fixed_incomes enable row level security;
grant select, insert, update, delete on public.retirement_fixed_incomes to authenticated;

create policy fixed_income_owner_select on public.retirement_fixed_incomes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy fixed_income_owner_insert on public.retirement_fixed_incomes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fixed_income_owner_update on public.retirement_fixed_incomes
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy fixed_income_owner_delete on public.retirement_fixed_incomes
  for delete to authenticated using ((select auth.uid()) = user_id);
