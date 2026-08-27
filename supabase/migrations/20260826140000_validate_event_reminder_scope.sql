create or replace function private.validate_event_reminder_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_event public.calendar_events%rowtype;
begin
  if new.kind <> 'event' then
    return new;
  end if;

  select * into source_event
  from public.calendar_events
  where id = new.event_id;

  if not found
    or source_event.household_id <> new.household_id
    or not (
      source_event.owner_user_id = new.owner_user_id
      or (
        source_event.visibility = 'family'
        and private.is_active_household_member(source_event.household_id)
      )
    )
  then
    raise exception 'CALENDAR_REMINDER_EVENT_SCOPE_INVALID' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger calendar_reminders_validate_event_scope
before insert or update on public.calendar_reminders
for each row execute function private.validate_event_reminder_scope();

revoke execute on function private.validate_event_reminder_scope() from public, anon, authenticated;

