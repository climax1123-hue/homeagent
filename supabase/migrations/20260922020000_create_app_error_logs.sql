create table public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (char_length(feature) between 1 and 50),
  route text not null check (char_length(route) between 1 and 300),
  user_message text not null check (char_length(user_message) between 1 and 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);

create index app_error_logs_household_created_idx
  on public.app_error_logs (household_id, created_at desc);

alter table public.app_error_logs enable row level security;

create policy app_error_logs_insert_active_member on public.app_error_logs
for insert to authenticated with check (
  user_id = (select auth.uid())
  and private.is_active_household_member(household_id)
  and resolved_at is null
  and resolved_by is null
);

create policy app_error_logs_select_admin on public.app_error_logs
for select to authenticated using (private.is_active_household_admin(household_id));

create policy app_error_logs_update_admin on public.app_error_logs
for update to authenticated
using (private.is_active_household_admin(household_id))
with check (
  private.is_active_household_admin(household_id)
  and (resolved_by is null or resolved_by = (select auth.uid()))
);

revoke all on table public.app_error_logs from anon;
grant insert on table public.app_error_logs to authenticated;
grant select, update on table public.app_error_logs to authenticated;

comment on table public.app_error_logs is
  'User-safe UI error messages. Never store form values, provider details, credentials, or tokens.';
