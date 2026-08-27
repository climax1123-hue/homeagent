create type public.google_connection_status as enum ('active', 'reauthorization_required', 'error');
create type public.google_sync_status as enum ('synced', 'pending', 'error');

create table public.google_calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  google_account_email text not null check (char_length(google_account_email) between 3 and 320),
  google_calendar_id text not null default 'primary' check (char_length(google_calendar_id) between 1 and 1024),
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  scope text not null,
  status public.google_connection_status not null default 'active',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.google_oauth_states (
  state_hash text primary key check (char_length(state_hash) = 64),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index google_oauth_states_expiry_idx on public.google_oauth_states (expires_at)
where consumed_at is null;

create table public.calendar_google_event_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  google_calendar_id text not null,
  google_event_id text not null,
  sync_status public.google_sync_status not null default 'pending',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id),
  unique (user_id, google_calendar_id, google_event_id)
);

create trigger google_calendar_connections_touch_updated_at
before update on public.google_calendar_connections
for each row execute function private.touch_updated_at();

create trigger calendar_google_event_links_touch_updated_at
before update on public.calendar_google_event_links
for each row execute function private.touch_updated_at();

alter table public.google_calendar_connections enable row level security;
alter table public.google_oauth_states enable row level security;
alter table public.calendar_google_event_links enable row level security;

revoke all on table public.google_calendar_connections from anon, authenticated;
revoke all on table public.google_oauth_states from anon, authenticated;
revoke all on table public.calendar_google_event_links from anon, authenticated;

grant select (
  user_id, household_id, google_account_email, google_calendar_id,
  scope, status, connected_at, updated_at
) on public.google_calendar_connections to authenticated;
grant select on public.calendar_google_event_links to authenticated;

create policy google_calendar_connections_select_own
on public.google_calendar_connections for select to authenticated
using (user_id = (select auth.uid()));

create policy calendar_google_event_links_select_own
on public.calendar_google_event_links for select to authenticated
using (user_id = (select auth.uid()));

comment on table public.google_calendar_connections is
  'Server-managed Google Calendar OAuth connections. Token columns are never granted to authenticated clients.';
comment on table public.google_oauth_states is
  'Short-lived one-time OAuth CSRF states managed only by Edge Functions.';
comment on table public.calendar_google_event_links is
  'Canonical mapping between local calendar events and user-owned Google events.';
