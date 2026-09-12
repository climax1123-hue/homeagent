import { validateGoal, type Goal, type GoalInput, type HouseholdRole } from '@home/shared';
import { useState, type FormEvent } from 'react';
import '../life/life.css';

type Props = {
  goals: Goal[];
  loading: boolean;
  currentUserId: string;
  householdId: string;
  role: HouseholdRole;
  onCreate(i: GoalInput): Promise<unknown>;
  onUpdate(id: string, i: GoalInput): Promise<unknown>;
  onDelete(id: string): Promise<unknown>;
  onFeedback(t: 'success' | 'error', m: string): void;
};
const statusLabel = { active: '진행 중', paused: '잠시 멈춤', completed: '완료' } as const;
export function GoalsPage(p: Props) {
  const [filter, setFilter] = useState<'all' | Goal['status']>('all'),
    [editing, setEditing] = useState<Goal | null | undefined>(undefined);
  const shown = p.goals.filter((x) => filter === 'all' || x.status === filter);
  const editable = (x: Goal) =>
    x.ownerUserId === p.currentUserId || (x.visibility === 'family' && p.role === 'admin');
  return (
    <section className="life-page">
      <header className="life-toolbar">
        <div>
          <h2>우리의 목표</h2>
          <p>가족 목표와 개인 목표의 진행 상황을 한눈에 확인하세요.</p>
        </div>
        <button className="life-button" onClick={() => setEditing(null)}>
          목표 추가
        </button>
      </header>
      <div className="life-filters" aria-label="목표 상태 필터">
        {(['all', 'active', 'paused', 'completed'] as const).map((v) => (
          <button
            className={`life-filter${filter === v ? ' life-filter--active' : ''}`}
            key={v}
            onClick={() => setFilter(v)}
          >
            {v === 'all' ? '전체' : statusLabel[v]}
          </button>
        ))}
      </div>
      {p.loading ? (
        <p className="life-loading">목표를 불러오는 중입니다.</p>
      ) : shown.length === 0 ? (
        <div className="life-empty">표시할 목표가 없습니다.</div>
      ) : (
        <div className="life-grid">
          {shown.map((x) => (
            <article className="life-card" key={x.id}>
              <div className="life-card-head">
                <h3>{x.title}</h3>
                <div className="life-badges">
                  <span
                    className={`life-badge${x.visibility === 'family' ? ' life-badge--family' : ''}`}
                  >
                    {x.visibility === 'family' ? '가족 공개' : '나만 보기'}
                  </span>
                  <span className="life-badge">{statusLabel[x.status]}</span>
                </div>
              </div>
              {x.description && <p>{x.description}</p>}
              <div className="life-progress-label">
                <span>진행률</span>
                <strong>{x.progress}%</strong>
              </div>
              <div className="life-progress">
                <span style={{ width: `${x.progress}%` }} />
              </div>
              {x.targetDate && <p>목표일 {x.targetDate}</p>}
              {editable(x) && (
                <div className="life-card-actions">
                  <button onClick={() => setEditing(x)}>수정</button>
                  <button
                    className="danger"
                    onClick={() => window.confirm('이 목표를 삭제할까요?') && void p.onDelete(x.id)}
                  >
                    삭제
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <GoalForm
          initial={editing}
          householdId={p.householdId}
          userId={p.currentUserId}
          onClose={() => setEditing(undefined)}
          onFeedback={p.onFeedback}
          onSave={async (input) => {
            if (editing) await p.onUpdate(editing.id, input);
            else await p.onCreate(input);
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}
function GoalForm({
  initial,
  householdId,
  userId,
  onClose,
  onSave,
  onFeedback,
}: {
  initial: Goal | null;
  householdId: string;
  userId: string;
  onClose(): void;
  onSave(i: GoalInput): Promise<void>;
  onFeedback: Props['onFeedback'];
}) {
  const [title, setTitle] = useState(initial?.title ?? ''),
    [description, setDescription] = useState(initial?.description ?? ''),
    [targetDate, setTargetDate] = useState(initial?.targetDate ?? ''),
    [visibility, setVisibility] = useState<Goal['visibility']>(initial?.visibility ?? 'family'),
    [status, setStatus] = useState<Goal['status']>(initial?.status ?? 'active'),
    [progress, setProgress] = useState(initial?.progress ?? 0),
    [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input: GoalInput = {
      householdId,
      ownerUserId: initial?.ownerUserId ?? userId,
      title,
      description,
      targetDate: targetDate || null,
      visibility,
      status,
      progress: status === 'completed' ? 100 : progress,
    };
    const error = validateGoal(input);
    if (error) {
      onFeedback('error', error);
      return;
    }
    setSaving(true);
    try {
      await onSave(input);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="life-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section
        className="life-modal"
        role="dialog"
        aria-modal="true"
        aria-label={initial ? '목표 수정' : '목표 추가'}
      >
        <h2>{initial ? '목표 수정' : '목표 추가'}</h2>
        <form className="life-form" onSubmit={(e) => void submit(e)}>
          <label className="life-field">
            제목
            <input
              autoFocus
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="life-field">
            설명
            <textarea
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="life-field">
            목표일 (선택)
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </label>
          <label className="life-field">
            공개 범위
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Goal['visibility'])}
            >
              <option value="family">가족 공개</option>
              <option value="private">나만 보기</option>
            </select>
          </label>
          <label className="life-field">
            상태
            <select value={status} onChange={(e) => setStatus(e.target.value as Goal['status'])}>
              <option value="active">진행 중</option>
              <option value="paused">잠시 멈춤</option>
              <option value="completed">완료</option>
            </select>
          </label>
          <label className="life-field">
            진행률 {status === 'completed' ? 100 : progress}%
            <input
              disabled={status === 'completed'}
              type="range"
              min="0"
              max="100"
              step="5"
              value={status === 'completed' ? 100 : progress}
              onChange={(e) => setProgress(Number(e.target.value))}
            />
          </label>
          <div className="life-form-actions">
            <button type="button" className="life-button life-button--secondary" onClick={onClose}>
              취소
            </button>
            <button className="life-button" disabled={saving}>
              {saving ? '저장 중' : '저장'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
