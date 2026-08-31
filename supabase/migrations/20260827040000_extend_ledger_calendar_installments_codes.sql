create table public.ledger_common_codes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  group_key text not null check (group_key = 'payment_method_type'),
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (label = btrim(label) and char_length(label) between 1 and 40),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, group_key, code)
);

create trigger ledger_common_codes_touch_updated_at before update on public.ledger_common_codes
for each row execute function private.touch_updated_at();

insert into public.ledger_common_codes(household_id, group_key, code, label, sort_order, is_system, created_by)
select h.id, 'payment_method_type', seed.code, seed.label, seed.sort_order, true, h.created_by
from public.households h
cross join (values
  ('cash','현금',10), ('bank','은행 계좌',20), ('debit_card','체크카드',30),
  ('credit_card','신용카드',40), ('other','기타',50)
) as seed(code,label,sort_order)
on conflict do nothing;

alter table public.ledger_accounts alter column type type text using type::text;
alter table public.ledger_accounts add column type_group_key text not null default 'payment_method_type'
  check (type_group_key = 'payment_method_type');
alter table public.ledger_accounts add constraint ledger_accounts_common_code_fk
  foreign key (household_id, type_group_key, type)
  references public.ledger_common_codes(household_id, group_key, code) on update cascade;

alter table public.ledger_transactions
  add column installment_group_id uuid,
  add column installment_number integer,
  add column installment_count integer,
  add column installment_original_total bigint,
  add constraint ledger_transactions_installment_shape check (
    (installment_group_id is null and installment_number is null and installment_count is null and installment_original_total is null)
    or
    (type = 'expense' and installment_group_id is not null and installment_number between 1 and installment_count
      and installment_count between 2 and 60 and installment_original_total > 0)
  );
create index ledger_transactions_installment_group_idx
  on public.ledger_transactions(installment_group_id) where installment_group_id is not null;

create or replace function private.validate_ledger_common_code()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif new.household_id <> old.household_id or new.group_key <> old.group_key
    or new.code <> old.code or new.created_by <> old.created_by or new.is_system <> old.is_system then
    raise exception 'LEDGER_COMMON_CODE_IDENTITY_IMMUTABLE' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger ledger_common_codes_validate before insert or update on public.ledger_common_codes
for each row execute function private.validate_ledger_common_code();

create or replace function private.validate_ledger_account_common_code()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.ledger_common_codes c
    where c.household_id = new.household_id and c.group_key = 'payment_method_type'
      and c.code = new.type and (c.is_active or (tg_op = 'UPDATE' and new.type = old.type))
  ) then
    raise exception 'LEDGER_ACCOUNT_TYPE_CODE_INVALID' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger ledger_accounts_z_common_code_validate before insert or update on public.ledger_accounts
for each row execute function private.validate_ledger_account_common_code();

alter table public.ledger_common_codes enable row level security;
revoke all on public.ledger_common_codes from anon, authenticated;
grant select, insert, update on public.ledger_common_codes to authenticated;
create policy ledger_common_codes_select on public.ledger_common_codes for select to authenticated
using (private.is_active_household_member(household_id));
create policy ledger_common_codes_insert on public.ledger_common_codes for insert to authenticated
with check (private.is_active_household_admin(household_id) and created_by = (select auth.uid()));
create policy ledger_common_codes_update on public.ledger_common_codes for update to authenticated
using (private.is_active_household_admin(household_id))
with check (private.is_active_household_admin(household_id));

create or replace function private.seed_ledger_payment_codes(p_household_id uuid, p_user_id uuid)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.ledger_common_codes(household_id, group_key, code, label, sort_order, is_system, created_by)
  select p_household_id, 'payment_method_type', seed.code, seed.label, seed.sort_order, true, p_user_id
  from (values
    ('cash','현금',10), ('bank','은행 계좌',20), ('debit_card','체크카드',30),
    ('credit_card','신용카드',40), ('other','기타',50)
  ) as seed(code,label,sort_order)
  on conflict do nothing;
$$;

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
  perform private.seed_ledger_payment_codes(p_household_id, v_user_id);
  insert into public.ledger_books(household_id, owner_user_id, visibility, name)
  values (p_household_id, v_user_id, p_visibility,
    coalesce(nullif(btrim(p_name),''), case when p_visibility='family' then '우리집 가계부' else '개인 가계부' end))
  returning id into v_book_id;
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

create or replace function public.create_ledger_installment(
  p_book_id uuid, p_total bigint, p_installment_count integer, p_occurred_on date,
  p_account_id uuid, p_category_id uuid, p_merchant text, p_memo text, p_payer_user_id uuid
) returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_group_id uuid := gen_random_uuid();
  v_household_id uuid;
  v_user_id uuid := auth.uid();
  v_month date;
  v_date date;
  v_day integer := extract(day from p_occurred_on);
  v_amount bigint;
  i integer;
begin
  if p_total <= 0 or p_installment_count not between 2 and 60 then
    raise exception 'LEDGER_INSTALLMENT_INPUT_INVALID' using errcode = '22023';
  end if;
  select household_id into strict v_household_id from public.ledger_books where id = p_book_id;
  for i in 1..p_installment_count loop
    v_month := (date_trunc('month', p_occurred_on)::date + make_interval(months => i - 1))::date;
    v_date := make_date(extract(year from v_month)::integer, extract(month from v_month)::integer,
      least(v_day, extract(day from (v_month + interval '1 month - 1 day'))::integer));
    v_amount := p_total / p_installment_count + case when i <= (p_total % p_installment_count) then 1 else 0 end;
    insert into public.ledger_transactions(
      book_id, household_id, type, amount, occurred_at, account_id, category_id, merchant, memo,
      payer_user_id, created_by, updated_by, source, client_request_id,
      installment_group_id, installment_number, installment_count, installment_original_total
    ) values (
      p_book_id, v_household_id, 'expense', v_amount, v_date::timestamp at time zone 'Asia/Seoul',
      p_account_id, p_category_id, btrim(coalesce(p_merchant,'')), coalesce(p_memo,''),
      p_payer_user_id, v_user_id, v_user_id, 'manual', gen_random_uuid(),
      v_group_id, i, p_installment_count, p_total
    );
  end loop;
  return v_group_id;
end;
$$;

revoke execute on function private.validate_ledger_common_code(),
  private.validate_ledger_account_common_code(), private.seed_ledger_payment_codes(uuid,uuid)
  from public, anon, authenticated;
revoke execute on function public.create_ledger_installment(uuid,bigint,integer,date,uuid,uuid,text,text,uuid)
  from public, anon;
grant execute on function public.create_ledger_installment(uuid,bigint,integer,date,uuid,uuid,text,text,uuid)
  to authenticated;

comment on table public.ledger_common_codes is 'Household-managed display codes; domain invariants remain enums.';
comment on function public.create_ledger_installment is 'Atomically expands an expense total into monthly integer installments.';
