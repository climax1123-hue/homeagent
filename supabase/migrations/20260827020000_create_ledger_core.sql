create type public.ledger_visibility as enum ('family', 'private');
create type public.ledger_account_type as enum ('cash', 'bank', 'debit_card', 'credit_card', 'other');
create type public.ledger_transaction_type as enum ('income', 'expense', 'transfer');
create type public.ledger_transaction_source as enum ('manual', 'import');
create type public.ledger_category_type as enum ('income', 'expense');

create table public.ledger_books (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  visibility public.ledger_visibility not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  currency text not null default 'KRW' check (currency = 'KRW'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ledger_books_one_family_active_idx
on public.ledger_books (household_id) where visibility = 'family' and is_active;
create unique index ledger_books_one_private_active_idx
on public.ledger_books (household_id, owner_user_id) where visibility = 'private' and is_active;

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.ledger_books (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  type public.ledger_account_type not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  opening_balance bigint not null default 0,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, name)
);

create table public.ledger_categories (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.ledger_books (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  type public.ledger_category_type not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 40),
  icon text not null default 'tag' check (char_length(icon) between 1 and 40),
  color text not null default 'blue' check (color in ('blue','green','orange','pink','purple','gray')),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ledger_categories_book_type_name_idx
on public.ledger_categories (book_id, type, lower(name));

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.ledger_books (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  type public.ledger_transaction_type not null,
  amount bigint not null check (amount > 0),
  occurred_at timestamptz not null,
  account_id uuid not null references public.ledger_accounts (id) on delete restrict,
  transfer_account_id uuid references public.ledger_accounts (id) on delete restrict,
  category_id uuid references public.ledger_categories (id) on delete restrict,
  merchant text not null default '' check (merchant = btrim(merchant) and char_length(merchant) <= 120),
  memo text not null default '' check (char_length(memo) <= 500),
  payer_user_id uuid not null references auth.users (id) on delete restrict,
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid not null references auth.users (id) on delete restrict,
  source public.ledger_transaction_source not null default 'manual',
  client_request_id uuid not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, client_request_id),
  constraint ledger_transactions_shape check (
    (type in ('income','expense') and transfer_account_id is null)
    or
    (type = 'transfer' and transfer_account_id is not null and transfer_account_id <> account_id and category_id is null)
  )
);

create index ledger_accounts_book_active_idx on public.ledger_accounts (book_id, is_active, sort_order);
create index ledger_categories_book_active_idx on public.ledger_categories (book_id, is_active, type, sort_order);
create index ledger_transactions_book_occurred_idx
on public.ledger_transactions (book_id, occurred_at desc) where deleted_at is null;
create index ledger_transactions_book_account_idx
on public.ledger_transactions (book_id, account_id, occurred_at desc) where deleted_at is null;
create index ledger_transactions_book_payer_idx
on public.ledger_transactions (book_id, payer_user_id, occurred_at desc) where deleted_at is null;

create trigger ledger_books_touch_updated_at before update on public.ledger_books
for each row execute function private.touch_updated_at();
create trigger ledger_accounts_touch_updated_at before update on public.ledger_accounts
for each row execute function private.touch_updated_at();
create trigger ledger_categories_touch_updated_at before update on public.ledger_categories
for each row execute function private.touch_updated_at();
create trigger ledger_transactions_touch_updated_at before update on public.ledger_transactions
for each row execute function private.touch_updated_at();

create or replace function private.can_read_ledger_book(p_book_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ledger_books b
    where b.id = p_book_id and b.is_active and (
      (b.visibility = 'family' and private.is_active_household_member(b.household_id))
      or (b.visibility = 'private' and b.owner_user_id = auth.uid())
    )
  );
$$;

create or replace function private.can_manage_ledger_book(p_book_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ledger_books b
    where b.id = p_book_id and (
      (b.visibility = 'family' and private.is_active_household_admin(b.household_id))
      or (b.visibility = 'private' and b.owner_user_id = auth.uid())
    )
  );
$$;

create or replace function private.validate_ledger_book()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.owner_user_id <> auth.uid() or not private.is_active_household_member(new.household_id) then
      raise exception 'LEDGER_BOOK_IDENTITY_INVALID' using errcode = '22023';
    end if;
    if new.visibility = 'family' and not private.is_active_household_admin(new.household_id) then
      raise exception 'LEDGER_BOOK_ADMIN_REQUIRED' using errcode = '42501';
    end if;
  elsif new.household_id <> old.household_id or new.owner_user_id <> old.owner_user_id
    or new.visibility <> old.visibility then
    raise exception 'LEDGER_BOOK_IDENTITY_IMMUTABLE' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function private.validate_ledger_account()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_book public.ledger_books%rowtype;
begin
  select * into strict v_book from public.ledger_books where id = new.book_id;
  new.household_id := v_book.household_id;
  if tg_op = 'UPDATE' and (new.book_id <> old.book_id or new.owner_user_id <> old.owner_user_id) then
    raise exception 'LEDGER_ACCOUNT_IDENTITY_IMMUTABLE' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.household_members m
    where m.household_id = v_book.household_id and m.user_id = new.owner_user_id and m.status = 'active'
  ) or (v_book.visibility = 'private' and new.owner_user_id <> v_book.owner_user_id) then
    raise exception 'LEDGER_ACCOUNT_OWNER_INVALID' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function private.validate_ledger_category()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_book public.ledger_books%rowtype;
