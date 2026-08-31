begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

select has_table('public','ledger_books','ledger books table exists');
select has_table('public','ledger_accounts','ledger accounts table exists');
select has_table('public','ledger_categories','ledger categories table exists');
select has_table('public','ledger_transactions','ledger transactions table exists');
select ok((select relrowsecurity from pg_class where oid='public.ledger_transactions'::regclass),'transaction RLS enabled');
select table_privs_are('public','ledger_transactions','anon',array[]::text[],'anon has no transaction privileges');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','60000000-0000-4000-8000-000000000001','authenticated','authenticated','ledger-admin@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','60000000-0000-4000-8000-000000000002','authenticated','authenticated','ledger-member@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','60000000-0000-4000-8000-000000000003','authenticated','authenticated','ledger-outsider@example.test','',now(),'{}','{}',now(),now());
insert into public.households(id,name,created_by) values
('61000000-0000-4000-8000-000000000001','원장 테스트 가족','60000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,display_name,role,status,status_changed_by) values
('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','관리자','admin','active','60000000-0000-4000-8000-000000000001'),
('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','구성원','member','active','60000000-0000-4000-8000-000000000001');
set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000001';
select private.seed_ledger_payment_codes('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000001';
select lives_ok($$insert into public.ledger_books(id,household_id,owner_user_id,visibility,name) values ('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','family','가족 장부')$$,'admin creates family book');
select lives_ok($$insert into public.ledger_books(id,household_id,owner_user_id,visibility,name) values ('62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','private','관리자 개인')$$,'admin creates private book');
select lives_ok($$insert into public.ledger_accounts(id,book_id,household_id,owner_user_id,type,name,opening_balance) values ('63000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','cash','가족 현금',1000),('63000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','cash','개인 현금',0)$$,'admin creates family and private accounts');
select lives_ok($$insert into public.ledger_categories(id,book_id,household_id,type,name,created_by) values ('64000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','income','급여','60000000-0000-4000-8000-000000000001'),('64000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','expense','식비','60000000-0000-4000-8000-000000000001')$$,'admin creates categories');
select lives_ok($$insert into public.ledger_transactions(id,book_id,household_id,type,amount,occurred_at,account_id,category_id,payer_user_id,created_by,updated_by,client_request_id,merchant) values ('65000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','income',500,'2026-08-15T00:00:00Z','63000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000011','급여')$$,'admin records family income');

set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000002';
select is((select count(*) from public.ledger_books),1::bigint,'member sees family book but not admin private book');
select lives_ok($$insert into public.ledger_accounts(id,book_id,household_id,owner_user_id,type,name) values ('63000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','debit_card','구성원 카드')$$,'member creates own family account');
select lives_ok($$insert into public.ledger_transactions(id,book_id,household_id,type,amount,occurred_at,account_id,category_id,payer_user_id,created_by,updated_by,client_request_id,merchant) values ('65000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','expense',200,'2026-08-16T00:00:00Z','63000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','65000000-0000-4000-8000-000000000012','마트')$$,'member records family expense');
select lives_ok($$update public.ledger_transactions set merchant='변조' where id='65000000-0000-4000-8000-000000000001'$$,'unauthorized update is safely filtered');
select is((select merchant from public.ledger_transactions where id='65000000-0000-4000-8000-000000000001'),'급여','member cannot modify another family transaction');
select lives_ok($$insert into public.ledger_books(id,household_id,owner_user_id,visibility,name) values ('62000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','private','구성원 개인')$$,'member creates private book');

set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000001';
select is((select count(*) from public.ledger_books),2::bigint,'admin cannot see member private book');
select throws_ok($$insert into public.ledger_transactions(book_id,household_id,type,amount,occurred_at,account_id,category_id,payer_user_id,created_by,updated_by,client_request_id) values ('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','expense',100,'2026-08-17T00:00:00Z','63000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000013')$$,'22023','LEDGER_TRANSACTION_ACCOUNT_INVALID','cross-book account is rejected');
select is((select balance from public.get_ledger_account_balances('62000000-0000-4000-8000-000000000001') where account_id='63000000-0000-4000-8000-000000000001'),'1300','balance uses integer income and expense movements');
select is((select income_total from public.get_ledger_month_summary('62000000-0000-4000-8000-000000000001','2026-08-01')),'500','month income summary is text');
select is((select expense_total from public.get_ledger_month_summary('62000000-0000-4000-8000-000000000001','2026-08-01')),'200','month expense summary is text');
select lives_ok($$update public.ledger_transactions set deleted_at=now() where id='65000000-0000-4000-8000-000000000002'$$,'admin soft deletes family transaction');
select is((select expense_total from public.get_ledger_month_summary('62000000-0000-4000-8000-000000000001','2026-08-01')),'0','soft-deleted transaction is excluded');

set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000003';
select is((select count(*) from public.ledger_books),0::bigint,'outsider sees no ledger books');
select is((select count(*) from public.ledger_transactions),0::bigint,'outsider sees no transactions');

select * from finish();
rollback;
