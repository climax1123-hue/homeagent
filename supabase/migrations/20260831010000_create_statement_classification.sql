create table public.ledger_classification_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  book_id uuid not null references public.ledger_books(id) on delete cascade,
  transaction_type public.ledger_category_type not null,
  target_field text not null check (target_field in ('merchant','memo','both')),
  match_type text not null check (match_type in ('contains','exact')),
  keyword text not null check (keyword=btrim(keyword) and char_length(keyword) between 2 and 100),
  category_id uuid not null references public.ledger_categories(id) on delete restrict,
  priority integer not null default 100 check (priority between 0 and 9999),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ledger_classification_rules_unique_idx on public.ledger_classification_rules(book_id,transaction_type,target_field,match_type,lower(keyword));
create index ledger_classification_rules_match_idx on public.ledger_classification_rules(book_id,is_active,transaction_type,priority);

create table public.ledger_statement_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  book_id uuid not null references public.ledger_books(id) on delete cascade,
  name text not null check (name=btrim(name) and char_length(name) between 1 and 60),
  header_signature text not null check (header_signature~'^[0-9a-f]{64}$'),
  mapping jsonb not null check (jsonb_typeof(mapping)='object' and mapping ? 'occurredOn'),
  encoding text not null check (encoding in ('utf-8','euc-kr','xlsx')),
  sheet_name text not null default '' check (char_length(sheet_name)<=100),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id,header_signature)
);
create index ledger_statement_profiles_book_idx on public.ledger_statement_profiles(book_id,is_active,name);

create or replace function private.validate_ledger_classification_rule()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_book public.ledger_books%rowtype;v_category public.ledger_categories%rowtype;
begin
  select * into strict v_book from public.ledger_books where id=new.book_id;
  select * into strict v_category from public.ledger_categories where id=new.category_id;
  new.household_id:=v_book.household_id;
  if v_category.book_id<>new.book_id or v_category.type<>new.transaction_type or not v_category.is_active then
    raise exception 'CLASSIFICATION_CATEGORY_INVALID' using errcode='22023';
  end if;
  if tg_op='INSERT' then new.created_by:=auth.uid();
  elsif new.book_id<>old.book_id or new.created_by<>old.created_by then
    raise exception 'CLASSIFICATION_IDENTITY_IMMUTABLE' using errcode='22023';
  end if;
  return new;
exception when no_data_found then raise exception 'CLASSIFICATION_REFERENCE_INVALID' using errcode='22023';
end;$$;

create or replace function private.validate_ledger_statement_profile()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_book public.ledger_books%rowtype;
begin
  select * into strict v_book from public.ledger_books where id=new.book_id;
  new.household_id:=v_book.household_id;
  if tg_op='INSERT' then new.created_by:=auth.uid();
  elsif new.book_id<>old.book_id or new.created_by<>old.created_by then
    raise exception 'STATEMENT_PROFILE_IDENTITY_IMMUTABLE' using errcode='22023';
  end if;
  return new;
exception when no_data_found then raise exception 'STATEMENT_PROFILE_REFERENCE_INVALID' using errcode='22023';
end;$$;

create trigger ledger_classification_rules_validate before insert or update on public.ledger_classification_rules for each row execute function private.validate_ledger_classification_rule();
create trigger ledger_statement_profiles_validate before insert or update on public.ledger_statement_profiles for each row execute function private.validate_ledger_statement_profile();
create trigger ledger_classification_rules_touch before update on public.ledger_classification_rules for each row execute function private.touch_updated_at();
create trigger ledger_statement_profiles_touch before update on public.ledger_statement_profiles for each row execute function private.touch_updated_at();

alter table public.ledger_classification_rules enable row level security;
alter table public.ledger_statement_profiles enable row level security;
revoke all on public.ledger_classification_rules,public.ledger_statement_profiles from anon,authenticated;
grant select,insert,update,delete on public.ledger_classification_rules,public.ledger_statement_profiles to authenticated;

create policy ledger_classification_rules_select on public.ledger_classification_rules for select to authenticated using (private.can_read_ledger_book(book_id));
create policy ledger_classification_rules_insert on public.ledger_classification_rules for insert to authenticated with check (private.can_manage_ledger_book(book_id));
create policy ledger_classification_rules_update on public.ledger_classification_rules for update to authenticated using (private.can_manage_ledger_book(book_id)) with check (private.can_manage_ledger_book(book_id));
create policy ledger_classification_rules_delete on public.ledger_classification_rules for delete to authenticated using (private.can_manage_ledger_book(book_id));
create policy ledger_statement_profiles_select on public.ledger_statement_profiles for select to authenticated using (private.can_read_ledger_book(book_id));
create policy ledger_statement_profiles_insert on public.ledger_statement_profiles for insert to authenticated with check (private.can_manage_ledger_book(book_id));
create policy ledger_statement_profiles_update on public.ledger_statement_profiles for update to authenticated using (private.can_manage_ledger_book(book_id)) with check (private.can_manage_ledger_book(book_id));
create policy ledger_statement_profiles_delete on public.ledger_statement_profiles for delete to authenticated using (private.can_manage_ledger_book(book_id));

revoke execute on function private.validate_ledger_classification_rule(),private.validate_ledger_statement_profile() from public,anon,authenticated;
comment on table public.ledger_classification_rules is 'Explainable book-scoped statement category recommendation rules.';
comment on table public.ledger_statement_profiles is 'Reusable book-scoped bank statement column mappings; no financial rows are stored.';
