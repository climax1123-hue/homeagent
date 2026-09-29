import { validateGoal, type Goal, type GoalInput, type HouseholdRole } from '@home/shared';
import { useMemo, useState, type FormEvent } from 'react';
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
const priorityLabel = { high: '높음', medium: '보통', low: '낮음' } as const;
const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const deadlineLabel = (targetDate: string | null, status: Goal['status']) => {
  if (!targetDate || status === 'completed') return null;
  const days = Math.round(
    (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86_400_000,
  );
  return days < 0 ? `${Math.abs(days)}일 지연` : days === 0 ? '오늘 마감' : `${days}일 남음`;
};
export function GoalsPage(p: Props) {
  const [filter, setFilter] = useState<'all' | Goal['status']>('all'),
    [editing, setEditing] = useState<Goal | null | undefined>(undefined);
  const shown = useMemo(
    () =>
      p.goals
        .filter((x) => filter === 'all' || x.status === filter)
        .sort(
          (a, b) =>
            Number(a.status === 'completed') - Number(b.status === 'completed') ||
            priorityOrder[a.priority] - priorityOrder[b.priority] ||
            (a.targetDate ?? '9999-12-31').localeCompare(b.targetDate ?? '9999-12-31'),
        ),
    [filter, p.goals],
  );
  const activeCount = p.goals.filter((goal) => goal.status === 'active').length;
  const completedCount = p.goals.filter((goal) => goal.status === 'completed').length;
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
      <div className="life-summary" aria-label="목표 요약">
        <article>
          <span>진행 중</span>
          <strong>{activeCount}개</strong>
        </article>
        <article>
          <span>완료</span>
          <strong>{completedCount}개</strong>
        </article>
        <article>
          <span>전체 평균</span>
          <strong>
            {p.goals.length
              ? Math.round(p.goals.reduce((sum, goal) => sum + goal.progress, 0) / p.goals.length)
              : 0}
            %
          </strong>
        </article>
      </div>
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
                  <span className={`life-badge life-badge--priority-${x.priority}`}>
                    우선순위 {priorityLabel[x.priority]}
                  </span>
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
              {x.targetDate && (
                <p
                  className={
                    deadlineLabel(x.targetDate, x.status)?.includes('지연')
                      ? 'life-deadline--late'
                      : ''
                  }
                >
                  목표일 {x.targetDate}{' '}
                  {deadlineLabel(x.targetDate, x.status) &&
                    `· ${deadlineLabel(x.targetDate, x.status)}`}
                </p>
              )}
              {editable(x) && (
                <div className="life-quick-actions">
                  {x.status !== 'completed' && (
                    <>
                      <button
                        onClick={() =>
                          void p
                            .onUpdate(x.id, {
                              ...x,
                              progress: Math.min(100, x.progress + 10),
                              status: x.progress >= 90 ? 'completed' : x.status,
                            })
                            .catch(() => undefined)
                        }
                      >
                        +10%
                      </button>
                      <button
                        onClick={() =>
                          void p
                            .onUpdate(x.id, { ...x, progress: 100, status: 'completed' })
                            .catch(() => undefined)
                        }
                      >
                        완료
                      </button>
                    </>
                  )}
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
    [priority, setPriority] = useState<Goal['priority']>(initial?.priority ?? 'medium'),
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
      priority,
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
            우선순위
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Goal['priority'])}
            >
              <option value="high">높음</option>
              <option value="medium">보통</option>
              <option value="low">낮음</option>
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
