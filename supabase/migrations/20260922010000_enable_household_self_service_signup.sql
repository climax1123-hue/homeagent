create or replace function public.create_my_household(
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
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = v_user_id
      and email_confirmed_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'VERIFIED_USER_REQUIRED';
  end if;

  if exists (
    select 1
    from public.household_members
    where user_id = v_user_id
      and status in ('active', 'suspended')
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_HAS_HOUSEHOLD';
  end if;

  if char_length(btrim(p_household_name)) not between 1 and 80
    or char_length(btrim(p_display_name)) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;

  insert into public.households (name, created_by)
  values (btrim(p_household_name), v_user_id)
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
    v_user_id,
    btrim(p_display_name),
    'admin',
    'active',
    v_user_id
  )
  returning id into v_member_id;

  perform private.append_household_audit(
    v_household_id,
    'household.created',
    v_user_id,
    'household',
    v_household_id,
    v_user_id,
    jsonb_build_object('signup', 'self_service')
  );

  perform private.append_household_audit(
    v_household_id,
    'member.joined',
    v_user_id,
    'member',
    v_member_id,
    v_user_id,
    jsonb_build_object('role', 'admin')
  );

  return v_household_id;
end;
$$;

revoke execute on function public.create_my_household(text, text) from public, anon;
grant execute on function public.create_my_household(text, text) to authenticated;

comment on function public.create_my_household(text, text) is
  'Creates one household and active admin membership for a verified, currently unassigned user.';

