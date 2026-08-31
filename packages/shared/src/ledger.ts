export const LEDGER_VISIBILITIES = ['family', 'private'] as const;
export const LEDGER_ACCOUNT_TYPES = ['cash', 'bank', 'debit_card', 'credit_card', 'other'] as const;
export const LEDGER_TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export const LEDGER_CATEGORY_TYPES = ['income', 'expense'] as const;

export type LedgerVisibility = (typeof LEDGER_VISIBILITIES)[number];
export type LedgerAccountType = string;
export type LedgerTransactionType = (typeof LEDGER_TRANSACTION_TYPES)[number];
export type LedgerCategoryType = (typeof LEDGER_CATEGORY_TYPES)[number];
export type LedgerTransactionSource = 'manual' | 'import';
export type MoneyString = string;

export type LedgerBook = {
  id: string;
  householdId: string;
  ownerUserId: string;
  visibility: LedgerVisibility;
  name: string;
  currency: 'KRW';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LedgerAccount = {
  id: string;
  bookId: string;
  householdId: string;
  ownerUserId: string;
  type: LedgerAccountType;
  name: string;
  openingBalance: MoneyString;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LedgerCommonCode = {
  id: string;
  householdId: string;
  groupKey: string;
  groupLabel?: string;
  code: string;
  valueText?: string;
  label: string;
  sortOrder: number;
  isSystem: boolean;
  isAdminEditable?: boolean;
  isActive: boolean;
};

export type LedgerCategory = {
  id: string;
  bookId: string;
  householdId: string;
  type: LedgerCategoryType;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type LedgerClassificationTargetField = 'merchant' | 'memo' | 'both';
export type LedgerClassificationMatchType = 'contains' | 'exact';

export type LedgerClassificationRule = {
  id: string;
  householdId: string;
  bookId: string;
  transactionType: LedgerCategoryType;
  targetField: LedgerClassificationTargetField;
  matchType: LedgerClassificationMatchType;
  keyword: string;
  categoryId: string;
  priority: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type LedgerStatementProfile = {
  id: string;
  householdId: string;
  bookId: string;
  name: string;
  headerSignature: string;
  mapping: Record<string, number>;
  encoding: 'utf-8' | 'euc-kr' | 'xlsx';
  sheetName: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type LedgerClassificationSuggestion = {
  categoryId: string;
  ruleId: string;
  reason: string;
};

export function normalizeClassificationText(value: string): string {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ko-KR');
}

export function classifyLedgerStatement(
  row: { type: LedgerCategoryType; merchant: string; memo: string },
  rules: readonly LedgerClassificationRule[],
): LedgerClassificationSuggestion | null {
  const merchant = normalizeClassificationText(row.merchant);
  const memo = normalizeClassificationText(row.memo);
  const sorted = [
    ...rules.filter((rule) => rule.isActive && rule.transactionType === row.type),
  ].sort(
    (left, right) =>
      left.priority - right.priority ||
      right.keyword.length - left.keyword.length ||
      left.createdAt.localeCompare(right.createdAt),
  );
  for (const rule of sorted) {
    const keyword = normalizeClassificationText(rule.keyword);
    const candidates =
      rule.targetField === 'merchant'
        ? [['거래처', merchant] as const]
        : rule.targetField === 'memo'
          ? [['메모', memo] as const]
          : [['거래처', merchant] as const, ['메모', memo] as const];
    const matched = candidates.find(([, value]) =>
      rule.matchType === 'exact' ? value === keyword : value.includes(keyword),
    );
    if (matched)
      return {
        categoryId: rule.categoryId,
        ruleId: rule.id,
        reason: `${matched[0]}에 '${rule.keyword}' ${rule.matchType === 'exact' ? '정확히 일치' : '포함'}`,
      };
  }
  return null;
}

export type LedgerTransaction = {
  id: string;
  bookId: string;
  householdId: string;
  type: LedgerTransactionType;
  amount: MoneyString;
  occurredAt: string;
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
  merchant: string;
  memo: string;
  payerUserId: string;
  createdBy: string;
  updatedBy: string;
  source: LedgerTransactionSource;
  clientRequestId: string;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  installmentOriginalTotal: MoneyString | null;
  createdAt: string;
  updatedAt: string;
};

export type LedgerInstallmentInput = Omit<LedgerTransactionInput, 'type' | 'clientRequestId'> & {
  total: MoneyString;
  installmentCount: number;
  occurredOn: string;
};

export type LedgerMonthSummary = {
  incomeTotal: MoneyString;
  expenseTotal: MoneyString;
  netTotal: MoneyString;
};

export type LedgerDashboardSummary = LedgerMonthSummary & {
  transactionCount: number;
  expenseTransactionCount: number;
  activeDays: number;
};

export type LedgerDashboardNamedAmount = {
  id: string;
  name: string;
  amount: MoneyString;
  count: number;
};

export type LedgerDashboardData = {
  summary: LedgerDashboardSummary;
  previousSummary: LedgerDashboardSummary;
  monthly: Array<{ period: string; income: MoneyString; expense: MoneyString; net: MoneyString }>;
  categories: Array<LedgerDashboardNamedAmount & { color: string; previousAmount: MoneyString }>;
  accounts: LedgerDashboardNamedAmount[];
  members: LedgerDashboardNamedAmount[];
  weekdays: Array<LedgerDashboardNamedAmount & { weekday: number }>;
  daily: Array<{ date: string; income: MoneyString; expense: MoneyString }>;
  merchants: Array<LedgerDashboardNamedAmount & { average: MoneyString }>;
  recurring: Array<LedgerDashboardNamedAmount & { months: number; average: MoneyString }>;
};

export type LedgerDashboardRangePreset = '1m' | '3m' | '6m' | '12m' | 'custom';

export function ledgerDashboardRange(
  preset: LedgerDashboardRangePreset,
  now = new Date(),
): { from: string; to: string } {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [year, month] = today.split('-').map(Number);
  const months = preset === 'custom' ? 1 : Number.parseInt(preset, 10);
  const start = new Date(Date.UTC(year, month - months, 1));
  return {
    from: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-01`,
    to: today,
  };
}

export function moneyRatioPercent(value: MoneyString, total: MoneyString): number {
  const denominator = BigInt(total);
  if (denominator === 0n) return 0;
  const result = (BigInt(value) * 10_000n) / denominator;
  return Number(result) / 100;
}

export function moneyChangePercent(current: MoneyString, previous: MoneyString): number | null {
  const before = BigInt(previous);
  if (before === 0n) return BigInt(current) === 0n ? 0 : null;
  return Number(((BigInt(current) - before) * 10_000n) / (before < 0n ? -before : before)) / 100;
}

export type LedgerTransactionInput = {
  bookId: string;
  householdId: string;
  type: LedgerTransactionType;
  amount: MoneyString;
  occurredAt: string;
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
  merchant: string;
  memo: string;
  payerUserId: string;
  clientRequestId: string;
};

const MAX_DATABASE_BIGINT = 9_223_372_036_854_775_807n;

export function parseMoneyInput(value: string): bigint {
  const normalized = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(normalized)) {
    throw new Error('금액은 0보다 큰 정수로 입력해 주세요.');
  }
  const amount = BigInt(normalized.replaceAll(',', ''));
  if (amount <= 0n || amount > MAX_DATABASE_BIGINT) {
    throw new Error('금액은 0보다 크고 저장 가능한 범위여야 합니다.');
  }
  return amount;
}

export function normalizeMoney(value: string): MoneyString {
  return parseMoneyInput(value).toString();
}

export function formatMoney(value: MoneyString | bigint): string {
  const amount = typeof value === 'bigint' ? value : BigInt(value);
  return `${new Intl.NumberFormat('ko-KR').format(amount)}원`;
}

export function addMoney(values: readonly MoneyString[]): bigint {
  return values.reduce((sum, value) => sum + BigInt(value), 0n);
}

export function validateLedgerTransaction(input: LedgerTransactionInput): string | null {
  try {
    parseMoneyInput(input.amount);
  } catch (error) {
    return error instanceof Error ? error.message : '금액을 확인해 주세요.';
  }
  if (!input.bookId || !input.householdId || !input.accountId || !input.payerUserId)
    return '장부, 결제수단과 결제자를 선택해 주세요.';
  if (!Number.isFinite(Date.parse(input.occurredAt))) return '거래 날짜와 시간을 확인해 주세요.';
  if (input.merchant.trim().length > 120) return '거래처는 120자 이하로 입력해 주세요.';
  if (input.memo.length > 500) return '메모는 500자 이하로 입력해 주세요.';
  if (input.type === 'transfer') {
    if (!input.transferAccountId) return '이체받을 결제수단을 선택해 주세요.';
    if (input.transferAccountId === input.accountId) return '출발과 도착 결제수단은 달라야 합니다.';
    if (input.categoryId) return '이체에는 카테고리를 지정할 수 없습니다.';
  } else if (input.transferAccountId) {
    return '수입과 지출에는 이체받을 결제수단을 지정할 수 없습니다.';
  }
  return null;
}

export function ledgerMonthRangeUtc(month: string): { start: string; end: string } {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) throw new Error('월 형식은 YYYY-MM이어야 합니다.');
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(`${month}-01T00:00:00+09:00`);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function ledgerDateToUtc(date: string): string {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(date))
    throw new Error('날짜 형식은 YYYY-MM-DD여야 합니다.');
  const value = new Date(`${date}T00:00:00+09:00`);
  if (!Number.isFinite(value.getTime()) || ledgerDateKey(value.toISOString()) !== date)
    throw new Error('거래 날짜를 확인해 주세요.');
  return value.toISOString();
}

export function ledgerDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function splitInstallmentAmounts(total: MoneyString, count: number): MoneyString[] {
  const value = parseMoneyInput(total);
  if (!Number.isInteger(count) || count < 2 || count > 60)
    throw new Error('할부 개월 수는 2개월부터 60개월까지 선택해 주세요.');
  const divisor = BigInt(count);
  const base = value / divisor;
  const remainder = value % divisor;
  return Array.from({ length: count }, (_, index) =>
    (base + (BigInt(index) < remainder ? 1n : 0n)).toString(),
  );
}
