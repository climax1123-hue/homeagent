import { validateDday, type Dday, type DdayInput, type HouseholdRole } from '@home/shared';
import { useMemo, useState, type FormEvent } from 'react';
import '../life/life.css';
import { getDday, seoulToday } from './dday-date';
type Props = {
  ddays: Dday[];
  loading: boolean;
  currentUserId: string;
  householdId: string;
  role: HouseholdRole;
  onCreate(i: DdayInput): Promise<unknown>;
  onUpdate(id: string, i: DdayInput): Promise<unknown>;
  onDelete(id: string): Promise<unknown>;
  onFeedback(t: 'success' | 'error', m: string): void;
};
export function DdaysPage(p: Props) {
  const [filter, setFilter] = useState<'all' | 'family' | 'private'>('all'),
    [editing, setEditing] = useState<Dday | null | undefined>(undefined),
    today = seoulToday();
  const shown = useMemo(
    () =>
      p.ddays
        .filter((x) => filter === 'all' || x.visibility === filter)
        .sort(
          (a, b) =>
            getDday(a.targetDate, a.repeatYearly, today).days -
            getDday(b.targetDate, b.repeatYearly, today).days,
        ),
    [filter, p.ddays, today],
  );
  const editable = (x: Dday) =>
    x.ownerUserId === p.currentUserId || (x.visibility === 'family' && p.role === 'admin');
  return (
    <section className="life-page">
      <header className="life-toolbar">
        <div>
          <h2>소중한 날</h2>
          <p>생일, 기념일과 가족의 중요한 날을 함께 기억하세요.</p>
        </div>
        <button className="life-button" onClick={() => setEditing(null)}>
          디데이 추가
        </button>
      </header>
      <div className="life-filters" aria-label="디데이 공개 범위 필터">
        {(['all', 'family', 'private'] as const).map((v) => (
          <button
            className={`life-filter${filter === v ? ' life-filter--active' : ''}`}
            key={v}
            onClick={() => setFilter(v)}
          >
            {v === 'all' ? '전체' : v === 'family' ? '가족 공개' : '나만 보기'}
          </button>
        ))}
      </div>
      {p.loading ? (
        <p className="life-loading">디데이를 불러오는 중입니다.</p>
      ) : shown.length === 0 ? (
        <div className="life-empty">표시할 디데이가 없습니다.</div>
      ) : (
        <div className="life-grid">
          {shown.map((x) => {
            const d = getDday(x.targetDate, x.repeatYearly, today);
            return (
              <article className="life-card" key={x.id}>
                <div className="life-card-head">
                  <div>
                    <div className="life-dday-number">{d.label}</div>
                    <h3>{x.title}</h3>
                  </div>
                  <div className="life-badges">
                    <span
                      className={`life-badge${x.visibility === 'family' ? ' life-badge--family' : ''}`}
                    >
                      {x.visibility === 'family' ? '가족 공개' : '나만 보기'}
                    </span>
                    {x.repeatYearly && <span className="life-badge">매년 반복</span>}
                  </div>
                </div>
                <div className="life-dday-date">{d.effectiveDate}</div>
                {x.memo && <p>{x.memo}</p>}
                {editable(x) && (
                  <div className="life-card-actions">
                    <button onClick={() => setEditing(x)}>수정</button>
                    <button
                      className="danger"
                      onClick={() =>
                        window.confirm('이 디데이를 삭제할까요?') && void p.onDelete(x.id)
                      }
                    >
                      삭제
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {editing !== undefined && (
        <DdayForm
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
function DdayForm({
  initial,
  householdId,
  userId,
  onClose,
  onSave,
  onFeedback,
}: {
  initial: Dday | null;
  householdId: string;
  userId: string;
  onClose(): void;
  onSave(i: DdayInput): Promise<void>;
  onFeedback: Props['onFeedback'];
}) {
  const [title, setTitle] = useState(initial?.title ?? ''),
    [targetDate, setTargetDate] = useState(initial?.targetDate ?? seoulToday()),
    [memo, setMemo] = useState(initial?.memo ?? ''),
    [visibility, setVisibility] = useState<Dday['visibility']>(initial?.visibility ?? 'family'),
    [repeatYearly, setRepeatYearly] = useState(initial?.repeatYearly ?? false),
    [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input: DdayInput = {
      householdId,
      ownerUserId: initial?.ownerUserId ?? userId,
      title,
      targetDate,
      memo,
      visibility,
      repeatYearly,
    };
    const error = validateDday(input);
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
        aria-label={initial ? '디데이 수정' : '디데이 추가'}
      >
        <h2>{initial ? '디데이 수정' : '디데이 추가'}</h2>
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
            기준일
            <input
              required
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
          <label className="life-field">
            메모
            <textarea maxLength={500} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>
          <label className="life-field">
            공개 범위
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Dday['visibility'])}
            >
              <option value="family">가족 공개</option>
              <option value="private">나만 보기</option>
            </select>
          </label>
          <label className="life-check">
            <input
              type="checkbox"
              checked={repeatYearly}
              onChange={(e) => setRepeatYearly(e.target.checked)}
            />
            매년 같은 날 반복
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
