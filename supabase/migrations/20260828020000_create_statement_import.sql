create table public.ledger_import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  book_id uuid not null references public.ledger_books(id) on delete cascade,
  account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  display_filename text not null check (display_filename=btrim(display_filename) and char_length(display_filename) between 1 and 180 and display_filename !~ '[\\/]'),
  file_fingerprint text not null check (file_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'committed' check (status in ('committed','failed')),
  total_rows integer not null check (total_rows between 1 and 10000),
  committed_rows integer not null check (committed_rows between 0 and total_rows),
  created_at timestamptz not null default now(), committed_at timestamptz,
  unique(created_by,book_id,account_id,file_fingerprint)
);

create table public.ledger_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.ledger_import_batches(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  book_id uuid not null references public.ledger_books(id) on delete cascade,
  source_row_number integer not null check (source_row_number between 2 and 10001),
  row_fingerprint text not null check (row_fingerprint ~ '^[0-9a-f]{64}$'),
  transaction_id uuid not null references public.ledger_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(batch_id,source_row_number), unique(batch_id,row_fingerprint)
);
create index ledger_import_batches_book_created_idx on public.ledger_import_batches(book_id,created_at desc);
create index ledger_import_rows_transaction_idx on public.ledger_import_rows(transaction_id);

alter table public.ledger_import_batches enable row level security;
alter table public.ledger_import_rows enable row level security;
revoke all on public.ledger_import_batches,public.ledger_import_rows from anon,authenticated;
grant select on public.ledger_import_batches,public.ledger_import_rows to authenticated;
create policy ledger_import_batches_select on public.ledger_import_batches for select to authenticated using (private.can_read_ledger_book(book_id));
create policy ledger_import_rows_select on public.ledger_import_rows for select to authenticated using (private.can_read_ledger_book(book_id));

create or replace function public.commit_ledger_import(
  p_book_id uuid,p_account_id uuid,p_display_filename text,p_file_fingerprint text,p_rows jsonb
) returns table(batch_id uuid,committed_rows integer)
language plpgsql volatile security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_household uuid;v_batch uuid;v_row jsonb;v_transaction uuid;v_count integer:=0;v_total integer;
begin
  if v_user is null or not private.can_read_ledger_book(p_book_id) then raise exception 'IMPORT_ACCESS_DENIED' using errcode='42501'; end if;
  select household_id into strict v_household from public.ledger_books where id=p_book_id and is_active;
  if not exists(select 1 from public.ledger_accounts where id=p_account_id and book_id=p_book_id and household_id=v_household and is_active) then raise exception 'IMPORT_ACCESS_DENIED' using errcode='42501'; end if;
  if btrim(p_display_filename)='' or char_length(btrim(p_display_filename))>180 or btrim(p_display_filename)~'[\\/]' or p_file_fingerprint!~'^[0-9a-f]{64}$' then raise exception 'IMPORT_FILE_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'IMPORT_ROWS_INVALID' using errcode='22023'; end if;
  v_total:=jsonb_array_length(p_rows);if v_total not between 1 and 10000 then raise exception 'IMPORT_ROWS_INVALID' using errcode='22023';end if;
  insert into public.ledger_import_batches(household_id,book_id,account_id,created_by,display_filename,file_fingerprint,total_rows,committed_rows)
  values(v_household,p_book_id,p_account_id,v_user,btrim(p_display_filename),p_file_fingerprint,v_total,0) returning id into v_batch;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if (v_row->>'sourceRowNumber')::integer not between 2 and 10001 or coalesce(v_row->>'fingerprint','')!~'^[0-9a-f]{64}$' or coalesce(v_row->>'type','') not in ('income','expense') or coalesce(v_row->>'amount','')!~'^[1-9][0-9]*$' or coalesce(v_row->>'occurredOn','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'IMPORT_ROW_INVALID' using errcode='22023';end if;
    insert into public.ledger_transactions(book_id,household_id,type,amount,occurred_at,account_id,category_id,merchant,memo,payer_user_id,created_by,updated_by,source,client_request_id)
    values(p_book_id,v_household,(v_row->>'type')::public.ledger_transaction_type,(v_row->>'amount')::bigint,(v_row->>'occurredOn')::date::timestamp at time zone 'Asia/Seoul',p_account_id,nullif(v_row->>'categoryId','')::uuid,left(btrim(coalesce(v_row->>'merchant','')),120),left(coalesce(v_row->>'memo',''),500),v_user,v_user,v_user,'import',gen_random_uuid()) returning id into v_transaction;
    insert into public.ledger_import_rows(batch_id,household_id,book_id,source_row_number,row_fingerprint,transaction_id) values(v_batch,v_household,p_book_id,(v_row->>'sourceRowNumber')::integer,v_row->>'fingerprint',v_transaction);
    v_count:=v_count+1;
  end loop;
  update public.ledger_import_batches set committed_rows=v_count,committed_at=now() where id=v_batch;
  return query select v_batch,v_count;
exception when unique_violation then raise exception 'FILE_ALREADY_IMPORTED' using errcode='23505';
end;$$;
revoke execute on function public.commit_ledger_import(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.commit_ledger_import(uuid,uuid,text,text,jsonb) to authenticated;
comment on table public.ledger_import_batches is 'Metadata-only ledger statement imports; original files are not stored.';
