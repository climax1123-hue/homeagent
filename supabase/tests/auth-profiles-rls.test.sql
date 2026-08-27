begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

select has_table('public', 'profiles', 'profiles exists');
select col_is_pk('public', 'profiles', 'user_id', 'user_id is primary key');
select policies_are('public', 'profiles', array['profiles_select_own', 'profiles_update_own'], 'only own policies exist');
select table_privs_are('public', 'profiles', 'anon', array[]::text[], 'anon has no privileges');
select table_privs_are('public', 'profiles', 'authenticated', array['SELECT', 'UPDATE'], 'authenticated has minimum privileges');
select function_privs_are('private', 'handle_new_auth_user', array[]::text[], 'public', array[]::text[], 'trigger function is not executable through API');
select function_returns('private', 'handle_new_auth_user', array[]::text[], 'trigger', 'provisioning returns trigger');
select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true, 'RLS is enabled');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('00000000-0000-0000-0000-000000000000','20000000-0000-4000-8000-000000000001','authenticated','authenticated','profile-owner@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','20000000-0000-4000-8000-000000000002','authenticated','authenticated','profile-other@example.test','',now(),'{}','{}',now(),now());

select is((select count(*) from public.profiles where user_id::text like '20000000-%'), 2::bigint, 'trigger provisions profiles');

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';
select is((select count(*) from public.profiles), 1::bigint, 'user selects only own profile');
select lives_ok($$update public.profiles set timezone = 'Asia/Seoul' where user_id = '20000000-0000-4000-8000-000000000001'$$, 'user updates own profile');
select is((select count(*) from public.profiles where user_id = '20000000-0000-4000-8000-000000000002'), 0::bigint, 'other profile remains invisible');
select throws_ok($$insert into public.profiles (user_id) values ('20000000-0000-4000-8000-000000000003')$$, '42501', 'permission denied for table profiles', 'client insert is denied');
select throws_ok($$delete from public.profiles where user_id = '20000000-0000-4000-8000-000000000001'$$, '42501', 'permission denied for table profiles', 'client delete is denied');
reset role;

select * from finish();
rollback;
