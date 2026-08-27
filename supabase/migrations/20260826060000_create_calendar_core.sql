create type public.calendar_visibility as enum ('family', 'private');
create type public.recurrence_frequency as enum ('daily', 'weekly', 'monthly', 'yearly');

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  visibility public.calendar_visibility not null default 'family',
  title text not null check (title = btrim(title) and char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  location text not null default '' check (char_length(location) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  timezone text not null default 'Asia/Seoul' check (timezone = 'Asia/Seoul'),
  color text not null default 'blue' check (color in ('blue', 'green', 'orange', 'pink', 'purple', 'gray')),
  recurrence_frequency public.recurrence_frequency,
  recurrence_interval smallint not null default 1 check (recurrence_interval between 1 and 30),
  recurrence_until date,
  recurrence_count integer check (recurrence_count between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_time_order check (ends_at > starts_at),
  constraint calendar_events_recurrence_end check (recurrence_until is null or recurrence_count is null),
  constraint calendar_events_recurrence_values check (
    recurrence_frequency is not null
    or (recurrence_interval = 1 and recurrence_until is null and recurrence_count is null)
  )
);

create index calendar_events_household_starts_idx on public.calendar_events (household_id, starts_at);
create index calendar_events_owner_starts_idx on public.calendar_events (owner_user_id, starts_at);
create index calendar_events_recurring_idx on public.calendar_events (household_id, recurrence_frequency) where recurrence_frequency is not null;

create trigger calendar_events_touch_updated_at
before update on public.calendar_events
for each row execute function private.touch_updated_at();

create or replace function private.protect_calendar_event_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.household_id <> old.household_id or new.owner_user_id <> old.owner_user_id then
    raise exception using errcode = '22023', message = 'CALENDAR_EVENT_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger calendar_events_protect_identity
before update on public.calendar_events
for each row execute function private.protect_calendar_event_identity();

alter table public.calendar_events enable row level security;
revoke all on table public.calendar_events from anon, authenticated;
grant select, insert, update, delete on table public.calendar_events to authenticated;

create policy calendar_events_select_visible
on public.calendar_events for select to authenticated
using (
  (select private.is_active_household_member(household_id))
  and (visibility = 'family' or owner_user_id = (select auth.uid()))
);

create policy calendar_events_insert_owner
on public.calendar_events for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (select private.is_active_household_member(household_id))
);

create policy calendar_events_update_owner_or_family_admin
on public.calendar_events for update to authenticated
using (
  owner_user_id = (select auth.uid())
  or (visibility = 'family' and (select private.is_active_household_admin(household_id)))
)
with check (
  (select private.is_active_household_member(household_id))
  and (
    owner_user_id = (select auth.uid())
    or (visibility = 'family' and (select private.is_active_household_admin(household_id)))
  )
);

create policy calendar_events_delete_owner_or_family_admin
on public.calendar_events for delete to authenticated
using (
  owner_user_id = (select auth.uid())
  or (visibility = 'family' and (select private.is_active_household_admin(household_id)))
);

revoke execute on function private.protect_calendar_event_identity() from public, anon, authenticated;
comment on table public.calendar_events is 'Local family and private calendar source of truth, isolated by household RLS.';
