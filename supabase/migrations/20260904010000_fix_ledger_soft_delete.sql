create or replace function public.soft_delete_ledger_transaction(p_transaction_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction public.ledger_transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'LEDGER_TRANSACTION_AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into strict v_transaction
  from public.ledger_transactions
  where id = p_transaction_id;

  if v_transaction.deleted_at is not null then
    return;
  end if;

  if v_transaction.created_by <> v_user_id
    and not private.can_manage_ledger_book(v_transaction.book_id) then
    raise exception 'LEDGER_TRANSACTION_DELETE_DENIED' using errcode = '42501';
  end if;

  update public.ledger_transactions
  set deleted_at = now(), updated_by = v_user_id
  where id = p_transaction_id;
exception
  when no_data_found then
    raise exception 'LEDGER_TRANSACTION_NOT_FOUND' using errcode = 'P0002';
end;
$$;

revoke all on function public.soft_delete_ledger_transaction(uuid) from public, anon;
grant execute on function public.soft_delete_ledger_transaction(uuid) to authenticated;

comment on function public.soft_delete_ledger_transaction(uuid) is
  'Soft deletes one ledger transaction after author or ledger-manager authorization.';
