export type HouseholdRole = 'admin' | 'member';
export type HouseholdMemberStatus = 'active' | 'suspended' | 'removed';
export type HouseholdInvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';
export type InvitationDeliveryStatus = 'queued' | 'sent' | 'failed';

export type Household = {
  id: string;
  name: string;
  createdAt: string;
};

export type HouseholdMember = {
  id: string;
  householdId: string;
  userId: string;
  displayName: string;
  role: HouseholdRole;
  status: HouseholdMemberStatus;
  joinedAt: string;
  statusChangedAt: string;
};

export type HouseholdInvitation = {
  id: string;
  householdId: string;
  inviteeEmail: string;
  status: HouseholdInvitationStatus;
  deliveryStatus: InvitationDeliveryStatus;
  expiresAt: string;
  createdAt: string;
};

export type AccessContext =
  | { kind: 'active'; householdId: string; role: HouseholdRole }
  | { kind: 'invited'; householdId: string; invitationId: string }
  | { kind: 'suspended'; householdId: string; role: HouseholdRole }
  | { kind: 'removed'; householdId: string; role: HouseholdRole }
  | { kind: 'pending'; requestId: string }
  | { kind: 'unassigned' };

export const HOUSEHOLD_ERROR_MESSAGES = {
  ADMIN_REQUIRED: '가족 관리자만 이 작업을 할 수 있습니다.',
  MEMBER_ALREADY_EXISTS: '이미 가족 구성원으로 등록된 이메일입니다.',
  OTHER_HOUSEHOLD_MEMBERSHIP: '이미 다른 가족 공간에 참여 중인 계정입니다.',
  INVITATION_ALREADY_PENDING: '아직 유효한 초대가 있습니다.',
  INVITATION_INVALID: '유효하지 않은 초대입니다.',
  INVITATION_EXPIRED: '초대가 만료되었습니다. 관리자에게 새 초대를 요청해 주세요.',
  INVITATION_NOT_PENDING: '이미 처리된 초대입니다.',
  INVITATION_EMAIL_MISMATCH: '초대받은 이메일 계정으로 로그인해 주세요.',
  INVALID_STATUS_TRANSITION: '현재 상태에서는 해당 변경을 할 수 없습니다.',
  SELF_MANAGEMENT_FORBIDDEN: '관리자는 자신의 상태를 직접 변경할 수 없습니다.',
  REMOVED_MEMBER_REJOIN_BLOCKED: '탈퇴 처리된 구성원은 현재 다시 초대할 수 없습니다.',
  INVITATION_DELIVERY_FAILED: '초대 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.',
} as const;

export type HouseholdErrorCode = keyof typeof HOUSEHOLD_ERROR_MESSAGES;

export function householdErrorMessage(code: string | null | undefined): string {
  if (code && code in HOUSEHOLD_ERROR_MESSAGES) {
    return HOUSEHOLD_ERROR_MESSAGES[code as HouseholdErrorCode];
  }

  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');

  if (atIndex <= 0) {
    return '***';
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const visibleLength = Math.min(2, local.length);

  return `${local.slice(0, visibleLength)}${'*'.repeat(Math.max(3, local.length - visibleLength))}@${domain}`;
}
