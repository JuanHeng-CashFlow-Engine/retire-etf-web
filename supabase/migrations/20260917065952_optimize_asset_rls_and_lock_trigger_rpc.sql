
drop policy if exists "Users can view own assets" on public.user_assets;
drop policy if exists "Users can insert own assets" on public.user_assets;
drop policy if exists "Users can update own assets" on public.user_assets;
drop policy if exists "Users can delete own assets" on public.user_assets;

create policy "Users can view own assets"
on public.user_assets for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert own assets"
on public.user_assets for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own assets"
on public.user_assets for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own assets"
on public.user_assets for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can view own portfolio" on public.user_portfolios;
drop policy if exists "Users can insert own portfolio" on public.user_portfolios;
drop policy if exists "Users can update own portfolio" on public.user_portfolios;
drop policy if exists "Users can delete own portfolio" on public.user_portfolios;

create policy "Users can view own portfolio"
on public.user_portfolios for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert own portfolio"
on public.user_portfolios for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own portfolio"
on public.user_portfolios for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own portfolio"
on public.user_portfolios for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke execute on function public.handle_new_retirement_gps_user() from public, anon, authenticated;
;

