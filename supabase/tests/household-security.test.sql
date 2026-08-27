begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

select has_table('public', 'households', 'households table exists');
select has_table('public', 'household_members', 'household_members table exists');
select has_table('public', 'household_invitations', 'household_invitations table exists');
select has_table('public', 'audit_logs', 'audit_logs table exists');

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.households'::regclass
  ),
  'households has RLS enabled'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'member@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'outsider@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

create temporary table household_test_state (
  household_id uuid,
  invitation_id uuid,
  raw_token text
) on commit drop;

grant select, update on household_test_state to authenticated, service_role;

insert into household_test_state (household_id)
select public.bootstrap_initial_household(
  '10000000-0000-4000-8000-000000000001',
  '테스트 가족',
  '관리자'
);

select is(
  (select count(*) from public.households),
  1::bigint,
  'bootstrap creates one household'
);

select is(
  (
    select count(*)
    from public.household_members
    where role = 'admin' and status = 'active'
  ),
  1::bigint,
  'bootstrap creates one active admin'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select count(*) from public.households),
  1::bigint,
  'active admin can read their household'
);

select is(
  (select count(*) from public.household_members),
  1::bigint,
  'active admin can read household members'
);

reset role;

with created as (
  select *
  from public.create_household_invitation(
    '10000000-0000-4000-8000-000000000001',
    (select household_id from household_test_state limit 1),
    '  MEMBER@EXAMPLE.TEST '
  )
)
update household_test_state
set
  invitation_id = created.invitation_id,
  raw_token = created.raw_token
from created;

select is(
  (
    select invitee_email::text
    from public.household_invitations
    where id = (select invitation_id from household_test_state)
  ),
  'member@example.test',
  'invitation email is normalized'
);

select isnt(
  encode(
    (
      select token_hash
      from public.household_invitations
      where id = (select invitation_id from household_test_state)
    ),
    'hex'
  ),
  (select raw_token from household_test_state),
  'only a token hash is stored'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000003';

select is(
  (select count(*) from public.households),
  0::bigint,
  'unrelated user cannot read a household'
);

select is(
  (select count(*) from public.household_members),
  0::bigint,
  'unrelated user cannot read household members'
);

select throws_ok(
  format(
    'select public.cancel_household_invitation(%L::uuid)',
    (select invitation_id from household_test_state)
  ),
  'P0001',
  'ADMIN_REQUIRED',
  'unrelated user cannot cancel an invitation'
);

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

select is(
  public.accept_household_invitation(
    (select raw_token from household_test_state),
    '가족'
  ),
  (select household_id from household_test_state limit 1),
  'invited user accepts with the matching verified email'
);

select throws_ok(
  format('select public.accept_household_invitation(%L, %L)', (select raw_token from household_test_state), '가족'),
  'P0001', 'INVITATION_NOT_PENDING', 'accepted invitation cannot be reused'
);

select is(
  (
    select access_kind
    from public.get_my_access_context()
  ),
  'active',
  'accepted member receives active access context'
);

select is(
  (select count(*) from public.household_members),
  1::bigint,
  'member can read only their own membership row'
);

select throws_ok(
  format(
    'select public.cancel_household_invitation(%L::uuid)',
    (select invitation_id from household_test_state)
  ),
  'P0001',
  'ADMIN_REQUIRED',
  'member cannot perform admin invitation actions'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

select throws_ok(
  format('select public.change_household_member_status(%L::uuid, %L::public.household_member_status)', (select id from public.household_members where user_id = '10000000-0000-4000-8000-000000000001'), 'removed'),
  'P0001', 'SELF_MANAGEMENT_FORBIDDEN', 'admin cannot change own status'
);

select lives_ok(
  format(
    'select public.change_household_member_status(%L::uuid, %L::public.household_member_status)',
    (
      select id
      from public.household_members
      where user_id = '10000000-0000-4000-8000-000000000002'
    ),
    'suspended'
  ),
  'admin can suspend a regular member'
);

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

select is(
  (
    select access_kind
    from public.get_my_access_context()
  ),
  'suspended',
  'suspended member receives suspended access context'
);

select is(
  (select count(*) from public.households),
  0::bigint,
  'suspended member cannot read household business data'
);

reset role;

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

select lives_ok(
  format('select public.change_household_member_status(%L::uuid, %L::public.household_member_status)', (select id from public.household_members where user_id = '10000000-0000-4000-8000-000000000002'), 'active'),
  'admin can reactivate a suspended member'
);

select lives_ok(
  format('select public.change_household_member_status(%L::uuid, %L::public.household_member_status)', (select id from public.household_members where user_id = '10000000-0000-4000-8000-000000000002'), 'removed'),
  'admin can soft remove an active member'
);

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
select is((select access_kind from public.get_my_access_context()), 'removed', 'removed member receives removed access context');
reset role;

select ok(
  not has_function_privilege('anon', 'public.change_household_member_status(uuid, public.household_member_status)', 'EXECUTE'),
  'anon cannot execute member status mutation'
);

select ok(
  (
    select count(*)
    from public.audit_logs
    where household_id = (select household_id from household_test_state limit 1)
  ) >= 6,
  'security-sensitive mutations append audit events'
);

select * from finish();
rollback;
