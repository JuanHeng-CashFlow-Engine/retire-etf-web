
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.valid_dividend_months(value jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(value) <> 'array' then false
    when pg_catalog.jsonb_array_length(value) > 12 then false
    else not exists (
      select 1
      from pg_catalog.jsonb_array_elements_text(value) as item(month_value)
      where month_value !~ '^[0-9]+$'
         or month_value::integer < 1
         or month_value::integer > 12
    )
    and (
      select pg_catalog.count(*) = pg_catalog.count(distinct month_value)
      from pg_catalog.jsonb_array_elements_text(value) as item(month_value)
    )
  end
$$;

revoke all on function private.valid_dividend_months(jsonb) from public, anon, authenticated;

alter table public.user_assets
  add column if not exists currency text not null default 'TWD',
  add column if not exists data_date date not null default current_date,
  add column if not exists import_source text not null default 'manual',
  add column if not exists import_batch_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='user_assets_type_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_type_check
      check (asset_type in ('fund','cash','bond','insurance','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname='user_assets_name_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_name_check
      check (length(btrim(asset_name)) between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname='user_assets_code_length_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_code_length_check
      check (length(asset_code) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname='user_assets_provider_length_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_provider_length_check
      check (length(provider) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname='user_assets_current_value_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_current_value_check
      check (current_value >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='user_assets_monthly_contribution_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_monthly_contribution_check
      check (monthly_contribution >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='user_assets_annual_yield_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_annual_yield_check
      check (annual_yield between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='user_assets_dividend_months_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_dividend_months_check
      check (private.valid_dividend_months(dividend_months));
  end if;
  if not exists (select 1 from pg_constraint where conname='user_assets_currency_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_currency_check
      check (currency = 'TWD');
  end if;
  if not exists (select 1 from pg_constraint where conname='user_assets_data_date_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_data_date_check
      check (data_date >= date '1900-01-01');
  end if;
  if not exists (select 1 from pg_constraint where conname='user_assets_import_source_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_import_source_check
      check (import_source in ('manual','file','image'));
  end if;
  if not exists (select 1 from pg_constraint where conname='user_assets_notes_length_check' and conrelid='public.user_assets'::regclass) then
    alter table public.user_assets add constraint user_assets_notes_length_check
      check (length(notes) <= 2000);
  end if;
end
$$;

create unique index if not exists user_assets_active_identity_unique
on public.user_assets (
  user_id,
  lower(btrim(asset_type)),
  lower(btrim(asset_name)),
  upper(btrim(asset_code)),
  lower(btrim(provider))
)
where is_active;

revoke all on table public.user_assets from anon;
revoke all on table public.user_portfolios from anon;
revoke truncate, references, trigger on table public.user_assets from authenticated;
revoke truncate, references, trigger on table public.user_portfolios from authenticated;
grant select, insert, update, delete on table public.user_assets to authenticated;
grant select, insert, update, delete on table public.user_portfolios to authenticated;
;