begin
  select * into strict v_book from public.ledger_books where id = new.book_id;
  new.household_id := v_book.household_id;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif new.book_id <> old.book_id or new.created_by <> old.created_by or new.is_default <> old.is_default then
    raise exception 'LEDGER_CATEGORY_IDENTITY_IMMUTABLE' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function private.validate_ledger_transaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_book public.ledger_books%rowtype;
  v_account public.ledger_accounts%rowtype;
  v_transfer public.ledger_accounts%rowtype;
  v_category public.ledger_categories%rowtype;
begin
  select * into strict v_book from public.ledger_books where id = new.book_id;
  new.household_id := v_book.household_id;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    if new.source <> 'manual' then
      raise exception 'LEDGER_TRANSACTION_SOURCE_INVALID' using errcode = '22023';
    end if;
  else
    if new.book_id <> old.book_id or new.created_by <> old.created_by
      or new.source <> old.source or new.client_request_id <> old.client_request_id then
      raise exception 'LEDGER_TRANSACTION_IDENTITY_IMMUTABLE' using errcode = '22023';
    end if;
    new.updated_by := auth.uid();
  end if;

  select * into strict v_account from public.ledger_accounts where id = new.account_id;
  if v_account.book_id <> new.book_id
    or (not v_account.is_active and (tg_op = 'INSERT' or new.account_id is distinct from old.account_id)) then
    raise exception 'LEDGER_TRANSACTION_ACCOUNT_INVALID' using errcode = '22023';
  end if;

  if new.type = 'transfer' then
    select * into strict v_transfer from public.ledger_accounts where id = new.transfer_account_id;
    if v_transfer.book_id <> new.book_id
      or (not v_transfer.is_active and (tg_op = 'INSERT' or new.transfer_account_id is distinct from old.transfer_account_id)) then
      raise exception 'LEDGER_TRANSACTION_TRANSFER_ACCOUNT_INVALID' using errcode = '22023';
    end if;
  end if;

  if new.category_id is not null then
    select * into strict v_category from public.ledger_categories where id = new.category_id;
    if v_category.book_id <> new.book_id or v_category.type::text <> new.type::text
      or (not v_category.is_active and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id)) then
      raise exception 'LEDGER_TRANSACTION_CATEGORY_INVALID' using errcode = '22023';
    end if;
  end if;

  if not exists (
    select 1 from public.household_members m
    where m.household_id = v_book.household_id and m.user_id = new.payer_user_id and m.status = 'active'
  ) then
    raise exception 'LEDGER_TRANSACTION_PAYER_INVALID' using errcode = '22023';
  end if;

  if v_book.visibility = 'private' and (
    new.payer_user_id <> v_book.owner_user_id or new.created_by <> v_book.owner_user_id
    or new.updated_by <> v_book.owner_user_id
  ) then
    raise exception 'LEDGER_PRIVATE_IDENTITY_INVALID' using errcode = '22023';
  end if;
  return new;
