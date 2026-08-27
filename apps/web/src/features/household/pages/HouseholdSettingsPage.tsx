import type { Household, HouseholdMember } from '@home/shared';
import { type FormEvent, useState } from 'react';
import '../household.css';

type Props = {
  household: Household;
  member: HouseholdMember;
  onUpdateDisplayName: (displayName: string) => Promise<void>;
};

export function HouseholdSettingsPage({ household, member, onUpdateDisplayName }: Props) {
  const [displayName, setDisplayName] = useState(member.displayName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = displayName.trim();
    if (!normalized) return setError('표시 이름을 입력해 주세요.');
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await onUpdateDisplayName(normalized);
      setDisplayName(normalized);
      setMessage('표시 이름을 변경했습니다.');
    } catch {
      setError('표시 이름을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="household-page">
      <header className="household-header">
        <div>
          <p className="household-eyebrow">가족 설정</p>
          <h2>{household.name}</h2>
          <p>가족에게 표시되는 내 이름을 관리합니다.</p>
        </div>
      </header>
      <section className="household-panel">
        {(message || error) && (
          <div
            className={error ? 'household-alert household-alert--error' : 'household-alert'}
            role={error ? 'alert' : 'status'}
          >
            {error ?? message}
          </div>
        )}
        <form className="invitation-form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="household-display-name">표시 이름</label>
          <input
            id="household-display-name"
            maxLength={50}
            disabled={busy}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
          <button
            className="primary-action"
            disabled={busy || displayName.trim() === member.displayName}
            type="submit"
          >
            {busy ? '저장 중…' : '변경 저장'}
          </button>
        </form>
      </section>
    </section>
  );
}
