alter function private.seed_ledger_demo_data(uuid) set schema public;
revoke all on function public.seed_ledger_demo_data(uuid) from public,anon,authenticated;
grant execute on function public.seed_ledger_demo_data(uuid) to service_role;
