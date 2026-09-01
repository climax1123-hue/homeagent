import type { Household, HouseholdInvitation, HouseholdMember } from '@home/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemberManagementPage } from './MemberManagementPage';

const household: Household = {
  id: '00000000-0000-4000-8000-000000000001',
  name: '우리 가족',
  createdAt: '2026-08-26T00:00:00.000Z',
};

const members: HouseholdMember[] = [
  {
    id: 'admin-member',
    householdId: household.id,
    userId: 'admin-user',
    displayName: '관리자',
    role: 'admin',
    status: 'active',
    joinedAt: '2026-08-26T00:00:00.000Z',
    statusChangedAt: '2026-08-26T00:00:00.000Z',
  },
  {
    id: 'family-member',
    householdId: household.id,
    userId: 'family-user',
    displayName: '가족',
    role: 'member',
    status: 'active',
    joinedAt: '2026-08-26T01:00:00.000Z',
    statusChangedAt: '2026-08-26T01:00:00.000Z',
  },
];

const invitations: HouseholdInvitation[] = [
  {
    id: 'invitation-id',
    householdId: household.id,
    inviteeEmail: 'family.member@example.com',
    status: 'pending',
    deliveryStatus: 'sent',
    expiresAt: '2026-09-02T00:00:00.000Z',
    createdAt: '2026-08-26T00:00:00.000Z',
  },
];

function renderPage(overrides: Partial<Parameters<typeof MemberManagementPage>[0]> = {}) {
  const props = {
    household,
    members,
    invitations,
    currentUserId: 'admin-user',
    onInvite: vi.fn().mockResolvedValue({
      invitationId: 'new-invitation',
      deliveryStatus: 'sent',
      invitationUrl: 'https://home.example/invite#token=one-time',
      expiresAt: '2026-09-09T00:00:00.000Z',
    }),
    onCancelInvitation: vi.fn().mockResolvedValue(undefined),
    onChangeMemberStatus: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  render(<MemberManagementPage {...props} />);
  return props;
}

describe('MemberManagementPage', () => {
  it('renders members and masks invitation email addresses', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '우리 가족' })).toBeInTheDocument();
    expect(screen.getByText('관리자')).toBeInTheDocument();
    expect(screen.getByText('가족')).toBeInTheDocument();
    expect(screen.getByText('fa***********@example.com')).toBeInTheDocument();
    expect(screen.queryByText('family.member@example.com')).not.toBeInTheDocument();
  });

  it('normalizes and submits an invitation email once', async () => {
    const props = renderPage();

    fireEvent.change(screen.getByLabelText('개인 이메일 주소'), {
      target: { value: '  FAMILY@EXAMPLE.COM  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: '초대 메일 보내기' }));

    await waitFor(() => expect(props.onInvite).toHaveBeenCalledWith('family@example.com'));
    expect(props.onInvite).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('가족 초대 메일을 보냈습니다.');
    expect(screen.getByLabelText('초대 링크')).toHaveValue(
      'https://home.example/invite#token=one-time',
    );
  });

  it('shows a shareable link when email delivery fails', async () => {
    renderPage({
      onInvite: vi.fn().mockResolvedValue({
        invitationId: 'fallback-invitation',
        deliveryStatus: 'failed',
        invitationUrl: 'https://home.example/invite#token=fallback',
        expiresAt: '2026-09-09T00:00:00.000Z',
      }),
    });

    fireEvent.change(screen.getByLabelText('개인 이메일 주소'), {
      target: { value: 'family@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '초대 메일 보내기' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('초대는 생성했습니다'),
    );
    expect(screen.getByLabelText('초대 링크')).toHaveValue(
      'https://home.example/invite#token=fallback',
    );
  });

  it('requires confirmation before removing a member', async () => {
    const props = renderPage();

    fireEvent.click(screen.getByRole('button', { name: '탈퇴 처리' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(props.onChangeMemberStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog').querySelector('.danger-action')!);

    await waitFor(() =>
      expect(props.onChangeMemberStatus).toHaveBeenCalledWith('family-member', 'removed'),
    );
  });

  it('cancels a pending invitation', async () => {
    const props = renderPage();

    fireEvent.click(screen.getByRole('button', { name: '초대 취소' }));

    await waitFor(() => expect(props.onCancelInvitation).toHaveBeenCalledWith('invitation-id'));
  });
});
