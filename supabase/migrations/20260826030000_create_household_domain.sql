create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create type public.household_role as enum ('admin', 'member');
create type public.household_member_status as enum ('active', 'suspended', 'removed');
create type public.household_invitation_status as enum (
  'pending',
  'accepted',
  'expired',
  'cancelled'
);
create type public.invitation_delivery_status as enum ('queued', 'sent', 'failed');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (
    name = btrim(name)
    and char_length(name) between 1 and 80
  ),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  display_name text not null check (
    display_name = btrim(display_name)
    and char_length(display_name) between 1 and 50
  ),
  role public.household_role not null,
  status public.household_member_status not null default 'active',
  joined_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  status_changed_by uuid references auth.users (id) on delete set null,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_members_household_user_key unique (household_id, user_id),
  constraint household_members_removed_at_check check (
    (status = 'removed' and removed_at is not null)
    or (status <> 'removed' and removed_at is null)
  )
);

create unique index household_members_one_current_household_per_user_idx
  on public.household_members (user_id)
  where status in ('active', 'suspended');

create index household_members_household_status_idx
  on public.household_members (household_id, status);

create index household_members_user_status_idx
  on public.household_members (user_id, status);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  invitee_email extensions.citext not null check (
    invitee_email::text = btrim(invitee_email::text)
    and char_length(invitee_email::text) between 3 and 320
  ),
  token_hash bytea not null unique,
  status public.household_invitation_status not null default 'pending',
  delivery_status public.invitation_delivery_status not null default 'queued',
  delivery_attempts smallint not null default 0 check (delivery_attempts >= 0),
  last_delivery_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_invitations_expiry_check check (expires_at > created_at),
  constraint household_invitations_accepted_check check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or (status <> 'accepted' and accepted_by is null and accepted_at is null)
  ),
  constraint household_invitations_cancelled_check check (
    (status = 'cancelled' and cancelled_by is not null and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_by is null and cancelled_at is null)
  )
);

create unique index household_invitations_one_pending_email_idx
  on public.household_invitations (household_id, invitee_email)
  where status = 'pending';

create index household_invitations_household_created_idx
  on public.household_invitations (household_id, created_at desc);

create index household_invitations_email_status_expiry_idx
  on public.household_invitations (invitee_email, status, expires_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  action text not null check (
    action in (
      'household.created',
      'member.joined',
      'member.suspended',
      'member.reactivated',
      'member.removed',
      'member.profile_updated',
      'invitation.created',
      'invitation.sent',
      'invitation.delivery_failed',
      'invitation.accepted',
      'invitation.cancelled',
      'invitation.expired'
    )
  ),
  actor_user_id uuid references auth.users (id) on delete set null,
  target_type text not null check (
    target_type in ('household', 'member', 'invitation')
  ),
  target_id uuid not null,
  target_user_id uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and not metadata ?| array['email', 'token', 'token_hash', 'password', 'access_token', 'refresh_token']
  ),
  created_at timestamptz not null default now()
);

create index audit_logs_household_created_idx
  on public.audit_logs (household_id, created_at desc);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger households_touch_updated_at
before update on public.households
for each row execute function private.touch_updated_at();

create trigger household_members_touch_updated_at
before update on public.household_members
for each row execute function private.touch_updated_at();

create trigger household_invitations_touch_updated_at
before update on public.household_invitations
for each row execute function private.touch_updated_at();

create or replace function private.is_active_household_member(
  p_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.household_members as member
      where member.household_id = p_household_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
    );
$$;

create or replace function private.is_active_household_admin(
  p_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.household_members as member
      where member.household_id = p_household_id
        and member.user_id = (select auth.uid())
        and member.role = 'admin'
        and member.status = 'active'
    );
$$;

create or replace function private.current_auth_email()
returns extensions.citext
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(users.email))::extensions.citext
  from auth.users
  where users.id = (select auth.uid())
    and users.email_confirmed_at is not null;
$$;

