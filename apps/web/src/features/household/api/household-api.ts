import type {
  AccessContext,
  Household,
  HouseholdInvitation,
  HouseholdMember,
  HouseholdMemberStatus,
  HouseholdRole,
} from '@home/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type HouseholdRow = {
  id: string;
  name: string;
  created_at: string;
};

type MemberRow = {
  id: string;
  household_id: string;
  user_id: string;
  display_name: string;
  role: HouseholdRole;
  status: HouseholdMemberStatus;
  joined_at: string;
  status_changed_at: string;
};

type InvitationRow = {
  id: string;
  household_id: string;
  invitee_email: string;
  status: HouseholdInvitation['status'];
  delivery_status: HouseholdInvitation['deliveryStatus'];
  expires_at: string;
  created_at: string;
};

type AccessContextRow = {
  access_kind: AccessContext['kind'];
  household_id: string | null;
  role: HouseholdRole | null;
  invitation_id: string | null;
  request_id: string | null;
};

export class HouseholdApiError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'HouseholdApiError';
    this.code = code;
  }
}

const DOMAIN_ERROR_CODES = [
  'AUTH_REQUIRED',
  'ADMIN_REQUIRED',
  'MEMBER_ALREADY_EXISTS',
  'OTHER_HOUSEHOLD_MEMBERSHIP',
  'INVITATION_ALREADY_PENDING',
  'INVITATION_INVALID',
  'INVITATION_EXPIRED',
  'INVITATION_NOT_PENDING',
  'INVITATION_EMAIL_MISMATCH',
  'INVALID_STATUS_TRANSITION',
  'SELF_MANAGEMENT_FORBIDDEN',
  'REMOVED_MEMBER_REJOIN_BLOCKED',
  'INVITATION_DELIVERY_FAILED',
] as const;

function errorCode(message: string | undefined): string {
  return DOMAIN_ERROR_CODES.find((code) => message?.includes(code)) ?? 'UNKNOWN_ERROR';
}

function ensureNoError(error: { message?: string } | null): void {
  if (error) {
    throw new HouseholdApiError(errorCode(error.message));
  }
}

function mapHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function mapMember(row: MemberRow): HouseholdMember {
  return {
    id: row.id,
    householdId: row.household_id,
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    statusChangedAt: row.status_changed_at,
  };
}

function mapInvitation(row: InvitationRow): HouseholdInvitation {
  return {
    id: row.id,
    householdId: row.household_id,
    inviteeEmail: row.invitee_email,
    status: row.status,
    deliveryStatus: row.delivery_status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function createHouseholdApi(client: SupabaseClient) {
  return {
    async getAccessContext(): Promise<AccessContext> {
      const { data, error } = await client.rpc('get_my_access_context');
      ensureNoError(error);

      const row = (Array.isArray(data) ? data[0] : null) as AccessContextRow | null;

      if (!row || row.access_kind === 'unassigned') {
        return { kind: 'unassigned' };
      }

      if (row.access_kind === 'pending' && row.request_id) {
        return { kind: 'pending', requestId: row.request_id };
      }

      if (row.access_kind === 'invited' && row.household_id && row.invitation_id) {
        return {
          kind: 'invited',
          householdId: row.household_id,
          invitationId: row.invitation_id,
        };
      }

      if (
        (row.access_kind === 'active' ||
          row.access_kind === 'suspended' ||
          row.access_kind === 'removed') &&
        row.household_id &&
        row.role
      ) {
        return {
          kind: row.access_kind,
          householdId: row.household_id,
          role: row.role,
        };
      }

      throw new HouseholdApiError('INVALID_ACCESS_CONTEXT');
    },

    async getHousehold(householdId: string): Promise<Household> {
      const { data, error } = await client
        .from('households')
        .select('id, name, created_at')
        .eq('id', householdId)
        .single();
      ensureNoError(error);

      return mapHousehold(data as HouseholdRow);
    },

    async listMembers(householdId: string): Promise<HouseholdMember[]> {
      const { data, error } = await client
        .from('household_members')
        .select(
          'id, household_id, user_id, display_name, role, status, joined_at, status_changed_at',
        )
        .eq('household_id', householdId)
        .order('joined_at', { ascending: true });
      ensureNoError(error);

      return ((data ?? []) as MemberRow[]).map(mapMember);
    },

    async listInvitations(householdId: string): Promise<HouseholdInvitation[]> {
      const { data, error } = await client
        .from('household_invitations')
        .select('id, household_id, invitee_email, status, delivery_status, expires_at, created_at')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });
      ensureNoError(error);

      return ((data ?? []) as InvitationRow[]).map(mapInvitation);
    },

    async invite(householdId: string, email: string): Promise<void> {
      const { error } = await client.functions.invoke('create-household-invitation', {
        body: { householdId, email: email.trim().toLowerCase() },
      });
      ensureNoError(error);
    },

    async cancelInvitation(invitationId: string): Promise<void> {
      const { error } = await client.rpc('cancel_household_invitation', {
        p_invitation_id: invitationId,
      });
      ensureNoError(error);
    },

    async acceptInvitation(rawToken: string, displayName: string): Promise<string> {
      const { data, error } = await client.rpc('accept_household_invitation', {
        p_raw_token: rawToken,
        p_display_name: displayName.trim(),
      });
      ensureNoError(error);

      if (typeof data !== 'string') {
        throw new HouseholdApiError('INVALID_ACCEPT_RESPONSE');
      }

      return data;
    },

    async changeMemberStatus(memberId: string, targetStatus: HouseholdMemberStatus): Promise<void> {
      const { error } = await client.rpc('change_household_member_status', {
        p_member_id: memberId,
        p_target_status: targetStatus,
      });
      ensureNoError(error);
    },

    async updateMyDisplayName(householdId: string, displayName: string): Promise<void> {
      const { error } = await client.rpc('update_my_household_profile', {
        p_household_id: householdId,
        p_display_name: displayName.trim(),
      });
      ensureNoError(error);
    },
  };
}
