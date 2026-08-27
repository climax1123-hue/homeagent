import {
  householdErrorMessage,
  maskEmail,
  type Household,
  type HouseholdInvitation,
  type HouseholdMember,
  type HouseholdMemberStatus,
} from '@home/shared';
import { FormEvent, useId, useState } from 'react';
import '../household.css';

type MemberManagementPageProps = {
  household: Household;
  members: HouseholdMember[];
  invitations: HouseholdInvitation[];
  currentUserId: string;
  onInvite: (email: string) => Promise<void>;
  onCancelInvitation: (invitationId: string) => Promise<void>;
  onChangeMemberStatus: (memberId: string, targetStatus: HouseholdMemberStatus) => Promise<void>;
};

type PendingStatusChange = {
  member: HouseholdMember;
  targetStatus: HouseholdMemberStatus;
};

const STATUS_LABELS: Record<HouseholdMemberStatus, string> = {
  active: '활성',
  suspended: '정지',
  removed: '탈퇴',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}

function readableError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return householdErrorMessage(String(error.code));
  }

  return householdErrorMessage(undefined);
}

function targetActionLabel(status: HouseholdMemberStatus): string {
  if (status === 'active') return '재활성화';
  if (status === 'suspended') return '일시 정지';
  return '탈퇴 처리';
}

