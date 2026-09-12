create table public.dashboard_preferences (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  widget_order text[] not null default array['schedule','ledger','ddays','goals','quick_actions']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id),
  check (cardinality(widget_order) = 5),
  check (widget_order <@ array['schedule','ledger','ddays','goals','quick_actions']::text[])
);

create or replace function private.validate_dashboard_preferences()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id <> (select auth.uid()) then
    raise exception 'DASHBOARD_PREFERENCE_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if (select count(distinct value) from unnest(new.widget_order) value) <> 5 then
    raise exception 'DASHBOARD_WIDGET_ORDER_INVALID' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.household_id <> old.household_id or new.user_id <> old.user_id) then
    raise exception 'DASHBOARD_PREFERENCE_IDENTITY_IMMUTABLE' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger dashboard_preferences_validate before insert or update on public.dashboard_preferences
for each row execute function private.validate_dashboard_preferences();
create trigger dashboard_preferences_touch_updated_at before update on public.dashboard_preferences
for each row execute function private.touch_updated_at();

alter table public.dashboard_preferences enable row level security;
revoke all on public.dashboard_preferences from anon, authenticated;
grant select, insert, update on public.dashboard_preferences to authenticated;

create policy dashboard_preferences_select_own on public.dashboard_preferences for select to authenticated using (
  user_id = (select auth.uid()) and private.is_active_household_member(household_id)
);
create policy dashboard_preferences_insert_own on public.dashboard_preferences for insert to authenticated with check (
  user_id = (select auth.uid()) and private.is_active_household_member(household_id)
);
create policy dashboard_preferences_update_own on public.dashboard_preferences for update to authenticated
using (user_id = (select auth.uid()) and private.is_active_household_member(household_id))
with check (user_id = (select auth.uid()) and private.is_active_household_member(household_id));

comment on table public.dashboard_preferences is 'Per-member home dashboard widget ordering.';
