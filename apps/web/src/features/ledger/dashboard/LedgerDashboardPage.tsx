import {
  formatMoney,
  moneyChangePercent,
  moneyRatioPercent,
  type LedgerBook,
  type LedgerDashboardData,
  type LedgerDashboardNamedAmount,
  type LedgerDashboardRangePreset,
} from '@home/shared';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import './ledger-dashboard.css';

type Props = {
  books: LedgerBook[];
  bookId: string;
  data: LedgerDashboardData | null;
  error: string;
  from: string;
  loading: boolean;
  preset: LedgerDashboardRangePreset;
  to: string;
  onBookChange(value: string): void;
  onPresetChange(value: LedgerDashboardRangePreset): void;
  onFromChange(value: string): void;
  onToChange(value: string): void;
};
const PRESETS: Array<[Exclude<LedgerDashboardRangePreset, 'custom'>, string]> = [
  ['1m', '1개월'],
  ['3m', '3개월'],
  ['6m', '6개월'],
  ['12m', '1년'],
];

function Change({
  current,
  previous,
  reverse = false,
}: {
  current: string;
  previous: string;
  reverse?: boolean;
}) {
  const value = moneyChangePercent(current, previous);
  if (value === null) return <small>이전 기간 신규</small>;
  const good = reverse ? value <= 0 : value >= 0;
  return (
    <small className={good ? 'dashboard-good' : 'dashboard-bad'}>
      {value > 0 ? '▲ ' : value < 0 ? '▼ ' : ''}
      {Math.abs(value).toLocaleString('ko-KR')}% 이전 기간 대비
    </small>
  );
}
function Bars({
  rows,
  total,
  previous = false,
}: {
  rows: Array<LedgerDashboardNamedAmount & { previousAmount?: string }>;
  total: string;
  previous?: boolean;
}) {
  if (!rows.length) return <p className="dashboard-empty">표시할 지출이 없습니다.</p>;
  return (
    <div className="dashboard-bars">
      {rows.map((row) => (
        <article key={row.id}>
          <div>
            <b>{row.name}</b>
            <span>
              {row.count.toLocaleString()}건 · {moneyRatioPercent(row.amount, total).toFixed(1)}%
            </span>
          </div>
          <div className="dashboard-bar-track">
            <i style={{ width: `${Math.max(2, moneyRatioPercent(row.amount, total))}%` }} />
          </div>
          <strong>{formatMoney(row.amount)}</strong>
          {previous && <Change current={row.amount} previous={row.previousAmount ?? '0'} reverse />}
        </article>
      ))}
    </div>
  );
}
function Metric({
  label,
  value,
  children,
  tone,
}: {
  label: string;
  value: string;
  children?: ReactNode;
  tone?: string;
}) {
  return (
    <article className={`dashboard-metric ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {children}
    </article>
  );
}

export function LedgerDashboardPage(p: Props) {
  const d = p.data;
  const savings =
    d && BigInt(d.summary.incomeTotal) > 0n
      ? moneyRatioPercent(d.summary.netTotal, d.summary.incomeTotal)
      : 0;
  const average =
    d && d.summary.activeDays
      ? (BigInt(d.summary.expenseTotal) / BigInt(d.summary.activeDays)).toString()
      : '0';
  const monthlyMax =
    d?.monthly.reduce(
      (max, row) =>
        BigInt(row.income) > max
          ? BigInt(row.income)
          : BigInt(row.expense) > max
            ? BigInt(row.expense)
            : max,
      0n,
    ) ?? 0n;
  const dailyMax =
    d?.daily.reduce((max, row) => (BigInt(row.expense) > max ? BigInt(row.expense) : max), 0n) ??
    0n;
  return (
    <section className="ledger-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="ledger-eyebrow">LEDGER INSIGHTS</p>
          <h1>가계부 분석</h1>
          <p>우리 가족의 돈 흐름을 기간별로 비교해 보세요.</p>
        </div>
        <Link className="dashboard-back" to="/app/ledger">
          ← 가계부로
        </Link>
      </header>
      <section className="dashboard-filters" aria-label="분석 조건">
        <label>
          장부
          <select value={p.bookId} onChange={(e) => p.onBookChange(e.target.value)}>
            {p.books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.name} · {book.visibility === 'family' ? '가족' : '개인'}
              </option>
            ))}
          </select>
        </label>
        <div className="dashboard-presets" aria-label="빠른 기간 선택">
          {PRESETS.map(([value, label]) => (
            <button
              className={p.preset === value ? 'active' : ''}
              key={value}
              onClick={() => p.onPresetChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          시작일
          <input
            type="date"
            value={p.from}
            max={p.to}
            onChange={(e) => p.onFromChange(e.target.value)}
          />
        </label>
        <label>
          종료일
          <input
            type="date"
            value={p.to}
            min={p.from}
            onChange={(e) => p.onToChange(e.target.value)}
          />
        </label>
      </section>
      {p.error && (
        <p className="ledger-error" role="alert">
          {p.error}
        </p>
      )}
      {p.loading && <p className="dashboard-status">분석 데이터를 계산하고 있습니다…</p>}
      {!p.loading && !p.books.length && (
        <section className="dashboard-panel dashboard-empty">
          <h2>분석할 장부가 없습니다</h2>
          <p>가계부에서 장부를 먼저 만들어 주세요.</p>
        </section>
      )}
      {!p.loading && d && (
        <>
          <section className="dashboard-metrics" aria-label="핵심 지표">
            <Metric label="총수입" value={formatMoney(d.summary.incomeTotal)} tone="income">
              <Change current={d.summary.incomeTotal} previous={d.previousSummary.incomeTotal} />
            </Metric>
            <Metric label="총지출" value={formatMoney(d.summary.expenseTotal)} tone="expense">
              <Change
                current={d.summary.expenseTotal}
                previous={d.previousSummary.expenseTotal}
                reverse
              />
            </Metric>
            <Metric
              label="순증감"
              value={formatMoney(d.summary.netTotal)}
              tone={BigInt(d.summary.netTotal) >= 0n ? 'income' : 'expense'}
            >
              <Change current={d.summary.netTotal} previous={d.previousSummary.netTotal} />
            </Metric>
            <Metric label="저축률" value={`${savings.toFixed(1)}%`}>
              <small>수입 대비 순증감</small>
            </Metric>
            <Metric label="거래" value={`${d.summary.transactionCount.toLocaleString()}건`}>
              <small>지출 {d.summary.expenseTransactionCount.toLocaleString()}건</small>
            </Metric>
            <Metric label="활동일 평균 지출" value={formatMoney(average)}>
              <small>{d.summary.activeDays.toLocaleString()}일 거래</small>
            </Metric>
          </section>
          <section className="dashboard-panel dashboard-wide">
            <div className="dashboard-title">
              <div>
                <h2>월별 돈 흐름</h2>
                <p>수입과 지출, 남은 금액을 함께 비교합니다.</p>
              </div>
              <div className="dashboard-legend">
                <span className="income">수입</span>
                <span className="expense">지출</span>
              </div>
            </div>
            {!d.monthly.length ? (
              <p className="dashboard-empty">표시할 거래가 없습니다.</p>
            ) : (
              <div className="dashboard-monthly">
                {d.monthly.map((row) => (
                  <article key={row.period}>
                    <div className="dashboard-columns">
                      <i
                        className="income"
                        title={`수입 ${formatMoney(row.income)}`}
                        style={{
                          height: `${monthlyMax ? Number((BigInt(row.income) * 100n) / monthlyMax) : 0}%`,
                        }}
                      />
                      <i
                        className="expense"
                        title={`지출 ${formatMoney(row.expense)}`}
                        style={{
                          height: `${monthlyMax ? Number((BigInt(row.expense) * 100n) / monthlyMax) : 0}%`,
                        }}
                      />
                    </div>
                    <b>{row.period.slice(2).replace('-', '.')}</b>
                    <span className={BigInt(row.net) >= 0n ? 'dashboard-good' : 'dashboard-bad'}>
                      {formatMoney(row.net)}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
          <div className="dashboard-grid">
            <section className="dashboard-panel">
              <div className="dashboard-title">
                <div>
                  <h2>지출 카테고리</h2>
                  <p>이전 동일 기간과 비교합니다.</p>
                </div>
              </div>
              <Bars rows={d.categories} total={d.summary.expenseTotal} previous />
            </section>
            <section className="dashboard-panel">
              <div className="dashboard-title">
                <div>
                  <h2>결제수단별 지출</h2>
                  <p>어디에서 돈이 빠져나갔는지 봅니다.</p>
                </div>
              </div>
              <Bars rows={d.accounts} total={d.summary.expenseTotal} />
            </section>
            <section className="dashboard-panel">
              <div className="dashboard-title">
                <div>
                  <h2>가족 구성원별 지출</h2>
                  <p>결제자 기준이며 책임 평가 용도가 아닙니다.</p>
                </div>
              </div>
              <Bars rows={d.members} total={d.summary.expenseTotal} />
            </section>
            <section className="dashboard-panel">
              <div className="dashboard-title">
                <div>
                  <h2>요일별 소비</h2>
                  <p>지출이 몰리는 요일을 확인합니다.</p>
                </div>
              </div>
              <Bars rows={d.weekdays} total={d.summary.expenseTotal} />
            </section>
          </div>
          <section className="dashboard-panel dashboard-wide">
            <div className="dashboard-title">
              <div>
                <h2>일별 지출 리듬</h2>
                <p>막대에 커서를 올리면 날짜별 금액을 확인할 수 있습니다.</p>
              </div>
            </div>
            {!d.daily.length ? (
              <p className="dashboard-empty">표시할 거래가 없습니다.</p>
            ) : (
              <div className="dashboard-daily">
                {d.daily.map((row) => (
                  <i
                    key={row.date}
                    title={`${row.date} · ${formatMoney(row.expense)}`}
                    style={{
                      height: `${dailyMax ? Math.max(3, Number((BigInt(row.expense) * 100n) / dailyMax)) : 3}%`,
                    }}
                    aria-label={`${row.date} ${formatMoney(row.expense)}`}
                  />
                ))}
              </div>
            )}
          </section>
          <div className="dashboard-grid">
            <section className="dashboard-panel">
              <div className="dashboard-title">
                <div>
                  <h2>상위 거래처</h2>
                  <p>지출 금액이 큰 순서입니다.</p>
                </div>
              </div>
              <div className="dashboard-table" role="table">
                {d.merchants.length ? (
                  d.merchants.map((row, index) => (
                    <article role="row" key={row.id}>
                      <b>{index + 1}</b>
                      <span>
                        {row.name}
                        <small>
                          {row.count}건 · 평균 {formatMoney(row.average)}
                        </small>
                      </span>
                      <strong>{formatMoney(row.amount)}</strong>
                    </article>
                  ))
                ) : (
                  <p className="dashboard-empty">거래처 정보가 없습니다.</p>
                )}
              </div>
            </section>
            <section className="dashboard-panel">
              <div className="dashboard-title">
                <div>
                  <h2>반복 지출 후보</h2>
                  <p>서로 다른 2개월 이상 반복된 거래처입니다.</p>
                </div>
              </div>
              <div className="dashboard-table">
                {d.recurring.length ? (
                  d.recurring.map((row) => (
                    <article key={row.id}>
                      <b>↻</b>
                      <span>
                        {row.name}
                        <small>
                          {row.months}개월 · {row.count}건 · 평균 {formatMoney(row.average)}
                        </small>
                      </span>
                      <strong>{formatMoney(row.amount)}</strong>
                    </article>
                  ))
                ) : (
                  <p className="dashboard-empty">현재 기간에는 반복 후보가 없습니다.</p>
                )}
              </div>
            </section>
          </div>
          <p className="dashboard-footnote">
            이체 거래는 수입·지출 분석에서 제외됩니다. 비교 값은 선택 기간 직전의 동일 일수
            기준입니다.
          </p>
        </>
      )}
    </section>
  );
}
