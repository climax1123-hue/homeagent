import { formatMoney, type Goal } from '@home/shared';
import { useMemo, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatEventTime, toDateKey } from '../calendar/calendar-dates';
import { getDday } from '../ddays/dday-date';
import { moveDashboardWidget, type DashboardData, type DashboardWidgetId } from './dashboard-types';
import './dashboard.css';

type Props = {
  data: DashboardData;
  loading: boolean;
  order: DashboardWidgetId[];
  userEmail: string;
  onSaveOrder(order: DashboardWidgetId[]): Promise<void>;
};
const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  schedule: '다가오는 일정',
  ledger: '이번 달 가계부',
  ddays: '가까운 디데이',
  goals: '진행 중인 목표',
  quick_actions: '빠른 이동',
};
const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(iso));
const greeting = () => {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  );
  return hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '편안한 저녁이에요';
};

export function DashboardPage({ data, loading, order, userEmail, onSaveOrder }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(order);
  const [dragged, setDragged] = useState<DashboardWidgetId | null>(null);
  const [saving, setSaving] = useState(false);
  const activeOrder = editing ? draft : order;
  const displayName = userEmail.split('@')[0] || '가족';
  const cards = useMemo<Record<DashboardWidgetId, React.ReactNode>>(
    () => ({
      schedule: <ScheduleCard data={data} />,
      ledger: <LedgerCard data={data} />,
      ddays: <DdayCard data={data} />,
      goals: <GoalsCard data={data} />,
      quick_actions: <QuickActions />,
    }),
    [data],
  );
  const beginEdit = () => {
    setDraft([...order]);
    setEditing(true);
  };
  const drop = (target: DashboardWidgetId) => {
    if (!dragged) return;
    setDraft((current) =>
      moveDashboardWidget(current, current.indexOf(dragged), current.indexOf(target)),
    );
    setDragged(null);
  };
  return (
    <section className="home-dashboard" aria-labelledby="home-dashboard-title">
      <header className="home-dashboard-heading">
        <div>
          <p className="app-eyebrow">FAMILY DASHBOARD</p>
          <h2 id="home-dashboard-title">우리집 대시보드</h2>
          <p>{displayName}님, 가족의 오늘을 한눈에 확인하세요.</p>
        </div>
        {editing ? (
          <div className="home-dashboard-edit-actions">
            <button
              className="secondary"
              onClick={() => {
                setDraft([...order]);
                setEditing(false);
              }}
            >
              취소
            </button>
            <button
              disabled={saving}
              onClick={() => {
                setSaving(true);
                void onSaveOrder(draft)
                  .then(() => setEditing(false))
                  .finally(() => setSaving(false));
              }}
            >
              {saving ? '저장 중' : '순서 저장'}
            </button>
          </div>
        ) : (
          <button className="home-dashboard-edit" onClick={beginEdit}>
            ✎ 편집
          </button>
        )}
      </header>
      <section className="home-greeting">
        <span aria-hidden="true">☀</span>
        <div>
          <h3>{greeting()}</h3>
          <p>
            {new Intl.DateTimeFormat('ko-KR', {
              timeZone: 'Asia/Seoul',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            }).format(new Date())}
          </p>
        </div>
      </section>
      {editing && (
        <p className="home-edit-guide">⠿ 카드를 끌거나 화살표 버튼을 눌러 순서를 변경하세요.</p>
      )}
      {data.warnings.length > 0 && (
        <p className="home-dashboard-warning" role="status">
          일부 정보를 불러오지 못했습니다. 각 기능 화면은 정상적으로 사용할 수 있습니다.
        </p>
      )}
      {loading ? (
        <div className="home-dashboard-loading">대시보드를 불러오는 중입니다.</div>
      ) : (
        <div className={`home-widget-grid${editing ? ' is-editing' : ''}`}>
          {activeOrder.map((id, index) => (
            <article
              className={`home-widget home-widget--${id}`}
              draggable={editing}
              key={id}
              onDragStart={() => setDragged(id)}
              onDragEnd={() => setDragged(null)}
              onDragOver={(event: DragEvent) => editing && event.preventDefault()}
              onDrop={() => drop(id)}
            >
              <div className="home-widget-title">
                <h3>{WIDGET_LABELS[id]}</h3>
                {editing ? (
                  <div className="home-widget-controls">
                    <button
                      aria-label={`${WIDGET_LABELS[id]} 위로 이동`}
                      disabled={index === 0}
                      onClick={() =>
                        setDraft((current) => moveDashboardWidget(current, index, index - 1))
                      }
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`${WIDGET_LABELS[id]} 아래로 이동`}
                      disabled={index === activeOrder.length - 1}
                      onClick={() =>
                        setDraft((current) => moveDashboardWidget(current, index, index + 1))
                      }
                    >
                      ↓
                    </button>
                    <span title="드래그하여 이동" aria-hidden="true">
                      ⠿
                    </span>
                  </div>
                ) : (
                  id !== 'quick_actions' && (
                    <Link
                      to={
                        id === 'schedule'
                          ? '/app/calendar'
                          : id === 'ledger'
                            ? '/app/ledger'
                            : id === 'ddays'
                              ? '/app/ddays'
                              : '/app/goals'
                      }
                    >
                      전체보기 →
                    </Link>
                  )
                )}
              </div>
              {cards[id]}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ScheduleCard({ data }: { data: DashboardData }) {
  return data.occurrences.length ? (
    <ul className="home-list">
      {data.occurrences.slice(0, 3).map((item) => (
        <li key={`${item.event.id}-${item.occurrenceStart}`}>
          <time>
            {formatDate(item.occurrenceStart)}
            <small>{formatEventTime(item)}</small>
          </time>
          <span>
            <strong>{item.event.title}</strong>
            {item.event.location && <small>{item.event.location}</small>}
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <Empty text="앞으로 14일간 예정된 일정이 없습니다." />
  );
}
function LedgerCard({ data }: { data: DashboardData }) {
  const s = data.ledgerSummary;
  if (!s)
    return (
      <Empty
        text={data.ledgerBookName ? '이번 달 거래가 없습니다.' : '사용할 가계부가 없습니다.'}
      />
    );
  const max = [BigInt(s.incomeTotal), BigInt(s.expenseTotal), 1n].reduce((a, b) => (a > b ? a : b));
  const width = (v: string) => `${Number((BigInt(v) * 100n) / max)}%`;
  return (
    <div className="home-ledger">
      <p>{data.ledgerBookName}</p>
      <div className="home-ledger-values">
        <span>
          수입<strong className="income">{formatMoney(s.incomeTotal)}</strong>
        </span>
        <span>
          지출<strong className="expense">{formatMoney(s.expenseTotal)}</strong>
        </span>
        <span>
          잔액<strong>{formatMoney(s.netTotal)}</strong>
        </span>
      </div>
      <div className="home-ledger-bars">
        <i className="income" style={{ width: width(s.incomeTotal) }} />
        <i className="expense" style={{ width: width(s.expenseTotal) }} />
      </div>
    </div>
  );
}
function DdayCard({ data }: { data: DashboardData }) {
  const today = toDateKey(new Date());
  const rows = [...data.ddays]
    .sort(
      (a, b) =>
        getDday(a.targetDate, a.repeatYearly, today).days -
        getDday(b.targetDate, b.repeatYearly, today).days,
    )
    .slice(0, 3);
  return rows.length ? (
    <ul className="home-ddays">
      {rows.map((item) => {
        const d = getDday(item.targetDate, item.repeatYearly, today);
        return (
          <li key={item.id}>
            <span>
              <strong>{item.title}</strong>
              <small>
                {d.effectiveDate}
                {item.repeatYearly ? ' · 매년' : ''}
              </small>
            </span>
            <b>{d.label}</b>
          </li>
        );
      })}
    </ul>
  ) : (
    <Empty text="등록된 디데이가 없습니다." />
  );
}
function GoalsCard({ data }: { data: DashboardData }) {
  const rows = data.goals
    .filter((goal) => goal.status === 'active')
    .sort((a, b) => goalSort(a, b))
    .slice(0, 3);
  return rows.length ? (
    <ul className="home-goals">
      {rows.map((goal) => (
        <li key={goal.id}>
          <div>
            <strong>{goal.title}</strong>
            <b>{goal.progress}%</b>
          </div>
          <div className="home-goal-track">
            <i style={{ width: `${goal.progress}%` }} />
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <Empty text="진행 중인 목표가 없습니다." />
  );
}
const goalSort = (a: Goal, b: Goal) =>
  (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999');
function QuickActions() {
  return (
    <div className="home-quick-actions">
      <Link to="/app/calendar">▣ 일정</Link>
      <Link to="/app/ledger">▤ 거래</Link>
      <Link to="/app/goals">◎ 목표</Link>
      <Link to="/app/ddays">♡ 디데이</Link>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="home-widget-empty">{text}</p>;
}