exception when no_data_found then
  raise exception 'LEDGER_TRANSACTION_REFERENCE_INVALID' using errcode = '22023';
end;
$$;

create trigger ledger_books_validate before insert or update on public.ledger_books
for each row execute function private.validate_ledger_book();
create trigger ledger_accounts_validate before insert or update on public.ledger_accounts
for each row execute function private.validate_ledger_account();
create trigger ledger_categories_validate before insert or update on public.ledger_categories
for each row execute function private.validate_ledger_category();
create trigger ledger_transactions_validate before insert or update on public.ledger_transactions
for each row execute function private.validate_ledger_transaction();

alter table public.ledger_books enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.ledger_categories enable row level security;
alter table public.ledger_transactions enable row level security;

revoke all on public.ledger_books, public.ledger_accounts, public.ledger_categories,
  public.ledger_transactions from anon, authenticated;
grant select, insert, update on public.ledger_books, public.ledger_accounts,
  public.ledger_categories, public.ledger_transactions to authenticated;

create policy ledger_books_select on public.ledger_books for select to authenticated
using (private.can_read_ledger_book(id));
create policy ledger_books_insert on public.ledger_books for insert to authenticated
with check (
  owner_user_id = (select auth.uid()) and private.is_active_household_member(household_id)
  and (visibility = 'private' or private.is_active_household_admin(household_id))
);
create policy ledger_books_update on public.ledger_books for update to authenticated
using (private.can_manage_ledger_book(id)) with check (private.can_manage_ledger_book(id));

create policy ledger_accounts_select on public.ledger_accounts for select to authenticated
using (private.can_read_ledger_book(book_id));
create policy ledger_accounts_insert on public.ledger_accounts for insert to authenticated
with check (
  private.can_read_ledger_book(book_id) and owner_user_id = (select auth.uid())
);
create policy ledger_accounts_update on public.ledger_accounts for update to authenticated
using (owner_user_id = (select auth.uid()) or private.can_manage_ledger_book(book_id))
with check (owner_user_id = (select auth.uid()) or private.can_manage_ledger_book(book_id));

create policy ledger_categories_select on public.ledger_categories for select to authenticated
using (private.can_read_ledger_book(book_id));
create policy ledger_categories_insert on public.ledger_categories for insert to authenticated
with check (private.can_manage_ledger_book(book_id));
create policy ledger_categories_update on public.ledger_categories for update to authenticated
using (private.can_manage_ledger_book(book_id)) with check (private.can_manage_ledger_book(book_id));

create policy ledger_transactions_select on public.ledger_transactions for select to authenticated
using (deleted_at is null and private.can_read_ledger_book(book_id));
create policy ledger_transactions_insert on public.ledger_transactions for insert to authenticated
with check (created_by = (select auth.uid()) and private.can_read_ledger_book(book_id));
create policy ledger_transactions_update on public.ledger_transactions for update to authenticated
using (created_by = (select auth.uid()) or private.can_manage_ledger_book(book_id))
with check (created_by = (select auth.uid()) or private.can_manage_ledger_book(book_id));

