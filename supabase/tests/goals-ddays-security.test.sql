begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);
select has_table('public','goals','goals exists');
select has_table('public','ddays','ddays exists');
select ok((select relrowsecurity from pg_class where oid='public.goals'::regclass),'goals has RLS');
select ok((select relrowsecurity from pg_class where oid='public.ddays'::regclass),'ddays has RLS');
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','90000000-0000-4000-8000-000000000001','authenticated','authenticated','life-admin@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','90000000-0000-4000-8000-000000000002','authenticated','authenticated','life-member@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','90000000-0000-4000-8000-000000000003','authenticated','authenticated','life-out@example.test','',now(),'{}','{}',now(),now());
insert into public.households(id,name,created_by) values('91000000-0000-4000-8000-000000000001','목표 가족','90000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,display_name,role,status,status_changed_by) values
('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','관리자','admin','active','90000000-0000-4000-8000-000000000001'),
('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','구성원','member','active','90000000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000002';
insert into public.goals(id,household_id,owner_user_id,visibility,title) values
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','family','가족 목표'),
('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','private','개인 목표');
insert into public.ddays(id,household_id,owner_user_id,visibility,title,target_date) values
('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','family','가족 기념일','2026-10-01'),
('93000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','private','개인 기념일','2026-10-02');
select is((select count(*) from public.goals),2::bigint,'owner sees both goals');
select is((select count(*) from public.ddays),2::bigint,'owner sees both ddays');
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000001';
select is((select count(*) from public.goals),1::bigint,'admin cannot see member private goal');
select is((select count(*) from public.ddays),1::bigint,'admin cannot see member private dday');
select lives_ok($$update public.goals set progress=10 where id='92000000-0000-4000-8000-000000000001'$$,'admin updates family goal');
select lives_ok($$delete from public.ddays where id='93000000-0000-4000-8000-000000000001'$$,'admin deletes family dday');
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000003';
select is((select count(*) from public.goals),0::bigint,'outsider sees no goals');
select is((select count(*) from public.ddays),0::bigint,'outsider sees no ddays');
select * from finish();
rollback;
