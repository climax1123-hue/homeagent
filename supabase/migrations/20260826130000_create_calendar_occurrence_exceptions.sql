create type public.calendar_exception_action as enum ('cancelled', 'override');

create table public.calendar_event_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  original_starts_at timestamptz not null,
  action public.calendar_exception_action not null,
  title text check (title is null or (title = btrim(title) and char_length(title) between 1 and 120)),
  description text check (description is null or char_length(description) <= 2000),
  location text check (location is null or char_length(location) <= 200),
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  color text check (color is null or color in ('blue', 'green', 'orange', 'pink', 'purple', 'gray')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, original_starts_at),
  constraint calendar_event_exceptions_shape check (
    (action = 'cancelled' and starts_at is null and ends_at is null)
    or
    (action = 'override' and title is not null and starts_at is not null and ends_at > starts_at and all_day is not null and color is not null)
  ),
  constraint calendar_event_exceptions_move_limit check (
    starts_at is null or starts_at between original_starts_at - interval '7 days' and original_starts_at + interval '7 days'
  )
);

create index calendar_event_exceptions_event_original_idx
on public.calendar_event_exceptions (event_id, original_starts_at);

create or replace function private.validate_calendar_event_exception()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare source_event public.calendar_events%rowtype;
begin
  select * into source_event from public.calendar_events where id = new.event_id;
  if not found or source_event.recurrence_frequency is null then
    raise exception using errcode = '22023', message = 'RECURRING_EVENT_REQUIRED';
  end if;
  if new.household_id <> source_event.household_id or new.owner_user_id <> source_event.owner_user_id then
    raise exception using errcode = '22023', message = 'CALENDAR_EXCEPTION_IDENTITY_INVALID';
  end if;
  if tg_op = 'UPDATE' and (new.event_id <> old.event_id or new.original_starts_at <> old.original_starts_at
      or new.household_id <> old.household_id or new.owner_user_id <> old.owner_user_id) then
    raise exception using errcode = '22023', message = 'CALENDAR_EXCEPTION_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger calendar_event_exceptions_validate before insert or update
on public.calendar_event_exceptions for each row execute function private.validate_calendar_event_exception();
create trigger calendar_event_exceptions_touch before update on public.calendar_event_exceptions
for each row execute function private.touch_updated_at();

alter table public.calendar_event_exceptions enable row level security;
revoke all on public.calendar_event_exceptions from anon, authenticated;
grant select, insert, update, delete on public.calendar_event_exceptions to authenticated;

create policy calendar_event_exceptions_select_visible on public.calendar_event_exceptions
for select to authenticated using (
  (select private.is_active_household_member(household_id)) and
  exists (select 1 from public.calendar_events event where event.id = event_id
    and (event.visibility = 'family' or event.owner_user_id = (select auth.uid())))
);
create policy calendar_event_exceptions_insert_authorized on public.calendar_event_exceptions
for insert to authenticated with check (
  exists (select 1 from public.calendar_events event where event.id = event_id and
    (event.owner_user_id = (select auth.uid()) or
      (event.visibility = 'family' and (select private.is_active_household_admin(event.household_id)))))
);
create policy calendar_event_exceptions_update_authorized on public.calendar_event_exceptions
for update to authenticated using (
  exists (select 1 from public.calendar_events event where event.id = event_id and
    (event.owner_user_id = (select auth.uid()) or
      (event.visibility = 'family' and (select private.is_active_household_admin(event.household_id)))))
) with check (
  exists (select 1 from public.calendar_events event where event.id = event_id and
    (event.owner_user_id = (select auth.uid()) or
      (event.visibility = 'family' and (select private.is_active_household_admin(event.household_id)))))
);
create policy calendar_event_exceptions_delete_authorized on public.calendar_event_exceptions
for delete to authenticated using (
  exists (select 1 from public.calendar_events event where event.id = event_id and
    (event.owner_user_id = (select auth.uid()) or
      (event.visibility = 'family' and (select private.is_active_household_admin(event.household_id)))))
);

create unique index calendar_reminders_one_event_rule_per_user
on public.calendar_reminders (event_id, owner_user_id) where kind = 'event';

revoke execute on function private.validate_calendar_event_exception() from public, anon, authenticated;
