-- Run as database owner. All fixtures and temporary entitlement changes ROLLBACK.
-- No external messages are sent; no account entitlement change is committed.
begin;
do $$ declare u uuid; begin
  select id into u from public.user_profiles limit 1;
  if u is null then raise exception 'Need one existing profile for transactional RLS test'; end if;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('protest.uid',u::text,true);
  update public.user_profiles set trial_ends_at=now()-interval '1 day' where id=u;
  update public.subscriptions set current_period_end=now()-interval '1 day',trial_end_at=now()-interval '1 day' where user_id=u;
end $$;
set local role authenticated;
do $$ declare denied boolean=false; begin
  if public.retirement_pro_enabled() then raise exception 'Expired access granted'; end if;
  begin insert into public.retirement_pro_records(user_id,kind,name,payload) values(auth.uid(),'scenario','transaction fixture','{}');
  exception when insufficient_privilege then denied=true; end;
  if not denied then raise exception 'Free scenario write allowed'; end if;
end $$;
reset role;
update public.user_profiles set trial_ends_at=now()+interval '1 hour' where id=current_setting('protest.uid')::uuid;
set local role authenticated;
do $$ declare denied boolean=false; rid uuid; begin
  if not public.retirement_pro_enabled() then raise exception 'Trial access denied'; end if;
  insert into public.retirement_pro_records(user_id,kind,name,payload) values(auth.uid(),'scenario','transaction fixture','{}') returning id into rid;
  perform set_config('protest.record',rid::text,true);
  if not exists(select 1 from public.retirement_pro_records where id=rid) then raise exception 'Owner read denied'; end if;
  begin insert into public.retirement_pro_records(user_id,kind,name,payload) values(gen_random_uuid(),'scenario','spoofed fixture','{}');
  exception when insufficient_privilege then denied=true; end;
  if not denied then raise exception 'Cross-user insert allowed'; end if;
  denied=false;
  begin update public.retirement_pro_records set name='overwritten' where id=rid;
  exception when insufficient_privilege then denied=true; end;
  if not denied then raise exception 'Snapshot overwrite allowed'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if exists(select 1 from public.retirement_pro_records where id=rid) then raise exception 'Cross-user read allowed'; end if;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('protest.uid'),true); end $$;
insert into public.retirement_pro_records(user_id,kind,name,payload,created_at)
values(current_setting('protest.uid')::uuid,'alert_preferences','transaction fixture','{"enabled":true,"days":30,"cut":20}',now()+interval '1 second');
insert into public.dividend_calendar(user_id,ticker,dividend_year,dividend_month,expected_amount,expected_payment_date,actual_amount,status)
values
(current_setting('protest.uid')::uuid,'TESTDUE',2026,9,1000,(now() at time zone 'Asia/Taipei')::date+1,null,'announced'),
(current_setting('protest.uid')::uuid,'TESTLATE',2026,9,1000,(now() at time zone 'Asia/Taipei')::date-1,null,'announced'),
(current_setting('protest.uid')::uuid,'TESTSHORT',2026,9,1000,(now() at time zone 'Asia/Taipei')::date,0,'recorded');
do $$ declare n integer; begin
  perform public.generate_retirement_pro_notifications();
  select count(*) into n from public.retirement_pro_notifications where user_id=current_setting('protest.uid')::uuid and title like 'TEST%';
  if n<>3 then raise exception 'Expected 3 fixture alerts, got %',n; end if;
  if public.generate_retirement_pro_notifications()<>0 then raise exception 'Notification dedup failed'; end if;
end $$;
set local role authenticated;
do $$ declare denied boolean=false; begin
  update public.retirement_pro_notifications set is_read=true where title like 'TEST%';
  if exists(select 1 from public.retirement_pro_notifications where title like 'TEST%' and not is_read) then raise exception 'Mark read failed'; end if;
  begin update public.retirement_pro_notifications set message='tampered' where title like 'TEST%';
  exception when insufficient_privilege then denied=true; end;
  if not denied then raise exception 'Notification content writable'; end if;
end $$;
reset role;
rollback;
select 'PASS: entitlement, owner isolation, immutable records, 3 alert rules, dedup, read-only notification content; all fixtures rolled back' as result;
