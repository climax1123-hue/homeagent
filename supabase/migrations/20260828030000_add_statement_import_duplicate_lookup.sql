create or replace function public.find_ledger_import_duplicates(
  p_book_id uuid,
  p_account_id uuid,
  p_rows jsonb
) returns table(source_row_number integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.can_read_ledger_book(p_book_id) then
    raise exception 'IMPORT_ACCESS_DENIED' using errcode='42501';
  end if;
  if not exists(select 1 from public.ledger_accounts where id=p_account_id and book_id=p_book_id and is_active) then
    raise exception 'IMPORT_ACCESS_DENIED' using errcode='42501';
  end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>10000 then
    raise exception 'IMPORT_ROWS_INVALID' using errcode='22023';
  end if;
  return query
  select (candidate.value->>'sourceRowNumber')::integer
  from jsonb_array_elements(p_rows) candidate
  where exists (
    select 1 from public.ledger_transactions transaction
    where transaction.book_id=p_book_id
      and transaction.account_id=p_account_id
      and transaction.deleted_at is null
      and transaction.type::text=candidate.value->>'type'
      and transaction.amount=(candidate.value->>'amount')::bigint
      and (transaction.occurred_at at time zone 'Asia/Seoul')::date=(candidate.value->>'occurredOn')::date
      and lower(btrim(transaction.merchant))=lower(btrim(coalesce(candidate.value->>'merchant','')))
  );
end;$$;

revoke execute on function public.find_ledger_import_duplicates(uuid,uuid,jsonb) from public,anon;
grant execute on function public.find_ledger_import_duplicates(uuid,uuid,jsonb) to authenticated;
