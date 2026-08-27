import { householdErrorMessage } from '@home/shared';
import { FormEvent, useId, useState } from 'react';
import '../household.css';

type AcceptInvitationPageProps = {
  rawToken: string;
  onAccept: (rawToken: string, displayName: string) => Promise<void>;
};

function readableError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return householdErrorMessage(String(error.code));
  }

  return householdErrorMessage(undefined);
}

export function AcceptInvitationPage({ rawToken, onAccept }: AcceptInvitationPageProps) {
  const displayNameId = useId();
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = displayName.trim();

    if (!rawToken || !normalizedName) {
      setError('초대 링크와 표시 이름을 확인해 주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onAccept(rawToken, normalizedName);
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="invite-accept-page">
      <section className="invite-accept-card">
        <p className="household-eyebrow">가족 초대</p>
        <h1>우리집에 함께할 준비가 됐어요</h1>
        <p>
          가족에게 표시할 이름을 입력해 주세요. 로그인한 이메일과 초대받은 이메일이 일치해야 합니다.
        </p>

        {error && (
          <div className="household-alert household-alert--error" role="alert">
            {error}
          </div>
        )}

        <form className="invitation-form" onSubmit={submit}>
          <label htmlFor={displayNameId}>가족에게 표시할 이름</label>
          <input
            autoComplete="name"
            disabled={submitting}
            id={displayNameId}
            maxLength={50}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="예: 아빠, 엄마"
            required
            value={displayName}
          />
          <button className="primary-action" disabled={submitting} type="submit">
            {submitting ? '참여하는 중…' : '가족 공간 참여하기'}
          </button>
        </form>
      </section>
    </main>
  );
}
