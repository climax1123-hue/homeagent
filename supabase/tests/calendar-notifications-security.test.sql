begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

select ok((select relrowsecurity from pg_class where oid='public.push_subscriptions'::regclass),'push subscription RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.calendar_reminders'::regclass),'reminder RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.notification_deliveries'::regclass),'delivery RLS enabled');
select table_privs_are('public','notification_deliveries','authenticated',array[]::text[],'clients cannot read deliveries');

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','50000000-0000-4000-8000-000000000001','authenticated','authenticated','notify-owner@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','50000000-0000-4000-8000-000000000002','authenticated','authenticated','notify-member@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','50000000-0000-4000-8000-000000000003','authenticated','authenticated','notify-outsider@example.test','',now(),'{}','{}',now(),now());
insert into public.households(id,name,created_by) values
('51000000-0000-4000-8000-000000000001','알림 테스트 가족','50000000-0000-4000-8000-000000000001'),
('51000000-0000-4000-8000-000000000002','외부 테스트 가족','50000000-0000-4000-8000-000000000003');
insert into public.household_members(household_id,user_id,display_name,role,status,status_changed_by) values
('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','소유자','admin','active','50000000-0000-4000-8000-000000000001'),
('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','구성원','member','active','50000000-0000-4000-8000-000000000001'),
('51000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','외부인','admin','active','50000000-0000-4000-8000-000000000003');
insert into public.calendar_events(id,household_id,owner_user_id,visibility,title,starts_at,ends_at) values
('52000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','family','가족 일정',now()+interval '1 day',now()+interval '25 hours'),
('52000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','private','비공개 일정',now()+interval '2 days',now()+interval '49 hours'),
('52000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','family','외부 일정',now()+interval '3 days',now()+interval '73 hours');

set local role authenticated;
set local request.jwt.claim.sub='50000000-0000-4000-8000-000000000002';
select lives_ok($$insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_key) values ('50000000-0000-4000-8000-000000000002','https://push.example.test/member-endpoint','abcdefghijklmnopqrstuvwxyz','abcdefgh')$$,'member creates own subscription');
select is((select count(*) from public.push_subscriptions),1::bigint,'member sees own subscription');
select lives_ok($$insert into public.calendar_reminders(household_id,owner_user_id,kind,event_id,title,advance_minutes) values ('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','event','52000000-0000-4000-8000-000000000001','가족 일정 알림',10)$$,'member creates reminder for visible family event');
select throws_ok($$insert into public.calendar_reminders(household_id,owner_user_id,kind,event_id,title,advance_minutes) values ('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','event','52000000-0000-4000-8000-000000000002','비공개 일정 알림',10)$$,'22023','CALENDAR_REMINDER_EVENT_SCOPE_INVALID','member cannot bind another private event');
select throws_ok($$insert into public.calendar_reminders(household_id,owner_user_id,kind,event_id,title,advance_minutes) values ('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','event','52000000-0000-4000-8000-000000000003','외부 일정 알림',10)$$,'22023','CALENDAR_REMINDER_EVENT_SCOPE_INVALID','member cannot bind another household event');

set local request.jwt.claim.sub='50000000-0000-4000-8000-000000000001';
select is((select count(*) from public.push_subscriptions),0::bigint,'another user cannot see subscription');
select lives_ok($$insert into public.calendar_reminders(household_id,owner_user_id,kind,event_id,title,advance_minutes) values ('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','event','52000000-0000-4000-8000-000000000002','내 비공개 알림',30)$$,'owner creates reminder for private event');
select is((select count(*) from public.calendar_reminders),1::bigint,'owner sees only own reminder');

set local request.jwt.claim.sub='50000000-0000-4000-8000-000000000003';
select is((select count(*) from public.calendar_reminders),0::bigint,'outsider sees no reminders');

select * from finish();
rollback;

