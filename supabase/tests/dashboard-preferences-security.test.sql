begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(9);
select has_table('public','dashboard_preferences','dashboard preferences exists');
select ok((select relrowsecurity from pg_class where oid='public.dashboard_preferences'::regclass),'dashboard preferences has RLS');
select table_privs_are('public','dashboard_preferences','authenticated',array['SELECT','INSERT','UPDATE'],'only required privileges are granted');
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','94000000-0000-4000-8000-000000000001','authenticated','authenticated','dash-admin@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','94000000-0000-4000-8000-000000000002','authenticated','authenticated','dash-member@example.test','',now(),'{}','{}',now(),now());
insert into public.households(id,name,created_by) values('95000000-0000-4000-8000-000000000001','대시보드 가족','94000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,display_name,role,status,status_changed_by) values
('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','관리자','admin','active','94000000-0000-4000-8000-000000000001'),
('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002','구성원','member','active','94000000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='94000000-0000-4000-8000-000000000002';
select lives_ok($$insert into public.dashboard_preferences(household_id,user_id) values('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002')$$,'member saves own preference');
select is((select count(*) from public.dashboard_preferences),1::bigint,'member sees own preference');
select throws_ok($$insert into public.dashboard_preferences(household_id,user_id) values('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001')$$,'42501','DASHBOARD_PREFERENCE_OWNER_REQUIRED','member cannot write another preference');
select throws_ok($$update public.dashboard_preferences set widget_order=array['schedule','schedule','ddays','goals','quick_actions'] where user_id='94000000-0000-4000-8000-000000000002'$$,'23514','DASHBOARD_WIDGET_ORDER_INVALID','duplicate widget is rejected');
set local request.jwt.claim.sub='94000000-0000-4000-8000-000000000001';
select is((select count(*) from public.dashboard_preferences),0::bigint,'admin cannot see member preference');
select is((select count(*) from public.dashboard_preferences where user_id='94000000-0000-4000-8000-000000000002'),0::bigint,'admin cannot update member preference');
select * from finish();
rollback;
