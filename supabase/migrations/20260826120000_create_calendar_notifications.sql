create type public.calendar_reminder_kind as enum ('event', 'recurring');

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 4096),
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth_key text not null check (char_length(auth_key) between 8 and 256),
  user_agent text not null default '' check (char_length(user_agent) <= 500),
  active boolean not null default true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendar_reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  kind public.calendar_reminder_kind not null,
  event_id uuid references public.calendar_events (id) on delete cascade,
  title text not null check (title = btrim(title) and char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 300),
  advance_minutes integer check (advance_minutes between 0 and 10080),
  local_time time,
  weekdays smallint[],
  starts_on date,
  ends_on date,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_reminders_shape check (
    (kind = 'event' and event_id is not null and advance_minutes is not null and local_time is null and weekdays is null)
    or
    (kind = 'recurring' and event_id is null and advance_minutes is null and local_time is not null
      and cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
  ),
  constraint calendar_reminders_date_order check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.calendar_reminders (id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null check (status in ('claimed', 'sent', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  unique (reminder_id, subscription_id, scheduled_for)
);

create index calendar_reminders_owner_enabled_idx on public.calendar_reminders (owner_user_id, enabled);
create index notification_deliveries_recent_idx on public.notification_deliveries (scheduled_for desc);

create trigger push_subscriptions_touch_updated_at before update on public.push_subscriptions
for each row execute function private.touch_updated_at();
create trigger calendar_reminders_touch_updated_at before update on public.calendar_reminders
for each row execute function private.touch_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.calendar_reminders enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.calendar_reminders from anon, authenticated;
revoke all on table public.notification_deliveries from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.calendar_reminders to authenticated;

create policy push_subscriptions_own_all on public.push_subscriptions for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy calendar_reminders_select_own on public.calendar_reminders for select to authenticated
using (owner_user_id = (select auth.uid()));
create policy calendar_reminders_insert_own on public.calendar_reminders for insert to authenticated
with check (owner_user_id = (select auth.uid()) and (select private.is_active_household_member(household_id)));
create policy calendar_reminders_update_own on public.calendar_reminders for update to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()) and (select private.is_active_household_member(household_id)));
create policy calendar_reminders_delete_own on public.calendar_reminders for delete to authenticated
using (owner_user_id = (select auth.uid()));

comment on table public.push_subscriptions is 'Private per-device Web Push capability endpoints.';
comment on table public.calendar_reminders is 'User-owned event and recurring notification rules in Asia/Seoul.';
