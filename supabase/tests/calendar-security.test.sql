begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

select has_table('public', 'calendar_events', 'calendar_events exists');
select ok((select relrowsecurity from pg_class where oid = 'public.calendar_events'::regclass), 'calendar_events has RLS');
select table_privs_are('public', 'calendar_events', 'anon', array[]::text[], 'anon has no calendar privileges');
select table_privs_are('public', 'calendar_events', 'authenticated', array['SELECT','INSERT','UPDATE','DELETE'], 'authenticated has CRUD through RLS');

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','30000000-0000-4000-8000-000000000001','authenticated','authenticated','calendar-admin@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','30000000-0000-4000-8000-000000000002','authenticated','authenticated','calendar-member@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','30000000-0000-4000-8000-000000000003','authenticated','authenticated','calendar-outsider@example.test','',now(),'{}','{}',now(),now());

insert into public.households(id,name,created_by) values ('31000000-0000-4000-8000-000000000001','캘린더 가족','30000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,display_name,role,status,status_changed_by) values
('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','관리자','admin','active','30000000-0000-4000-8000-000000000001'),
('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','구성원','member','active','30000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000002';
insert into public.calendar_events(id,household_id,owner_user_id,visibility,title,starts_at,ends_at) values
('32000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','family','가족 일정',now(),now()+interval '1 hour'),
('32000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','private','개인 일정',now(),now()+interval '1 hour');
select is((select count(*) from public.calendar_events),2::bigint,'owner reads family and private events');
select lives_ok($$update public.calendar_events set title='수정' where id='32000000-0000-4000-8000-000000000001'$$,'owner updates own event');

set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000001';
select is((select count(*) from public.calendar_events),1::bigint,'admin reads family but not member private event');
select lives_ok($$update public.calendar_events set title='관리자 수정' where id='32000000-0000-4000-8000-000000000001'$$,'admin updates family event');
select is((select count(*) from public.calendar_events where id='32000000-0000-4000-8000-000000000002'),0::bigint,'admin cannot see private event');

set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000003';
select is((select count(*) from public.calendar_events),0::bigint,'outsider reads no events');
select throws_ok($$insert into public.calendar_events(household_id,owner_user_id,title,starts_at,ends_at) values ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','침입',now(),now()+interval '1 hour')$$,'42501',null,'outsider cannot insert');

set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000002';
select throws_ok($$update public.calendar_events set owner_user_id='30000000-0000-4000-8000-000000000001' where id='32000000-0000-4000-8000-000000000001'$$,'22023','CALENDAR_EVENT_IDENTITY_IMMUTABLE','event owner is immutable');
select throws_ok($$insert into public.calendar_events(household_id,owner_user_id,title,starts_at,ends_at) values ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','잘못된 시간',now(),now())$$,'23514',null,'end must be after start');
select * from finish();
rollback;