create or replace function public.create_default_ledger_book(
  p_household_id uuid,
  p_visibility public.ledger_visibility,
  p_name text default null
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_book_id uuid;
begin
  if v_user_id is null or not private.is_active_household_member(p_household_id) then
    raise exception 'LEDGER_BOOK_ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_visibility = 'family' and not private.is_active_household_admin(p_household_id) then
    raise exception 'LEDGER_BOOK_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  insert into public.ledger_books(household_id, owner_user_id, visibility, name)
  values (
    p_household_id, v_user_id, p_visibility,
    coalesce(nullif(btrim(p_name),''), case when p_visibility='family' then '우리집 가계부' else '개인 가계부' end)
  ) returning id into v_book_id;

  insert into public.ledger_accounts(book_id, household_id, owner_user_id, type, name)
  values (v_book_id, p_household_id, v_user_id, 'cash', '현금');

  insert into public.ledger_categories(book_id, household_id, type, name, icon, color, sort_order, is_default, created_by)
  values
    (v_book_id,p_household_id,'expense','식비','food','orange',10,true,v_user_id),
    (v_book_id,p_household_id,'expense','생활','home','blue',20,true,v_user_id),
    (v_book_id,p_household_id,'expense','주거','building','purple',30,true,v_user_id),
    (v_book_id,p_household_id,'expense','교통','car','green',40,true,v_user_id),
    (v_book_id,p_household_id,'expense','건강','health','pink',50,true,v_user_id),
    (v_book_id,p_household_id,'expense','교육','book','blue',60,true,v_user_id),
    (v_book_id,p_household_id,'expense','문화·여가','leisure','purple',70,true,v_user_id),
    (v_book_id,p_household_id,'expense','경조사','gift','pink',80,true,v_user_id),
    (v_book_id,p_household_id,'expense','기타','tag','gray',90,true,v_user_id),
    (v_book_id,p_household_id,'income','급여','salary','green',10,true,v_user_id),
    (v_book_id,p_household_id,'income','용돈','wallet','blue',20,true,v_user_id),
    (v_book_id,p_household_id,'income','금융수입','bank','purple',30,true,v_user_id),
    (v_book_id,p_household_id,'income','기타수입','tag','gray',40,true,v_user_id);
  return v_book_id;
end;
$$;

create or replace function public.get_ledger_month_summary(p_book_id uuid, p_month date)
returns table(income_total text, expense_total text, net_total text)
language sql stable security invoker set search_path = '' as $$
  with bounds as (
    select
      (date_trunc('month', p_month::timestamp) at time zone 'Asia/Seoul') as starts_at,
      ((date_trunc('month', p_month::timestamp) + interval '1 month') at time zone 'Asia/Seoul') as ends_at
  ), totals as (
    select
      coalesce(sum(t.amount) filter (where t.type='income'),0::numeric) as income,
      coalesce(sum(t.amount) filter (where t.type='expense'),0::numeric) as expense
    from public.ledger_transactions t, bounds b
    where t.book_id=p_book_id and t.deleted_at is null
      and t.occurred_at >= b.starts_at and t.occurred_at < b.ends_at
  )
  select income::text, expense::text, (income-expense)::text from totals;
$$;

create or replace function public.get_ledger_account_balances(p_book_id uuid)
returns table(account_id uuid, balance text)
language sql stable security invoker set search_path = '' as $$
  with movements as (
    select t.account_id,
      case when t.type='income' then t.amount else -t.amount end as amount
    from public.ledger_transactions t
    where t.book_id=p_book_id and t.deleted_at is null
    union all
    select t.transfer_account_id, t.amount
    from public.ledger_transactions t
    where t.book_id=p_book_id and t.type='transfer' and t.deleted_at is null
  )
  select a.id, (a.opening_balance + coalesce(sum(m.amount),0::numeric))::text
  from public.ledger_accounts a left join movements m on m.account_id=a.id
  where a.book_id=p_book_id
  group by a.id, a.opening_balance, a.sort_order
  order by a.sort_order, a.created_at;
$$;

revoke execute on function private.can_read_ledger_book(uuid), private.can_manage_ledger_book(uuid),
  private.validate_ledger_book(), private.validate_ledger_account(), private.validate_ledger_category(),
  private.validate_ledger_transaction() from public, anon;
grant execute on function private.can_read_ledger_book(uuid), private.can_manage_ledger_book(uuid) to authenticated;
revoke execute on function public.create_default_ledger_book(uuid, public.ledger_visibility, text),
  public.get_ledger_month_summary(uuid, date), public.get_ledger_account_balances(uuid) from public, anon;
grant execute on function public.create_default_ledger_book(uuid, public.ledger_visibility, text),
  public.get_ledger_month_summary(uuid, date), public.get_ledger_account_balances(uuid) to authenticated;

comment on table public.ledger_books is 'Family or owner-private ledger security boundary.';
comment on table public.ledger_transactions is 'Integer-KRW canonical ledger with atomic transfers and soft deletion.';
