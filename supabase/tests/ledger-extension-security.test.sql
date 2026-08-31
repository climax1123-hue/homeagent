begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','70000000-0000-4000-8000-000000000001','authenticated','authenticated','ledger-ext-admin@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','70000000-0000-4000-8000-000000000002','authenticated','authenticated','ledger-ext-member@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','70000000-0000-4000-8000-000000000003','authenticated','authenticated','ledger-ext-outsider@example.test','',now(),'{}','{}',now(),now());
insert into public.households(id,name,created_by) values ('71000000-0000-4000-8000-000000000001','가계부 확장 테스트','70000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,display_name,role,status,status_changed_by) values
('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','관리자','admin','active','70000000-0000-4000-8000-000000000001'),
('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002','구성원','member','active','70000000-0000-4000-8000-000000000001');

select has_table('public','common_codes','common code table exists');
select ok((select relrowsecurity from pg_class where oid='public.common_codes'::regclass),'common code RLS enabled');
select table_privs_are('public','common_codes','anon',array[]::text[],'anon has no code privileges');

set local role authenticated;
set local request.jwt.claim.sub='70000000-0000-4000-8000-000000000001';
select lives_ok($$select public.create_default_ledger_book('71000000-0000-4000-8000-000000000001','family','확장 장부')$$,'admin creates seeded ledger');
select is((select count(*) from public.common_codes where household_id='71000000-0000-4000-8000-000000000001' and group_key='payment_method_type'),5::bigint,'five payment codes seeded');
select lives_ok($$insert into public.common_codes(household_id,group_key,group_label,code,label,sort_order,created_by,is_admin_editable) values ('71000000-0000-4000-8000-000000000001','payment_method_type','결제수단 유형','prepaid','선불카드',60,'70000000-0000-4000-8000-000000000001',true)$$,'admin creates custom code');
select throws_ok($$update public.common_codes set label='최고 관리자' where household_id='71000000-0000-4000-8000-000000000001' and group_key='household_role' and code='admin'$$,'42501','COMMON_CODE_GROUP_LOCKED','locked system code rejects admin update');
select lives_ok($$insert into public.ledger_accounts(book_id,household_id,owner_user_id,type,name) select id,household_id,'70000000-0000-4000-8000-000000000001','credit_card','테스트 카드' from public.ledger_books where household_id='71000000-0000-4000-8000-000000000001'$$,'credit-card account uses common code');
select lives_ok($$select public.create_ledger_installment(b.id,1200000,3,'2026-08-27',a.id,c.id,'할부 테스트','', '70000000-0000-4000-8000-000000000001') from public.ledger_books b join public.ledger_accounts a on a.book_id=b.id and a.name='테스트 카드' join public.ledger_categories c on c.book_id=b.id and c.name='생활' where b.household_id='71000000-0000-4000-8000-000000000001'$$,'three-month installment is created atomically');
select is((select count(*) from public.ledger_transactions where installment_group_id is not null),3::bigint,'installment creates three rows');
select is((select sum(amount)::text from public.ledger_transactions where installment_group_id is not null),'1200000','installment sum equals original total');
select results_eq($$select amount::text from public.ledger_transactions where installment_group_id is not null order by installment_number$$,$$values ('400000'),('400000'),('400000')$$,'installment amounts are equal');
select results_eq($$select (occurred_at at time zone 'Asia/Seoul')::date::text from public.ledger_transactions where installment_group_id is not null order by installment_number$$,$$values ('2026-08-27'),('2026-09-27'),('2026-10-27')$$,'installment dates advance monthly');

set local request.jwt.claim.sub='70000000-0000-4000-8000-000000000003';
select is((select count(*) from public.common_codes),0::bigint,'outsider sees no common codes');
set local request.jwt.claim.sub='70000000-0000-4000-8000-000000000002';
select throws_ok($$insert into public.common_codes(household_id,group_key,group_label,code,label,sort_order,created_by,is_admin_editable) values ('71000000-0000-4000-8000-000000000001','payment_method_type','결제수단 유형','voucher','상품권',70,'70000000-0000-4000-8000-000000000002',true)$$,'42501',null,'member cannot create common code');
select * from finish();
rollback;
