create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  title text not null check (title = btrim(title) and char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  target_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  progress smallint not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'completed' or progress = 100)
);

create index goals_household_status_idx on public.goals(household_id, status, target_date);
create or replace function private.validate_family_record_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    new.household_id <> old.household_id or new.owner_user_id <> old.owner_user_id
  ) then
    raise exception 'FAMILY_RECORD_IDENTITY_IMMUTABLE' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger goals_touch_updated_at before update on public.goals
for each row execute function private.touch_updated_at();
create trigger goals_validate_identity before update on public.goals
for each row execute function private.validate_family_record_identity();

alter table public.goals enable row level security;
revoke all on public.goals from anon, authenticated;
grant select, insert, update, delete on public.goals to authenticated;

create policy goals_select_visible on public.goals for select to authenticated using (
  private.is_active_household_member(household_id)
  and (visibility = 'family' or owner_user_id = (select auth.uid()))
);
create policy goals_insert_owner on public.goals for insert to authenticated with check (
  owner_user_id = (select auth.uid())
  and private.is_active_household_member(household_id)
);
create policy goals_update_owner_or_admin on public.goals for update to authenticated
using (
  private.is_active_household_member(household_id)
  and (owner_user_id = (select auth.uid())
    or (visibility = 'family' and private.is_active_household_admin(household_id)))
)
with check (
  private.is_active_household_member(household_id)
  and (
    owner_user_id = (select auth.uid())
    or (visibility = 'family' and private.is_active_household_admin(household_id))
  )
);
create policy goals_delete_owner_or_admin on public.goals for delete to authenticated using (
  private.is_active_household_member(household_id)
  and (owner_user_id = (select auth.uid())
    or (visibility = 'family' and private.is_active_household_admin(household_id)))
);

create table public.ddays (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  title text not null check (title = btrim(title) and char_length(title) between 1 and 80),
  target_date date not null,
  memo text not null default '' check (char_length(memo) <= 500),
  repeat_yearly boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ddays_household_date_idx on public.ddays(household_id, target_date);
create trigger ddays_touch_updated_at before update on public.ddays
for each row execute function private.touch_updated_at();
create trigger ddays_validate_identity before update on public.ddays
for each row execute function private.validate_family_record_identity();

alter table public.ddays enable row level security;
revoke all on public.ddays from anon, authenticated;
grant select, insert, update, delete on public.ddays to authenticated;

create policy ddays_select_visible on public.ddays for select to authenticated using (
  private.is_active_household_member(household_id)
  and (visibility = 'family' or owner_user_id = (select auth.uid()))
);
create policy ddays_insert_owner on public.ddays for insert to authenticated with check (
  owner_user_id = (select auth.uid())
  and private.is_active_household_member(household_id)
);
create policy ddays_update_owner_or_admin on public.ddays for update to authenticated
using (
  private.is_active_household_member(household_id)
  and (owner_user_id = (select auth.uid())
    or (visibility = 'family' and private.is_active_household_admin(household_id)))
)
with check (
  private.is_active_household_member(household_id)
  and (
    owner_user_id = (select auth.uid())
    or (visibility = 'family' and private.is_active_household_admin(household_id))
  )
);
create policy ddays_delete_owner_or_admin on public.ddays for delete to authenticated using (
  private.is_active_household_member(household_id)
  and (owner_user_id = (select auth.uid())
    or (visibility = 'family' and private.is_active_household_admin(household_id)))
);

comment on table public.goals is 'Family and private goals with progress tracking.';
comment on table public.ddays is 'Family and private important dates with optional yearly recurrence.';
