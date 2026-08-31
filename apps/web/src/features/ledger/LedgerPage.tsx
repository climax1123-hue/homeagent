import {
  addMoney,
  formatMoney,
  ledgerDateKey,
  ledgerDateToUtc,
  normalizeMoney,
  splitInstallmentAmounts,
  validateLedgerTransaction,
  type HouseholdRole,
  type LedgerAccount,
  type LedgerBook,
  type LedgerCategory,
  type LedgerClassificationRule,
  type LedgerCommonCode,
  type LedgerInstallmentInput,
  type LedgerMonthSummary,
  type LedgerStatementProfile,
  type LedgerTransaction,
  type LedgerTransactionInput,
  type LedgerVisibility,
} from '@home/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ClassificationRulePanel } from './classification/ClassificationRulePanel';
import { StatementImportPanel } from './import/StatementImportPanel';
import './ledger.css';

type Props = {
  accounts: LedgerAccount[];
  balances: Record<string, string>;
  books: LedgerBook[];
  categories: LedgerCategory[];
  classificationRules: LedgerClassificationRule[];
  statementProfiles: LedgerStatementProfile[];
  canManageConfiguration: boolean;
  currentBook: LedgerBook | null;
  currentUserId: string;
  error: string;
  householdId: string;
  loading: boolean;
  members: Array<{ id: string; name: string }>;
  month: string;
  paymentCodes: LedgerCommonCode[];
  role: HouseholdRole;
  summary: LedgerMonthSummary;
  transactions: LedgerTransaction[];
  onBookChange(id: string): void;
  onMonthChange(month: string): void;
  onCreateBook(v: LedgerVisibility, n: string): Promise<void>;
  onCreateAccount(n: string, t: string): Promise<unknown>;
  onCreateCategory(t: LedgerCategory['type'], n: string): Promise<unknown>;
  onCreateTransaction(i: LedgerTransactionInput): Promise<unknown>;
  onCreateInstallment(i: LedgerInstallmentInput): Promise<unknown>;
  onUpdateTransaction(id: string, i: LedgerTransactionInput): Promise<unknown>;
  onCommitImport(
    accountId: string,
    fileName: string,
    fileFingerprint: string,
    rows: unknown[],
  ): Promise<number>;
  onFindImportDuplicates(accountId: string, rows: unknown[]): Promise<number[]>;
  onCreateClassificationRule(
    input: Pick<
      LedgerClassificationRule,
      'transactionType' | 'targetField' | 'matchType' | 'keyword' | 'categoryId' | 'priority'
    >,
  ): Promise<unknown>;
  onUpdateClassificationRule(id: string, priority: number, isActive: boolean): Promise<unknown>;
  onDeleteClassificationRule(id: string): Promise<unknown>;
  onCreateStatementProfile(
    input: Pick<
      LedgerStatementProfile,
      'name' | 'headerSignature' | 'mapping' | 'encoding' | 'sheetName'
    >,
  ): Promise<unknown>;
  onDeleteStatementProfile(id: string): Promise<unknown>;
  onDeleteTransaction(id: string): Promise<unknown>;
};
const LABELS = { income: '수입', expense: '지출', transfer: '이체' } as const;
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const move = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const monthDates = (month: string) => {
  const first = `${month}-01`,
    offset = new Date(`${first}T12:00:00Z`).getUTCDay();
  return Array.from({ length: 42 }, (_, i) => move(first, i - offset));
};
const weekDates = (date: string) => {
  const offset = new Date(`${date}T12:00:00Z`).getUTCDay();
  return Array.from({ length: 7 }, (_, i) => move(date, i - offset));
};

