begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select has_table('public','calendar_event_exceptions','calendar exception table exists');
select ok((select relrowsecurity from pg_class where oid='public.calendar_event_exceptions'::regclass),'exception RLS enabled');
select table_privs_are('public','calendar_event_exceptions','anon',array[]::text[],'anon has no privileges');
select table_privs_are('public','calendar_event_exceptions','authenticated',array['SELECT','INSERT','UPDATE','DELETE'],'authenticated uses RLS CRUD');

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','40000000-0000-4000-8000-000000000001','authenticated','authenticated','exception-admin@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','40000000-0000-4000-8000-000000000002','authenticated','authenticated','exception-owner@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','40000000-0000-4000-8000-000000000003','authenticated','authenticated','exception-member@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','40000000-0000-4000-8000-000000000004','authenticated','authenticated','exception-outsider@example.test','',now(),'{}','{}',now(),now());
insert into public.households(id,name,created_by) values
('41000000-0000-4000-8000-000000000001','예외 테스트 가족','40000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,display_name,role,status,status_changed_by) values
('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','관리자','admin','active','40000000-0000-4000-8000-000000000001'),
('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','작성자','member','active','40000000-0000-4000-8000-000000000001'),
('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','구성원','member','active','40000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000002';
insert into public.calendar_events(id,household_id,owner_user_id,visibility,title,starts_at,ends_at,recurrence_frequency) values
('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','family','가족 반복','2026-08-27T00:00:00Z','2026-08-27T01:00:00Z','daily'),
('42000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','private','개인 반복','2026-08-27T00:00:00Z','2026-08-27T01:00:00Z','daily');
select lives_ok($$insert into public.calendar_event_exceptions(event_id,household_id,owner_user_id,original_starts_at,action) values ('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','2026-08-28T00:00:00Z','cancelled')$$,'owner cancels occurrence');
select lives_ok($$insert into public.calendar_event_exceptions(event_id,household_id,owner_user_id,original_starts_at,action,title,starts_at,ends_at,all_day,color) values ('42000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','2026-08-28T00:00:00Z','override','개인 변경','2026-08-28T02:00:00Z','2026-08-28T03:00:00Z',false,'blue')$$,'owner overrides private occurrence');

set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000001';
select is((select count(*) from public.calendar_event_exceptions),1::bigint,'admin sees family exception only');
select lives_ok($$insert into public.calendar_event_exceptions(event_id,household_id,owner_user_id,original_starts_at,action) values ('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','2026-08-29T00:00:00Z','cancelled')$$,'admin manages family occurrence');

set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000003';
select is((select count(*) from public.calendar_event_exceptions),2::bigint,'member sees family exceptions');
select throws_ok($$insert into public.calendar_event_exceptions(event_id,household_id,owner_user_id,original_starts_at,action) values ('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','2026-08-30T00:00:00Z','cancelled')$$,'42501',null,'member cannot manage another event');

set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000002';
select throws_ok($$insert into public.calendar_event_exceptions(event_id,household_id,owner_user_id,original_starts_at,action) values ('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','2026-08-30T00:00:00Z','cancelled')$$,'22023','CALENDAR_EXCEPTION_IDENTITY_INVALID','identity must match source event');
select throws_ok($$insert into public.calendar_event_exceptions(event_id,household_id,owner_user_id,original_starts_at,action,title,starts_at,ends_at,all_day,color) values ('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','2026-08-30T00:00:00Z','override','너무 멀리','2026-09-20T00:00:00Z','2026-09-20T01:00:00Z',false,'blue')$$,'23514',null,'override move is limited to seven days');

select * from finish();
rollback;
