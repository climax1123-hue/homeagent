begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(7);
select has_function('public','get_ledger_dashboard',array['uuid','date','date'],'dashboard RPC exists');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000001','authenticated','authenticated','dash-admin@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000002','authenticated','authenticated','dash-member@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000003','authenticated','authenticated','dash-out@example.test','',now(),'{}','{}',now(),now());
insert into public.households(id,name,created_by) values('82000000-0000-4000-8000-000000000001','대시보드 가족','81000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,display_name,role,status,status_changed_by) values
('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','관리자','admin','active','81000000-0000-4000-8000-000000000001'),
('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','구성원','member','active','81000000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='81000000-0000-4000-8000-000000000001';
insert into public.ledger_books(id,household_id,owner_user_id,visibility,name) values
('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','family','가족 장부'),
('83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','private','개인 장부');
insert into public.ledger_accounts(id,book_id,household_id,owner_user_id,type,name) values('84000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','cash','현금');
insert into public.ledger_categories(id,book_id,household_id,type,name,created_by) values('85000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','expense','식비','81000000-0000-4000-8000-000000000001');
insert into public.ledger_transactions(book_id,household_id,type,amount,occurred_at,account_id,category_id,payer_user_id,created_by,updated_by,client_request_id,merchant) values('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','expense',12345678901234567,'2026-08-15T00:00:00Z','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001',gen_random_uuid(),'마트');

select is(public.get_ledger_dashboard('83000000-0000-4000-8000-000000000001','2026-08-01','2026-08-31')->'summary'->>'expenseTotal','12345678901234567','money is returned without precision loss');
select ok(jsonb_typeof(public.get_ledger_dashboard('83000000-0000-4000-8000-000000000001','2026-08-01','2026-08-31')->'categories')='array','category aggregation is an array');
set local request.jwt.claim.sub='81000000-0000-4000-8000-000000000002';
select lives_ok($$select public.get_ledger_dashboard('83000000-0000-4000-8000-000000000001','2026-08-01','2026-08-31')$$,'family member reads family dashboard');
select throws_ok($$select public.get_ledger_dashboard('83000000-0000-4000-8000-000000000002','2026-08-01','2026-08-31')$$,'42501','LEDGER_DASHBOARD_ACCESS_DENIED','member cannot read owner private dashboard');
set local request.jwt.claim.sub='81000000-0000-4000-8000-000000000003';
select throws_ok($$select public.get_ledger_dashboard('83000000-0000-4000-8000-000000000001','2026-08-01','2026-08-31')$$,'42501','LEDGER_DASHBOARD_ACCESS_DENIED','outsider cannot read family dashboard');
set local request.jwt.claim.sub='81000000-0000-4000-8000-000000000001';
select throws_ok($$select public.get_ledger_dashboard('83000000-0000-4000-8000-000000000001','2024-01-01','2026-08-31')$$,'22023','LEDGER_DASHBOARD_RANGE_TOO_LARGE','range is capped');
select * from finish();
rollback;