export function LedgerPage(p: Props) {
  const [mode, setMode] = useState<'month' | 'week'>('month'),
    [selected, setSelected] = useState(today),
    [showForm, setShowForm] = useState(false),
    [showSettings, setShowSettings] = useState(false),
    [showBookForm, setShowBookForm] = useState(false),
    [showImport, setShowImport] = useState(false),
    [showClassification, setShowClassification] = useState(false);
  const [typeFilter, setTypeFilter] = useState(''),
    [accountFilter, setAccountFilter] = useState(''),
    [query, setQuery] = useState('');
  const [type, setType] = useState<LedgerTransaction['type']>('expense'),
    [amount, setAmount] = useState(''),
    [occurredOn, setOccurredOn] = useState(today),
    [accountId, setAccountId] = useState(''),
    [transferId, setTransferId] = useState(''),
    [categoryId, setCategoryId] = useState(''),
    [payerId, setPayerId] = useState(p.currentUserId),
    [merchant, setMerchant] = useState(''),
    [memo, setMemo] = useState(''),
    [installments, setInstallments] = useState(1),
    [formError, setFormError] = useState('');
  const [accountName, setAccountName] = useState(''),
    [accountType, setAccountType] = useState('cash'),
    [categoryName, setCategoryName] = useState(''),
    [categoryType, setCategoryType] = useState<LedgerCategory['type']>('expense'),
    [bookVisibility, setBookVisibility] = useState<LedgerVisibility>('private'),
    [bookName, setBookName] = useState('홍석원 개인장부');
  useEffect(() => {
    if (!selected.startsWith(p.month)) setSelected(`${p.month}-01`);
  }, [p.month, selected]);
  useEffect(() => {
    if (!accountId && p.accounts[0]) setAccountId(p.accounts[0].id);
  }, [accountId, p.accounts]);
  const accountNames = useMemo(() => new Map(p.accounts.map((x) => [x.id, x.name])), [p.accounts]),
    categoryNames = useMemo(() => new Map(p.categories.map((x) => [x.id, x.name])), [p.categories]),
    memberNames = useMemo(() => new Map(p.members.map((x) => [x.id, x.name])), [p.members]);
  const visibleTransactions = useMemo(
    () =>
      p.transactions.filter(
        (x) =>
          (!typeFilter || x.type === typeFilter) &&
          (!accountFilter ||
            x.accountId === accountFilter ||
            x.transferAccountId === accountFilter) &&
          (!query.trim() ||
            `${x.merchant} ${x.memo}`.toLowerCase().includes(query.trim().toLowerCase())),
      ),
    [accountFilter, p.transactions, query, typeFilter],
  );
  const daily = useMemo(() => {
    const r = new Map<string, { income: string[]; expense: string[] }>();
    visibleTransactions.forEach((x) => {
      const k = ledgerDateKey(x.occurredAt),
        v = r.get(k) ?? { income: [], expense: [] };
      if (x.type === 'income') v.income.push(x.amount);
      if (x.type === 'expense') v.expense.push(x.amount);
      r.set(k, v);
    });
    return r;
  }, [visibleTransactions]);
  const dates = mode === 'month' ? monthDates(p.month) : weekDates(selected),
    details = visibleTransactions.filter((x) => ledgerDateKey(x.occurredAt) === selected);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let value = '';
    try {
      value = normalizeMoney(amount);
      ledgerDateToUtc(occurredOn);
      if (installments > 1) splitInstallmentAmounts(value, installments);
    } catch (r) {
      setFormError(r instanceof Error ? r.message : '입력값을 확인해 주세요.');
      return;
    }
    const base = {
      bookId: p.currentBook?.id ?? '',
      householdId: p.householdId,
      amount: value,
      occurredAt: ledgerDateToUtc(occurredOn),
      accountId,
      transferAccountId: type === 'transfer' ? transferId : null,
      categoryId: type === 'transfer' ? null : categoryId || null,
      merchant,
      memo,
      payerUserId: payerId,
    };
    const input: LedgerTransactionInput = { ...base, type, clientRequestId: crypto.randomUUID() },
      problem = validateLedgerTransaction(input);
    if (problem) {
      setFormError(problem);
      return;
    }
    try {
      if (type === 'expense' && installments > 1)
        await p.onCreateInstallment({
          ...base,
          total: value,
          installmentCount: installments,
          occurredOn,
        });
      else await p.onCreateTransaction(input);
      setAmount('');
      setMerchant('');
      setMemo('');
      setInstallments(1);
      setShowForm(false);
      setSelected(occurredOn);
    } catch {
      /* container message */
    }
  };
  if (!p.currentBook)
    return (
      <section className="ledger-empty">
        <h1>가계부를 시작해 볼까요?</h1>
        <p>가족 공동 장부 또는 개인 장부를 만들 수 있습니다.</p>
        <div>
          <button
            disabled={p.role !== 'admin'}
            onClick={() => p.onCreateBook('family', '우리집 가계부')}
          >
            가족 장부 만들기
          </button>
          <button onClick={() => p.onCreateBook('private', '나의 가계부')}>개인 장부 만들기</button>
        </div>
        {p.role !== 'admin' && <small>가족 장부는 관리자만 처음 만들 수 있어요.</small>}
      </section>
    );
  return (
    <section className="ledger-page">
      <Link className="ledger-action-link" to="/app/ledger/dashboard">
        📊 분석 대시보드 보기
      </Link>
      <header className="ledger-header">
        <div>
          <p className="ledger-eyebrow">우리집 가계부</p>
          <h1>{p.currentBook.name}</h1>
        </div>
        <div className="ledger-actions">
          <select
            aria-label="장부 선택"
            value={p.currentBook.id}
            onChange={(e) => p.onBookChange(e.target.value)}
          >
            {p.books.map((x) => (
              <option key={x.id} value={x.id}>
                {x.visibility === 'private' ? '🔒 ' : '👪 '}
                {x.name}
              </option>
            ))}
          </select>
          <input
            aria-label="조회 월"
            type="month"
            value={p.month}
            onChange={(e) => p.onMonthChange(e.target.value)}
          />
          <button onClick={() => setShowBookForm(true)}>장부 추가</button>
          <button onClick={() => setShowSettings(true)}>결제수단 관리</button>
          {p.canManageConfiguration && (
            <button onClick={() => setShowClassification(true)}>분류 규칙 관리</button>
          )}
          <button onClick={() => setShowImport(true)}>명세 가져오기</button>
          <button
            className="primary"
            onClick={() => {
              setOccurredOn(selected);
              setShowForm(true);
            }}
          >
            + 거래 추가
          </button>
        </div>
      </header>
      {p.error && (
        <p className="ledger-error" role="alert">
          {p.error}
        </p>
      )}
      <div className="ledger-summary">
        <article>
          <span>이번 달 수입</span>
          <strong className="income">+{formatMoney(p.summary.incomeTotal)}</strong>
        </article>
        <article>
          <span>이번 달 지출</span>
          <strong className="expense">-{formatMoney(p.summary.expenseTotal)}</strong>
        </article>
        <article>
          <span>이번 달 잔액</span>
          <strong>{formatMoney(p.summary.netTotal)}</strong>
        </article>
      </div>
      <section className="ledger-filter-panel" aria-labelledby="ledger-filter-title">
        <div className="ledger-filter-head">
          <div>
            <h2 id="ledger-filter-title">거래 내역 필터</h2>
            <p>조건을 선택하면 달력과 상세 거래에 함께 적용됩니다.</p>
          </div>
          <div>
            <span>
              {[typeFilter, accountFilter, query.trim()].filter(Boolean).length
                ? `${[typeFilter, accountFilter, query.trim()].filter(Boolean).length}개 조건 적용 중`
                : '전체 거래 표시 중'}
            </span>
            <button
              type="button"
              disabled={!typeFilter && !accountFilter && !query}
              onClick={() => {
                setTypeFilter('');
                setAccountFilter('');
                setQuery('');
              }}
            >
              초기화
            </button>
          </div>
        </div>
        <div className="ledger-filters">
          <label>
            <span>거래 유형</span>
            <select
              aria-label="거래 유형 필터"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">전체 유형</option>
              {Object.entries(LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>결제수단</span>
            <select
              aria-label="결제수단 필터"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
            >
              <option value="">전체 결제수단</option>
              {p.accounts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>검색어</span>
            <input
              aria-label="거래 검색"
              placeholder="거래처 또는 메모 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      </section>
      <section className="ledger-setup">
        <div>
          <h2>결제수단별 잔액</h2>
          <p>시작 잔액과 전체 거래를 반영합니다.</p>
        </div>
        <div className="ledger-balance-list">
          {p.accounts.map((x) => (
            <span key={x.id}>
              <b>{x.name}</b> {formatMoney(p.balances[x.id] ?? x.openingBalance)}
            </span>
          ))}
        </div>
      </section>
      <section className="ledger-calendar">
        <div className="ledger-calendar-head">
          <h2>날짜별 현황</h2>
          <div className="ledger-segment compact">
            <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>
              전체
            </button>
            <button className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')}>
              주간
            </button>
          </div>
        </div>
        <div className="ledger-weekdays">
          {'일월화수목금토'.split('').map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <div className={`ledger-calendar-grid ${mode}`}>
          {dates.map((date) => {
            const t = daily.get(date);
            return (
              <button
                key={date}
                className={`${date === selected ? 'selected ' : ''}${!date.startsWith(p.month) ? 'outside' : ''}`}
                onClick={() => setSelected(date)}
              >
                <b>{Number(date.slice(-2))}</b>
                <span className="income">
                  {t?.income.length ? `+${formatMoney(addMoney(t.income))}` : ''}
                </span>
                <span className="expense">
                  {t?.expense.length ? `-${formatMoney(addMoney(t.expense))}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <div className="ledger-list">
        <div className="ledger-list-title">
          <h2>{selected.replaceAll('-', '.')} 상세 거래</h2>
          <span>{details.length}건</span>
        </div>
        {p.loading ? (
          <p className="ledger-state">불러오는 중…</p>
        ) : !details.length ? (
          <p className="ledger-state">선택한 날짜에 거래가 없습니다.</p>
        ) : (
          details.map((x) => (
            <article className="ledger-row" key={x.id}>
              <div className={`ledger-kind ${x.type}`}>
                {x.type === 'income' ? '＋' : x.type === 'expense' ? '－' : '↔'}
              </div>
              <div className="ledger-row-main">
                <strong>
                  {x.merchant || categoryNames.get(x.categoryId ?? '') || LABELS[x.type]}
                  {x.installmentCount ? ` · ${x.installmentNumber}/${x.installmentCount}회` : ''}
                </strong>
                <span>
                  {accountNames.get(x.accountId)} · {memberNames.get(x.payerUserId) ?? '가족'}
                </span>
              </div>
              <strong className={x.type}>
                {x.type === 'income' ? '+' : x.type === 'expense' ? '-' : ''}
                {formatMoney(x.amount)}
              </strong>
              <button
                className="icon-button"
                aria-label="거래 삭제"
                onClick={() => p.onDeleteTransaction(x.id)}
              >
                ×
              </button>
            </article>
          ))
        )}
      </div>
      {showForm && (
        <div
          className="ledger-modal"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setShowForm(false);
          }}
        >
          <form className="ledger-form" onSubmit={submit}>
            <div className="ledger-form-head">
              <h2>거래 추가</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="닫기"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>
            <div className="ledger-segment">
              {(['expense', 'income', 'transfer'] as const).map((v) => (
                <button
                  type="button"
                  className={type === v ? 'active' : ''}
                  key={v}
                  onClick={() => {
                    setType(v);
                    setCategoryId('');
                    setInstallments(1);
                  }}
                >
                  {LABELS[v]}
                </button>
              ))}
            </div>
            <label>
              금액
              <input
                autoFocus
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              거래 일자
              <input
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
              />
            </label>
            <label>
              결제수단
              <select required value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">선택</option>
                {p.accounts.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            {type === 'transfer' ? (
              <label>
                도착 결제수단
                <select required value={transferId} onChange={(e) => setTransferId(e.target.value)}>
                  <option value="">선택</option>
                  {p.accounts
                    .filter((x) => x.id !== accountId)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <label>
                카테고리
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">미분류</option>
                  {p.categories
                    .filter((x) => x.type === type)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {type === 'expense' && (
              <label>
                할부
                <select
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                >
                  <option value={1}>일시불</option>
                  {Array.from({ length: 59 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      {n}개월
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              결제자
              <select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
                {p.members.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              거래처
              <input
                maxLength={120}
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </label>
            <label>
              메모
              <textarea maxLength={500} value={memo} onChange={(e) => setMemo(e.target.value)} />
            </label>
            {formError && (
              <p className="ledger-error" role="alert">
                {formError}
              </p>
            )}
            <button className="primary submit" disabled={!p.accounts.length}>
              저장
            </button>
          </form>
        </div>
      )}
      {showSettings && (
        <div
          className="ledger-modal"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setShowSettings(false);
          }}
        >
          <section className="ledger-form ledger-settings">
            <div className="ledger-form-head">
              <h2>가계부 항목 관리</h2>
              <button
                className="icon-button"
                aria-label="닫기"
                onClick={() => setShowSettings(false)}
              >
                ×
              </button>
            </div>
            <h3>결제수단</h3>
            <p className="ledger-help">
              실제로 거래에 사용할 계좌나 카드를 등록합니다. 유형 코드는 관리자 메뉴의 공통코드
              관리에서 설정합니다.
            </p>
            <form
              className="ledger-inline-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (accountName.trim()) {
                  await p.onCreateAccount(accountName, accountType);
                  setAccountName('');
                }
              }}
            >
              <input
                aria-label="결제수단 이름"
                placeholder="예: 생활비 카드"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
              <select
                aria-label="결제수단 유형"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
              >
                {p.paymentCodes
                  .filter((x) => x.isActive)
                  .map((x) => (
                    <option key={x.id} value={x.code}>
                      {x.label}
                    </option>
                  ))}
              </select>
              <button className="primary">추가</button>
            </form>
            <ul className="ledger-settings-list">
              {p.accounts.map((x) => (
                <li key={x.id}>
                  <b>{x.name}</b>
                  <span>{p.paymentCodes.find((c) => c.code === x.type)?.label ?? x.type}</span>
                </li>
              ))}
            </ul>
            <h3>카테고리</h3>
            <form
              className="ledger-inline-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (categoryName.trim()) {
                  await p.onCreateCategory(categoryType, categoryName);
                  setCategoryName('');
                }
              }}
            >
              <input
                aria-label="카테고리 이름"
                placeholder="예: 반려동물"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
              <select
                aria-label="카테고리 유형"
                value={categoryType}
                onChange={(e) => setCategoryType(e.target.value as LedgerCategory['type'])}
              >
                <option value="expense">지출</option>
                <option value="income">수입</option>
              </select>
              <button className="primary">추가</button>
            </form>
            <ul className="ledger-settings-list">
              {p.categories.map((x) => (
                <li key={x.id}>
                  <b>{x.name}</b>
                  <span>{x.type === 'expense' ? '지출' : '수입'}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      {showBookForm && (
        <div
          className="ledger-modal"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setShowBookForm(false);
          }}
        >
          <form
            className="ledger-form"
            onSubmit={async (e) => {
              e.preventDefault();
              await p.onCreateBook(bookVisibility, bookName);
              setShowBookForm(false);
            }}
          >
            <div className="ledger-form-head">
              <h2>장부 추가</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="닫기"
                onClick={() => setShowBookForm(false)}
              >
                ×
              </button>
            </div>
            <label>
              공개 범위
              <select
                value={bookVisibility}
                onChange={(e) => setBookVisibility(e.target.value as LedgerVisibility)}
              >
                <option value="private">나만 보는 개인 장부</option>
                {p.role === 'admin' && !p.books.some((x) => x.visibility === 'family') && (
                  <option value="family">가족 전체 공유 장부</option>
                )}
              </select>
            </label>
            <label>
              장부 이름
              <input
                required
                maxLength={60}
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
              />
            </label>
            <p className="ledger-help">
              개인 장부는 본인만 볼 수 있으며 가족 관리자에게도 공개되지 않습니다.
            </p>
            <button className="primary submit">만들기</button>
          </form>
        </div>
      )}
      {showClassification && (
        <ClassificationRulePanel
          rules={p.classificationRules}
          categories={p.categories}
          onClose={() => setShowClassification(false)}
          onCreate={p.onCreateClassificationRule}
          onUpdate={p.onUpdateClassificationRule}
          onDelete={p.onDeleteClassificationRule}
        />
      )}
      {showImport && (
        <StatementImportPanel
          accounts={p.accounts}
          categories={p.categories}
          rules={p.classificationRules}
          profiles={p.statementProfiles}
          canManageProfiles={p.canManageConfiguration}
          onClose={() => setShowImport(false)}
          onCommit={p.onCommitImport}
          onFindDuplicates={p.onFindImportDuplicates}
          onCreateProfile={p.onCreateStatementProfile}
          onDeleteProfile={p.onDeleteStatementProfile}
        />
      )}
    </section>
  );
}