export function MemberManagementPage({
  household,
  members,
  invitations,
  currentUserId,
  onInvite,
  onCancelInvitation,
  onChangeMemberStatus,
}: MemberManagementPageProps) {
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [statusChange, setStatusChange] = useState<PendingStatusChange | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeInvitations = invitations.filter((invitation) => invitation.status === 'pending');

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('초대할 이메일 주소를 입력해 주세요.');
      return;
    }

    setPendingAction('invite');
    setError(null);
    setMessage(null);

    try {
      await onInvite(normalizedEmail);
      setEmail('');
      setMessage('가족 초대 메일을 보냈습니다.');
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setPendingAction(null);
    }
  }

  async function cancelInvitation(invitation: HouseholdInvitation) {
    setPendingAction(`invitation:${invitation.id}`);
    setError(null);
    setMessage(null);

    try {
      await onCancelInvitation(invitation.id);
      setMessage('초대를 취소했습니다.');
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setPendingAction(null);
    }
  }

  async function confirmStatusChange() {
    if (!statusChange) return;

    setPendingAction(`member:${statusChange.member.id}`);
    setError(null);
    setMessage(null);

    try {
      await onChangeMemberStatus(statusChange.member.id, statusChange.targetStatus);
      setMessage(
        `${statusChange.member.displayName} 구성원을 ${targetActionLabel(statusChange.targetStatus)}했습니다.`,
      );
      setStatusChange(null);
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="household-page">
      <header className="household-header">
        <div>
          <p className="household-eyebrow">가족 설정</p>
          <h1>{household.name}</h1>
          <p>가족 구성원의 초대와 접근 상태를 안전하게 관리합니다.</p>
        </div>
        <span className="household-count">구성원 {members.length}명</span>
      </header>

      {(message || error) && (
        <div
          className={error ? 'household-alert household-alert--error' : 'household-alert'}
          role={error ? 'alert' : 'status'}
        >
          {error ?? message}
        </div>
      )}

      <div className="household-layout">
        <section className="household-panel" aria-labelledby="members-heading">
          <div className="household-section-heading">
            <div>
              <h2 id="members-heading">가족 구성원</h2>
              <p>정지 또는 탈퇴 처리는 다음 요청부터 즉시 적용됩니다.</p>
            </div>
          </div>

          <div className="member-list">
            {members.map((member) => {
              const isCurrentUser = member.userId === currentUserId;
              const isBusy = pendingAction === `member:${member.id}`;

              return (
                <article className="member-card" key={member.id}>
                  <div className="member-identity">
                    <span className="member-avatar" aria-hidden="true">
                      {member.displayName.slice(0, 1)}
                    </span>
                    <div>
                      <h3>
                        {member.displayName}
                        {isCurrentUser && <span className="member-self">나</span>}
                      </h3>
                      <p>
                        {member.role === 'admin' ? '관리자' : '구성원'} · 가입일{' '}
                        {formatDate(member.joinedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="member-actions">
                    <span className={`status-badge status-badge--${member.status}`}>
                      {STATUS_LABELS[member.status]}
                    </span>

                    {!isCurrentUser && member.role === 'member' && member.status === 'active' && (
                      <>
                        <button
                          className="secondary-action"
                          disabled={isBusy}
                          onClick={() => setStatusChange({ member, targetStatus: 'suspended' })}
                          type="button"
                        >
                          일시 정지
                        </button>
                        <button
                          className="danger-action"
                          disabled={isBusy}
                          onClick={() => setStatusChange({ member, targetStatus: 'removed' })}
                          type="button"
                        >
                          탈퇴 처리
                        </button>
                      </>
                    )}

                    {!isCurrentUser &&
                      member.role === 'member' &&
                      member.status === 'suspended' && (
                        <>
                          <button
                            className="secondary-action"
                            disabled={isBusy}
                            onClick={() => setStatusChange({ member, targetStatus: 'active' })}
                            type="button"
                          >
                            재활성화
                          </button>
                          <button
                            className="danger-action"
                            disabled={isBusy}
                            onClick={() => setStatusChange({ member, targetStatus: 'removed' })}
                            type="button"
                          >
                            탈퇴 처리
                          </button>
                        </>
                      )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="household-panel household-invitations" aria-labelledby="invite-heading">
          <div className="household-section-heading">
            <div>
              <h2 id="invite-heading">가족 초대</h2>
              <p>초대 링크는 7일 동안 한 번만 사용할 수 있습니다.</p>
            </div>
          </div>

          <form className="invitation-form" onSubmit={submitInvitation}>
            <label htmlFor={emailId}>개인 이메일 주소</label>
            <input
              autoComplete="email"
              disabled={pendingAction === 'invite'}
              id={emailId}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="family@example.com"
              required
              type="email"
              value={email}
            />
            <button className="primary-action" disabled={pendingAction === 'invite'} type="submit">
              {pendingAction === 'invite' ? '보내는 중…' : '초대 메일 보내기'}
            </button>
          </form>

          <div className="invitation-list" aria-label="대기 중인 초대">
            <h3>대기 중인 초대</h3>
            {activeInvitations.length === 0 ? (
              <p className="empty-message">현재 대기 중인 초대가 없습니다.</p>
            ) : (
              activeInvitations.map((invitation) => (
                <article className="invitation-item" key={invitation.id}>
                  <div>
                    <strong>{maskEmail(invitation.inviteeEmail)}</strong>
                    <p>
                      {formatDate(invitation.expiresAt)} 만료 ·{' '}
                      {invitation.deliveryStatus === 'sent' ? '발송 완료' : '발송 확인 필요'}
                    </p>
                  </div>
                  <button
                    className="text-action"
                    disabled={pendingAction === `invitation:${invitation.id}`}
                    onClick={() => void cancelInvitation(invitation)}
                    type="button"
                  >
                    초대 취소
                  </button>
                </article>
              ))
            )}
          </div>
        </aside>
      </div>

      {statusChange && (
        <div className="dialog-backdrop">
          <section
            aria-describedby="member-status-description"
            aria-labelledby="member-status-title"
            aria-modal="true"
            className="status-dialog"
            role="dialog"
          >
            <h2 id="member-status-title">
              {statusChange.member.displayName} 구성원을{' '}
              {targetActionLabel(statusChange.targetStatus)}할까요?
            </h2>
            <p id="member-status-description">
              {statusChange.targetStatus === 'removed'
                ? '공유 데이터는 유지되지만 이 가족 공간에 다시 접근할 수 없습니다.'
                : statusChange.targetStatus === 'suspended'
                  ? '기존 로그인 세션에서도 다음 요청부터 가족 데이터 접근이 차단됩니다.'
                  : '가족 공유 기능에 다시 접근할 수 있습니다.'}
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-action"
                disabled={pendingAction !== null}
                onClick={() => setStatusChange(null)}
                type="button"
              >
                돌아가기
              </button>
              <button
                className={
                  statusChange.targetStatus === 'removed' ? 'danger-action' : 'primary-action'
                }
                disabled={pendingAction !== null}
                onClick={() => void confirmStatusChange()}
                type="button"
              >
                {pendingAction ? '처리 중…' : targetActionLabel(statusChange.targetStatus)}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
