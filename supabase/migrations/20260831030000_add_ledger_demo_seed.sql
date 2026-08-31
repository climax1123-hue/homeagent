create or replace function private.seed_ledger_demo_data(p_user_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_household_id uuid;
  v_book_id uuid;
  v_cash_id uuid;
  v_card_id uuid;
  v_bank_id uuid;
  v_inserted integer;
begin
  select m.household_id into strict v_household_id
  from public.household_members m
  where m.user_id=p_user_id and m.role='admin' and m.status='active'
  order by m.created_at desc limit 1;

  perform set_config('request.jwt.claim.sub',p_user_id::text,true);
  perform private.seed_ledger_payment_codes(v_household_id,p_user_id);

  select b.id into v_book_id from public.ledger_books b
  where b.household_id=v_household_id and b.visibility='family' and b.is_active limit 1;
  if v_book_id is null then
    v_book_id:=public.create_default_ledger_book(v_household_id,'family','우리집 가계부');
  end if;

  select a.id into v_cash_id from public.ledger_accounts a where a.book_id=v_book_id and a.type='cash' and a.is_active order by a.sort_order limit 1;
  insert into public.ledger_accounts(book_id,household_id,owner_user_id,type,name,sort_order)
  values(v_book_id,v_household_id,p_user_id,'credit_card','생활비 카드',20)
  on conflict(book_id,name) do update set is_active=true returning id into v_card_id;
  insert into public.ledger_accounts(book_id,household_id,owner_user_id,type,name,sort_order)
  values(v_book_id,v_household_id,p_user_id,'bank','주거비 계좌',30)
  on conflict(book_id,name) do update set is_active=true returning id into v_bank_id;

  with months as (
    select g, (date_trunc('month',now() at time zone 'Asia/Seoul')-make_interval(months=>g))::date month_start
    from generate_series(0,7) g
  ), synthetic(type,amount,day_no,account_id,category_name,merchant,memo,series_key) as (
    select 'income'::public.ledger_transaction_type,4500000::bigint,1,v_bank_id,'급여','우리회사','합성 데모 급여','salary' union all
    select 'expense',600000,5,v_card_id,'식비','우리마트','합성 데모 생활비','mart' union all
    select 'expense',900000,2,v_bank_id,'주거','우리집 임대료','합성 데모 고정비','housing' union all
    select 'expense',120000,8,v_card_id,'교통','대중교통','합성 데모 교통비','transport' union all
    select 'expense',17000,12,v_card_id,'문화·여가','스트리밍 구독','합성 데모 정기구독','streaming' union all
    select 'expense',180000,17,v_card_id,'생활','생활용품점','합성 데모 생활비','living' union all
    select 'expense',80000,22,v_cash_id,'건강','동네 약국','합성 데모 건강비','health'
  ), rows_to_insert as (
    select s.type,
      case when s.type='expense' then s.amount+(m.g*10000) else s.amount end amount,
      ((m.month_start+(s.day_no-1))::timestamp at time zone 'Asia/Seoul') occurred_at,
      s.account_id,c.id category_id,s.merchant,s.memo,
      (md5('home-demo-'||p_user_id::text||'-'||m.g::text||'-'||s.series_key))::uuid request_id
    from months m cross join synthetic s
    join public.ledger_categories c on c.book_id=v_book_id and c.type::text=s.type::text and c.name=s.category_name and c.is_active
  )
  insert into public.ledger_transactions(book_id,household_id,type,amount,occurred_at,account_id,category_id,merchant,memo,payer_user_id,created_by,updated_by,client_request_id)
  select v_book_id,v_household_id,r.type,r.amount,r.occurred_at,r.account_id,r.category_id,r.merchant,r.memo,p_user_id,p_user_id,p_user_id,r.request_id
  from rows_to_insert r on conflict(created_by,client_request_id) do nothing;
  get diagnostics v_inserted=row_count;
  return jsonb_build_object('householdId',v_household_id,'bookId',v_book_id,'insertedTransactions',v_inserted);
exception when no_data_found then
  raise exception 'DEMO_SEED_ACTIVE_ADMIN_REQUIRED' using errcode='42501';
end;
$$;

revoke all on function private.seed_ledger_demo_data(uuid) from public,anon,authenticated;
grant execute on function private.seed_ledger_demo_data(uuid) to service_role;
comment on function private.seed_ledger_demo_data(uuid) is 'Idempotent synthetic ledger demo data for an active household admin; service-role maintenance only.';
