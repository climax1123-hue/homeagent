alter table public.ledger_common_codes rename to common_codes;

alter table public.common_codes drop constraint ledger_common_codes_group_key_check;
alter table public.common_codes
  add column group_label text not null default '결제수단 유형',
  add column is_admin_editable boolean not null default true;

alter trigger ledger_common_codes_touch_updated_at on public.common_codes rename to common_codes_touch_updated_at;
alter trigger ledger_common_codes_validate on public.common_codes rename to common_codes_validate;

alter table public.common_codes disable trigger common_codes_validate;

insert into public.common_codes(
  household_id, group_key, group_label, code, label, sort_order, is_system, is_admin_editable, created_by
)
select h.id, seed.group_key, seed.group_label, seed.code, seed.label, seed.sort_order, true, false, h.created_by
from public.households h
cross join (values
  ('household_role','가족 역할','admin','관리자',10),
  ('household_role','가족 역할','member','구성원',20),
  ('household_member_status','구성원 상태','active','활성',10),
  ('household_member_status','구성원 상태','suspended','일시 정지',20),
  ('household_member_status','구성원 상태','removed','탈퇴',30),
  ('calendar_visibility','일정 공개범위','family','가족 공유',10),
  ('calendar_visibility','일정 공개범위','private','개인',20),
  ('recurrence_frequency','반복 주기','daily','매일',10),
  ('recurrence_frequency','반복 주기','weekly','매주',20),
  ('recurrence_frequency','반복 주기','monthly','매월',30),
  ('recurrence_frequency','반복 주기','yearly','매년',40),
  ('calendar_color','일정 색상','blue','파랑',10),
  ('calendar_color','일정 색상','green','초록',20),
  ('calendar_color','일정 색상','orange','주황',30),
  ('calendar_color','일정 색상','pink','분홍',40),
  ('calendar_color','일정 색상','purple','보라',50),
  ('calendar_color','일정 색상','gray','회색',60),
  ('ledger_transaction_type','거래 유형','income','수입',10),
  ('ledger_transaction_type','거래 유형','expense','지출',20),
  ('ledger_transaction_type','거래 유형','transfer','이체',30),
  ('ledger_visibility','장부 공개범위','family','가족 공유',10),
  ('ledger_visibility','장부 공개범위','private','개인',20)
) seed(group_key,group_label,code,label,sort_order)
on conflict (household_id,group_key,code) do nothing;

alter table public.common_codes enable trigger common_codes_validate;

update public.common_codes
set group_label = '결제수단 유형', is_admin_editable = true
where group_key = 'payment_method_type';

create or replace function private.validate_ledger_common_code()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if new.group_key <> 'payment_method_type' or not new.is_admin_editable then
      raise exception 'COMMON_CODE_GROUP_LOCKED' using errcode = '42501';
    end if;
  elsif new.household_id <> old.household_id or new.group_key <> old.group_key
    or new.code <> old.code or new.created_by <> old.created_by or new.is_system <> old.is_system
    or new.is_admin_editable <> old.is_admin_editable or new.group_label <> old.group_label then
    raise exception 'COMMON_CODE_IDENTITY_IMMUTABLE' using errcode = '22023';
  elsif not old.is_admin_editable then
    raise exception 'COMMON_CODE_GROUP_LOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.validate_ledger_account_common_code()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.common_codes c
    where c.household_id = new.household_id and c.group_key = 'payment_method_type'
      and c.code = new.type and (c.is_active or (tg_op = 'UPDATE' and new.type = old.type))
  ) then
    raise exception 'LEDGER_ACCOUNT_TYPE_CODE_INVALID' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function private.seed_ledger_payment_codes(p_household_id uuid, p_user_id uuid)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.common_codes(household_id, group_key, group_label, code, label, sort_order, is_system, is_admin_editable, created_by)
  select p_household_id, 'payment_method_type', '결제수단 유형', seed.code, seed.label, seed.sort_order, true, true, p_user_id
  from (values
    ('cash','현금',10), ('bank','은행 계좌',20), ('debit_card','체크카드',30),
    ('credit_card','신용카드',40), ('other','기타',50)
  ) as seed(code,label,sort_order)
  on conflict do nothing;
$$;

insert into public.ledger_accounts(book_id, household_id, owner_user_id, type, name, sort_order)
select b.id, b.household_id, b.owner_user_id, seed.code, seed.name, seed.sort_order
from public.ledger_books b
cross join (values
  ('cash','현금',10), ('bank','은행 계좌',20), ('debit_card','체크카드',30),
  ('credit_card','신용카드',40), ('other','기타',50)
) seed(code,name,sort_order)
where b.is_active
  and not exists (
    select 1 from public.ledger_accounts a where a.book_id = b.id and lower(a.name) = lower(seed.name)
  );

create or replace function public.create_default_ledger_book(
  p_household_id uuid, p_visibility public.ledger_visibility, p_name text default null
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_book_id uuid;
begin
  if v_user_id is null or not private.is_active_household_member(p_household_id) then
    raise exception 'LEDGER_BOOK_ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_visibility = 'family' and not private.is_active_household_admin(p_household_id) then
    raise exception 'LEDGER_BOOK_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  perform private.seed_ledger_payment_codes(p_household_id, v_user_id);
  insert into public.ledger_books(household_id,owner_user_id,visibility,name)
  values (p_household_id,v_user_id,p_visibility,coalesce(nullif(btrim(p_name),''),case when p_visibility='family' then '우리집 가계부' else '개인 가계부' end))
  returning id into v_book_id;
  insert into public.ledger_accounts(book_id,household_id,owner_user_id,type,name,sort_order)
  values
    (v_book_id,p_household_id,v_user_id,'cash','현금',10),
    (v_book_id,p_household_id,v_user_id,'bank','은행 계좌',20),
    (v_book_id,p_household_id,v_user_id,'debit_card','체크카드',30),
    (v_book_id,p_household_id,v_user_id,'credit_card','신용카드',40),
    (v_book_id,p_household_id,v_user_id,'other','기타',50);
  insert into public.ledger_categories(book_id,household_id,type,name,icon,color,sort_order,is_default,created_by)
  values
    (v_book_id,p_household_id,'expense','식비','food','orange',10,true,v_user_id),(v_book_id,p_household_id,'expense','생활','home','blue',20,true,v_user_id),(v_book_id,p_household_id,'expense','주거','building','purple',30,true,v_user_id),(v_book_id,p_household_id,'expense','교통','car','green',40,true,v_user_id),(v_book_id,p_household_id,'expense','건강','health','pink',50,true,v_user_id),(v_book_id,p_household_id,'expense','교육','book','blue',60,true,v_user_id),(v_book_id,p_household_id,'expense','문화·여가','leisure','purple',70,true,v_user_id),(v_book_id,p_household_id,'expense','경조사','gift','pink',80,true,v_user_id),(v_book_id,p_household_id,'expense','기타','tag','gray',90,true,v_user_id),(v_book_id,p_household_id,'income','급여','salary','green',10,true,v_user_id),(v_book_id,p_household_id,'income','용돈','wallet','blue',20,true,v_user_id),(v_book_id,p_household_id,'income','금융수입','bank','purple',30,true,v_user_id),(v_book_id,p_household_id,'income','기타수입','tag','gray',40,true,v_user_id);
  return v_book_id;
end;
$$;

comment on table public.common_codes is 'Household-wide common-code registry. Security and calculation codes are locked.';
