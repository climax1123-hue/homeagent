begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select ok((select relrowsecurity from pg_class where oid='public.google_calendar_connections'::regclass),'connection RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.google_oauth_states'::regclass),'OAuth state RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.calendar_google_event_links'::regclass),'link RLS enabled');
select table_privs_are('public','google_oauth_states','authenticated',array[]::text[],'OAuth states are server-only');
select table_privs_are('public','google_calendar_connections','authenticated',array[]::text[],'connections expose only selected safe columns');
select ok(has_column_privilege('authenticated','public.google_calendar_connections','google_account_email','select'),'safe connection metadata is selectable');
select ok(not has_column_privilege('authenticated','public.google_calendar_connections','refresh_token_ciphertext','select'),'encrypted refresh token is not selectable');
select table_privs_are('public','calendar_google_event_links','authenticated',array['SELECT'],'links are read-only');
select ok(not has_table_privilege('anon','public.google_calendar_connections','select'),'anon cannot read connections');
select ok(has_column_privilege('authenticated','public.google_calendar_connections','auto_sync_enabled','select'),'automatic sync preference is selectable');
select ok(has_column_privilege('authenticated','public.google_calendar_connections','auto_sync_enabled','update'),'automatic sync preference is editable');
select ok(not has_column_privilege('authenticated','public.google_calendar_connections','refresh_token_ciphertext','update'),'encrypted refresh token is not editable');

select * from finish();
rollback;