create or replace function private.append_household_audit(
  p_household_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_target_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_metadata ?| array[
    'email',
    'token',
    'token_hash',
    'password',
    'access_token',
    'refresh_token'
  ] then
    raise exception using errcode = '22023', message = 'SENSITIVE_AUDIT_METADATA';
  end if;

  insert into public.audit_logs (
    household_id,
    action,
    actor_user_id,
    target_type,
    target_id,
    target_user_id,
    metadata
  )
  values (
    p_household_id,
    p_action,
    p_actor_user_id,
    p_target_type,
    p_target_id,
    p_target_user_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function private.expire_household_invitations(
  p_household_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation record;
  v_count integer := 0;
begin
  for v_invitation in
    update public.household_invitations
    set status = 'expired'
    where status = 'pending'
      and expires_at <= now()
      and (p_household_id is null or household_id = p_household_id)
    returning id, household_id, created_by
  loop
    v_count := v_count + 1;
    perform private.append_household_audit(
      v_invitation.household_id,
      'invitation.expired',
      null,
      'invitation',
      v_invitation.id,
      null,
      '{}'::jsonb
    );
  end loop;

  return v_count;
end;
$$;

create or replace function public.bootstrap_initial_household(
  p_user_id uuid,
  p_household_name text,
  p_display_name text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_member_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('homewebsite.bootstrap_initial_household'));

  if exists (select 1 from public.households) then
    raise exception using errcode = 'P0001', message = 'ALREADY_INITIALIZED';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = p_user_id
      and email_confirmed_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'VERIFIED_USER_REQUIRED';
  end if;

  if char_length(btrim(p_household_name)) not between 1 and 80
    or char_length(btrim(p_display_name)) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;

  insert into public.households (name, created_by)
  values (btrim(p_household_name), p_user_id)
  returning id into v_household_id;

  insert into public.household_members (
    household_id,
    user_id,
    display_name,
    role,
    status,
    status_changed_by
  )
  values (
    v_household_id,
    p_user_id,
    btrim(p_display_name),
    'admin',
    'active',
    p_user_id
  )
  returning id into v_member_id;

  perform private.append_household_audit(
    v_household_id,
    'household.created',
    p_user_id,
    'household',
    v_household_id,
    p_user_id,
    '{}'::jsonb
  );

  perform private.append_household_audit(
    v_household_id,
    'member.joined',
    p_user_id,
    'member',
    v_member_id,
    p_user_id,
    jsonb_build_object('role', 'admin')
  );

  return v_household_id;
end;
$$;

create or replace function public.get_my_access_context()
returns table (
  access_kind text,
  household_id uuid,
  role public.household_role,
  invitation_id uuid,
  request_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email extensions.citext;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  perform private.expire_household_invitations(null);

  return query
  select
    case member.status
      when 'active' then 'active'
      when 'suspended' then 'suspended'
      when 'removed' then 'removed'
    end,
    member.household_id,
    member.role,
    null::uuid,
    null::uuid
  from public.household_members as member
  where member.user_id = v_user_id
    and member.status in ('active', 'suspended')
  order by member.created_at desc
  limit 1;

  if found then
    return;
  end if;

  v_email := private.current_auth_email();

  if v_email is not null then
    return query
    select
      'invited'::text,
      invitation.household_id,
      null::public.household_role,
      invitation.id,
      null::uuid
    from public.household_invitations as invitation
    where invitation.invitee_email = v_email
      and invitation.status = 'pending'
      and invitation.expires_at > now()
    order by invitation.expires_at asc
    limit 1;

    if found then
      return;
    end if;
  end if;

  return query
  select
    'removed'::text,
    member.household_id,
    member.role,
    null::uuid,
    null::uuid
  from public.household_members as member
  where member.user_id = v_user_id
    and member.status = 'removed'
  order by member.status_changed_at desc
  limit 1;

  if found then
    return;
  end if;

  return query
  select
    'unassigned'::text,
    null::uuid,
    null::public.household_role,
    null::uuid,
    null::uuid;
end;
$$;

create or replace function public.create_household_invitation(
  p_actor_user_id uuid,
  p_household_id uuid,
  p_email text
)
returns table (
  invitation_id uuid,
  raw_token text,
  normalized_email text,
  expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext := lower(btrim(p_email))::extensions.citext;
  v_token text;
  v_invitation_id uuid;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if p_actor_user_id is null or not exists (
    select 1
    from public.household_members
    where household_id = p_household_id
      and user_id = p_actor_user_id
      and role = 'admin'
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  if char_length(v_email::text) not between 3 and 320
    or v_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'INVALID_EMAIL';
  end if;

  perform private.expire_household_invitations(p_household_id);

  if exists (
    select 1
    from public.household_members as member
    join auth.users as users on users.id = member.user_id
    where member.household_id = p_household_id
      and lower(btrim(users.email))::extensions.citext = v_email
      and member.status in ('active', 'suspended')
  ) then
    raise exception using errcode = 'P0001', message = 'MEMBER_ALREADY_EXISTS';
  end if;

  if exists (
    select 1
    from public.household_members as member
    join auth.users as users on users.id = member.user_id
    where member.household_id = p_household_id
      and lower(btrim(users.email))::extensions.citext = v_email
      and member.status = 'removed'
  ) then
    raise exception using errcode = 'P0001', message = 'REMOVED_MEMBER_REJOIN_BLOCKED';
  end if;

  if exists (
    select 1
    from public.household_invitations
    where household_id = p_household_id
      and invitee_email = v_email
      and status = 'pending'
  ) then
    raise exception using errcode = 'P0001', message = 'INVITATION_ALREADY_PENDING';
  end if;

  v_token := translate(
    rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/',
    '-_'
  );

  insert into public.household_invitations (
    household_id,
    invitee_email,
    token_hash,
    created_by,
    expires_at
  )
  values (
    p_household_id,
    v_email,
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
    p_actor_user_id,
    v_expires_at
  )
  returning id into v_invitation_id;

  perform private.append_household_audit(
    p_household_id,
    'invitation.created',
    p_actor_user_id,
    'invitation',
    v_invitation_id,
    null,
    '{}'::jsonb
  );

  return query
  select v_invitation_id, v_token, v_email::text, v_expires_at;
end;
$$;

create or replace function public.mark_invitation_delivery(
  p_invitation_id uuid,
  p_succeeded boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invitation public.household_invitations%rowtype;
begin
  update public.household_invitations
  set
    delivery_status = case when p_succeeded then 'sent' else 'failed' end,
    delivery_attempts = delivery_attempts + 1,
    last_delivery_at = now()
  where id = p_invitation_id
  returning * into v_invitation;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITATION_INVALID';
  end if;

  perform private.append_household_audit(
    v_invitation.household_id,
    case when p_succeeded
      then 'invitation.sent'
      else 'invitation.delivery_failed'
    end,
    v_invitation.created_by,
    'invitation',
    v_invitation.id,
    null,
    jsonb_build_object('attempt', v_invitation.delivery_attempts)
  );
end;
$$;

create or replace function public.cancel_household_invitation(
  p_invitation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_invitation public.household_invitations%rowtype;
begin
  select *
  into v_invitation
  from public.household_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITATION_INVALID';
  end if;

  if not private.is_active_household_admin(v_invitation.household_id) then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'INVITATION_NOT_PENDING';
  end if;

  if v_invitation.expires_at <= now() then
    perform private.expire_household_invitations(v_invitation.household_id);
    raise exception using errcode = 'P0001', message = 'INVITATION_EXPIRED';
  end if;

  update public.household_invitations
  set
    status = 'cancelled',
    cancelled_by = v_actor_user_id,
    cancelled_at = now()
  where id = p_invitation_id;

  perform private.append_household_audit(
    v_invitation.household_id,
    'invitation.cancelled',
    v_actor_user_id,
    'invitation',
    v_invitation.id,
    null,
    '{}'::jsonb
  );
end;
$$;

create or replace function public.accept_household_invitation(
  p_raw_token text,
  p_display_name text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email extensions.citext;
  v_invitation public.household_invitations%rowtype;
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if char_length(btrim(p_display_name)) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'INVALID_DISPLAY_NAME';
  end if;

  v_email := private.current_auth_email();
  if v_email is null then
    raise exception using errcode = 'P0001', message = 'VERIFIED_EMAIL_REQUIRED';
  end if;

  select *
  into v_invitation
  from public.household_invitations
  where token_hash = extensions.digest(convert_to(p_raw_token, 'UTF8'), 'sha256')
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITATION_INVALID';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'INVITATION_NOT_PENDING';
  end if;

  if v_invitation.expires_at <= now() then
    update public.household_invitations
    set status = 'expired'
    where id = v_invitation.id;

    perform private.append_household_audit(
      v_invitation.household_id,
      'invitation.expired',
      null,
      'invitation',
      v_invitation.id,
      null,
      '{}'::jsonb
    );

    raise exception using errcode = 'P0001', message = 'INVITATION_EXPIRED';
  end if;

  if v_invitation.invitee_email <> v_email then
    raise exception using errcode = 'P0001', message = 'INVITATION_EMAIL_MISMATCH';
  end if;

  if exists (
    select 1
    from public.household_members
    where user_id = v_user_id
      and status in ('active', 'suspended')
  ) then
    raise exception using errcode = 'P0001', message = 'OTHER_HOUSEHOLD_MEMBERSHIP';
  end if;

  if exists (
    select 1
    from public.household_members
    where household_id = v_invitation.household_id
      and user_id = v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'REMOVED_MEMBER_REJOIN_BLOCKED';
  end if;

  insert into public.household_members (
    household_id,
    user_id,
    display_name,
    role,
    status,
    status_changed_by
  )
  values (
    v_invitation.household_id,
    v_user_id,
    btrim(p_display_name),
    'member',
    'active',
    v_user_id
  )
  returning id into v_member_id;

  update public.household_invitations
  set
    status = 'accepted',
    accepted_by = v_user_id,
    accepted_at = now()
  where id = v_invitation.id;

  perform private.append_household_audit(
    v_invitation.household_id,
    'invitation.accepted',
    v_user_id,
    'invitation',
    v_invitation.id,
    v_user_id,
    '{}'::jsonb
  );

  perform private.append_household_audit(
    v_invitation.household_id,
    'member.joined',
    v_user_id,
    'member',
    v_member_id,
    v_user_id,
    jsonb_build_object('role', 'member')
  );

  return v_invitation.household_id;
end;
$$;

create or replace function public.change_household_member_status(
  p_member_id uuid,
  p_target_status public.household_member_status
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_member public.household_members%rowtype;
  v_action text;
begin
  select *
  into v_member
  from public.household_members
  where id = p_member_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;

  if not private.is_active_household_admin(v_member.household_id) then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  if v_member.user_id = v_actor_user_id then
    raise exception using errcode = 'P0001', message = 'SELF_MANAGEMENT_FORBIDDEN';
  end if;

  if v_member.role = 'admin' then
    raise exception using errcode = 'P0001', message = 'ADMIN_ROLE_CHANGE_FORBIDDEN';
  end if;

  if not (
    (v_member.status = 'active' and p_target_status in ('suspended', 'removed'))
    or (v_member.status = 'suspended' and p_target_status in ('active', 'removed'))
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;

  v_action := case p_target_status
    when 'active' then 'member.reactivated'
    when 'suspended' then 'member.suspended'
    when 'removed' then 'member.removed'
  end;

  update public.household_members
  set
    status = p_target_status,
    status_changed_at = now(),
    status_changed_by = v_actor_user_id,
    removed_at = case when p_target_status = 'removed' then now() else null end
  where id = p_member_id;

  perform private.append_household_audit(
    v_member.household_id,
    v_action,
    v_actor_user_id,
    'member',
    v_member.id,
    v_member.user_id,
    jsonb_build_object(
      'from_status', v_member.status::text,
      'to_status', p_target_status::text
    )
  );
end;
$$;

create or replace function public.update_my_household_profile(
  p_household_id uuid,
  p_display_name text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_member_id uuid;
begin
  if char_length(btrim(p_display_name)) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'INVALID_DISPLAY_NAME';
  end if;

  update public.household_members
  set display_name = btrim(p_display_name)
  where household_id = p_household_id
    and user_id = v_user_id
    and status = 'active'
  returning id into v_member_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'ACTIVE_MEMBERSHIP_REQUIRED';
  end if;

  perform private.append_household_audit(
    p_household_id,
    'member.profile_updated',
    v_user_id,
    'member',
    v_member_id,
    v_user_id,
    '{}'::jsonb
  );
end;
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.households from anon, authenticated;
revoke all on table public.household_members from anon, authenticated;
revoke all on table public.household_invitations from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant select on table public.households to authenticated;
grant select on table public.household_members to authenticated;
grant select on table public.household_invitations to authenticated;

create policy households_select_active_member
on public.households
for select
to authenticated
using ((select private.is_active_household_member(id)));

create policy household_members_select_self_or_admin
on public.household_members
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    user_id = (select auth.uid())
    or (select private.is_active_household_admin(household_id))
  )
);

create policy household_invitations_select_admin
on public.household_invitations
for select
to authenticated
using ((select private.is_active_household_admin(household_id)));

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_active_household_member(uuid) to authenticated;
grant execute on function private.is_active_household_admin(uuid) to authenticated;

revoke execute on function public.bootstrap_initial_household(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.bootstrap_initial_household(uuid, text, text)
  to service_role;

revoke execute on function public.get_my_access_context()
  from public, anon;
grant execute on function public.get_my_access_context()
  to authenticated;

revoke execute on function public.create_household_invitation(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_household_invitation(uuid, uuid, text)
  to service_role;

revoke execute on function public.mark_invitation_delivery(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.mark_invitation_delivery(uuid, boolean)
  to service_role;

revoke execute on function public.cancel_household_invitation(uuid)
  from public, anon;
grant execute on function public.cancel_household_invitation(uuid)
  to authenticated;

revoke execute on function public.accept_household_invitation(text, text)
  from public, anon;
grant execute on function public.accept_household_invitation(text, text)
  to authenticated;

revoke execute on function public.change_household_member_status(
  uuid,
  public.household_member_status
) from public, anon;
grant execute on function public.change_household_member_status(
  uuid,
  public.household_member_status
) to authenticated;

revoke execute on function public.update_my_household_profile(uuid, text)
  from public, anon;
grant execute on function public.update_my_household_profile(uuid, text)
  to authenticated;

revoke execute on function private.current_auth_email()
  from public, anon, authenticated;
revoke execute on function private.append_household_audit(
  uuid,
  text,
  uuid,
  text,
  uuid,
  uuid,
  jsonb
) from public, anon, authenticated;
revoke execute on function private.expire_household_invitations(uuid)
  from public, anon, authenticated;

comment on table public.households is
  'Top-level security boundary for shared family data.';
comment on table public.household_members is
  'Current and historical household memberships. Removed rows are retained.';
comment on table public.household_invitations is
  'One-time household invitations. Only SHA-256 token hashes are stored.';
comment on table public.audit_logs is
  'Append-only household security and membership audit events.';
