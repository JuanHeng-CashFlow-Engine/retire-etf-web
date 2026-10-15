drop index if exists public.dividend_history_official_record_uidx;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.dividend_history'::regclass
      and conname = 'dividend_history_official_record_unique'
  ) then
    alter table public.dividend_history
      add constraint dividend_history_official_record_unique unique (source, source_record_key);
  end if;
end $$;
