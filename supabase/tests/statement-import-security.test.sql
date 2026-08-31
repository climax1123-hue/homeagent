begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

select has_table('public','ledger_import_batches','import batches table exists');
select has_table('public','ledger_import_rows','import rows table exists');
select ok((select relrowsecurity from pg_class where oid='public.ledger_import_batches'::regclass),'batch RLS enabled');
select table_privs_are('public','ledger_import_batches','anon',array[]::text[],'anon has no batch privileges');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','70000000-0000-4000-8000-000000000001','authenticated','authenticated','import-owner@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','70000000-0000-4000-8000-000000000002','authenticated','authenticated','import-member@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','70000000-0000-4000-8000-000000000003','authenticated','authenticated','import-outsider@example.test','',now(),'{}','{}',now(),now());
insert into public.households(id,name,created_by) values ('71000000-0000-4000-8000-000000000001','명세 테스트 가족','70000000-0000-4000-8000-000000000001');
insert into public.household_members(household_id,user_id,display_name,role,status,status_changed_by) values
('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','관리자','admin','active','70000000-0000-4000-8000-000000000001'),
('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002','구성원','member','active','70000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub='70000000-0000-4000-8000-000000000001';
insert into public.ledger_books(id,household_id,owner_user_id,visibility,name) values
('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','family','가족 장부'),
('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','private','개인 장부');
insert into public.ledger_accounts(id,book_id,household_id,owner_user_id,type,name) values
('73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','cash','가족 현금'),
('73000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','cash','개인 현금');

select lives_ok($$select * from public.commit_ledger_import('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','family.csv',repeat('a',64),'[{"sourceRowNumber":2,"fingerprint":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","type":"expense","amount":"12000","occurredOn":"2026-08-28","merchant":"테스트 마트","memo":""}]'::jsonb)$$,'owner imports one valid row');
select is((select count(*) from public.ledger_transactions where source='import'),1::bigint,'import creates one transaction');
select throws_ok($$select * from public.commit_ledger_import('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','family.csv',repeat('a',64),'[{"sourceRowNumber":2,"fingerprint":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","type":"expense","amount":"12000","occurredOn":"2026-08-28"}]'::jsonb)$$,'23505','FILE_ALREADY_IMPORTED','same file is rejected');

set local request.jwt.claim.sub='70000000-0000-4000-8000-000000000002';
select lives_ok($$select * from public.commit_ledger_import('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','member.csv',repeat('c',64),'[{"sourceRowNumber":2,"fingerprint":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","type":"income","amount":"1000","occurredOn":"2026-08-28"}]'::jsonb)$$,'active member imports to family book');
select is((select count(*) from public.ledger_import_batches),2::bigint,'member sees family batches only');
select throws_ok($$select * from public.commit_ledger_import('72000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000002','private.csv',repeat('e',64),'[{"sourceRowNumber":2,"fingerprint":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","type":"expense","amount":"100","occurredOn":"2026-08-28"}]'::jsonb)$$,'42501','IMPORT_ACCESS_DENIED','member cannot import to owner private book');

set local request.jwt.claim.sub='70000000-0000-4000-8000-000000000003';
select is((select count(*) from public.ledger_import_batches),0::bigint,'outsider sees no batches');
select is((select count(*) from public.ledger_import_rows),0::bigint,'outsider sees no rows');
select throws_ok($$select * from public.commit_ledger_import('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','outsider.csv',repeat('1',64),'[{"sourceRowNumber":2,"fingerprint":"2222222222222222222222222222222222222222222222222222222222222222","type":"expense","amount":"100","occurredOn":"2026-08-28"}]'::jsonb)$$,'42501','IMPORT_ACCESS_DENIED','outsider cannot import');

select * from finish();
rollback;
