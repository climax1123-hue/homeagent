begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(13);

select has_table('public','ledger_classification_rules','classification rules table exists');
select has_table('public','ledger_statement_profiles','statement profiles table exists');
select ok((select relrowsecurity from pg_class where oid='public.ledger_classification_rules'::regclass),'rule RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.ledger_statement_profiles'::regclass),'profile RLS enabled');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','80000000-0000-4000-8000-000000000001','authenticated','authenticated','class-admin@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','80000000-0000-4000-8000-000000000002','authenticated','authenticated','class-member@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','80000000-0000-4000-8000-000000000003','authenticated','authenticated','class-outsider@example.test','',now(),'{}','{}',now(),now());
insert into public.households(id,name,created_by) values ('81000000-0000-4000-8000-000000000001','분류 테스트 가족','80000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,display_name,role,status,status_changed_by) values
('81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','관리자','admin','active','80000000-0000-4000-8000-000000000001'),
('81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002','구성원','member','active','80000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub='80000000-0000-4000-8000-000000000001';
insert into public.ledger_books(id,household_id,owner_user_id,visibility,name) values
('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','family','가족 장부'),
('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','private','관리자 개인 장부');
insert into public.ledger_categories(id,book_id,household_id,type,name,created_by) values
('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','expense','카페','80000000-0000-4000-8000-000000000001'),
('83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000001','expense','개인 카페','80000000-0000-4000-8000-000000000001');
select lives_ok($$insert into public.ledger_classification_rules(household_id,book_id,transaction_type,target_field,match_type,keyword,category_id,created_by) values ('81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','expense','merchant','contains','스타벅스','83000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001')$$,'admin creates family rule');
select lives_ok($$insert into public.ledger_statement_profiles(household_id,book_id,name,header_signature,mapping,encoding,created_by) values ('81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','테스트 은행',repeat('a',64),'{"occurredOn":0,"expense":2}'::jsonb,'utf-8','80000000-0000-4000-8000-000000000001')$$,'admin creates family profile');
select throws_ok($$insert into public.ledger_classification_rules(household_id,book_id,transaction_type,target_field,match_type,keyword,category_id,created_by) values ('81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','income','merchant','contains','잘못된 유형','83000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001')$$,'22023','CLASSIFICATION_CATEGORY_INVALID','category type mismatch is rejected');

set local request.jwt.claim.sub='80000000-0000-4000-8000-000000000002';
select is((select count(*) from public.ledger_classification_rules),1::bigint,'member reads family rules');
select is((select count(*) from public.ledger_statement_profiles),1::bigint,'member reads family profiles');
select throws_ok($$insert into public.ledger_classification_rules(household_id,book_id,transaction_type,target_field,match_type,keyword,category_id,created_by) values ('81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','expense','merchant','contains','구성원 변경','83000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002')$$,'42501',null,'member cannot manage family rules');

set local request.jwt.claim.sub='80000000-0000-4000-8000-000000000001';
select lives_ok($$insert into public.ledger_classification_rules(household_id,book_id,transaction_type,target_field,match_type,keyword,category_id,created_by) values ('81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002','expense','merchant','exact','개인 결제','83000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000001')$$,'owner manages private rule');

set local request.jwt.claim.sub='80000000-0000-4000-8000-000000000003';
select is((select count(*) from public.ledger_classification_rules),0::bigint,'outsider sees no rules');
select is((select count(*) from public.ledger_statement_profiles),0::bigint,'outsider sees no profiles');

select * from finish();
rollback;
