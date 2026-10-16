begin;

alter table public.etf_prices enable row level security;
revoke all privileges on table public.etf_prices from anon, authenticated;
grant select on table public.etf_prices to anon, authenticated;

alter table public.stock_mapping enable row level security;
revoke all privileges on table public.stock_mapping from anon, authenticated;
grant select on table public.stock_mapping to anon, authenticated;

alter table public.payment_records enable row level security;
revoke all privileges on table public.payment_records from anon, authenticated;
grant select on table public.payment_records to authenticated;

alter table public.subscriptions enable row level security;
revoke all privileges on table public.subscriptions from anon, authenticated;
grant select, insert on table public.subscriptions to authenticated;

commit;;

