alter table public.google_calendar_connections
add column auto_sync_enabled boolean not null default false;

alter table public.calendar_google_event_links
alter column google_event_id drop not null;

grant update (auto_sync_enabled) on public.google_calendar_connections to authenticated;

create policy google_calendar_connections_update_own_preferences
on public.google_calendar_connections for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

comment on column public.google_calendar_connections.auto_sync_enabled is
  'When true, locally created or updated owned events are pushed to Google after local save.';

