import { describe, expect, it } from 'vitest';
import {
  addMoney,
  formatMoney,
  ledgerMonthRangeUtc,
  normalizeMoney,
  parseMoneyInput,
  type LedgerTransactionInput,
  validateLedgerTransaction,
  ledgerDateKey,
  ledgerDateToUtc,
  splitInstallmentAmounts,
  classifyLedgerStatement,
  type LedgerClassificationRule,
  ledgerDashboardRange,
  moneyChangePercent,
  moneyRatioPercent,
} from './ledger';

const base: LedgerTransactionInput = {
  bookId: 'book',
  householdId: 'household',
  type: 'expense',
  amount: '12000',
  occurredAt: '2026-08-27T00:00:00.000Z',
  accountId: 'cash',
  transferAccountId: null,
  categoryId: 'food',
  merchant: '마트',
  memo: '',
  payerUserId: 'user',
  clientRequestId: 'request',
};

describe('ledger money', () => {
  it('parses integer and grouped money without floating point math', () => {
    expect(parseMoneyInput('1,234,567')).toBe(1_234_567n);
    expect(normalizeMoney('00100')).toBe('100');
    expect(addMoney(['9007199254740993', '7'])).toBe(9_007_199_254_741_000n);
    expect(formatMoney('1234567')).toBe('1,234,567원');
  });

  it.each(['0', '-1', '1.5', '1e3', '12,34', '', '9223372036854775808'])(
    'rejects invalid money %s',
    (value) => expect(() => parseMoneyInput(value)).toThrow(),
  );
});

describe('statement classification', () => {
  const rule = (patch: Partial<LedgerClassificationRule> = {}): LedgerClassificationRule => ({
    id: 'rule-1',
    householdId: 'home',
    bookId: 'book',
    transactionType: 'expense',
    targetField: 'merchant',
    matchType: 'contains',
    keyword: '스타벅스',
    categoryId: 'cafe',
    priority: 100,
    isActive: true,
    createdBy: 'user',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...patch,
  });

  it('normalizes case and spaces and explains a merchant match', () => {
    expect(
      classifyLedgerStatement({ type: 'expense', merchant: '  STARBUCKS  강남 ', memo: '' }, [
        rule({ keyword: 'starbucks' }),
      ]),
    ).toMatchObject({ categoryId: 'cafe', ruleId: 'rule-1', reason: "거래처에 'starbucks' 포함" });
  });

  it('respects transaction type and chooses the highest priority match', () => {
    const result = classifyLedgerStatement(
      { type: 'expense', merchant: '스타벅스 강남점', memo: '아침' },
      [
        rule({ id: 'late', keyword: '스타벅스', categoryId: 'other', priority: 200 }),
        rule({ id: 'first', keyword: '강남점', categoryId: 'cafe', priority: 10 }),
        rule({ id: 'income', transactionType: 'income', priority: 0 }),
      ],
    );
    expect(result?.ruleId).toBe('first');
  });

  it('supports exact memo matching and returns null without a rule', () => {
    expect(
      classifyLedgerStatement({ type: 'expense', merchant: '', memo: '정기 구독' }, [
        rule({ targetField: 'memo', matchType: 'exact', keyword: '정기 구독' }),
      ])?.categoryId,
    ).toBe('cafe');
    expect(
      classifyLedgerStatement({ type: 'income', merchant: '스타벅스', memo: '' }, [rule()]),
    ).toBeNull();
  });
});

describe('ledger calendar and installments', () => {
  it('stores a Seoul ledger date at UTC midnight boundary', () => {
    expect(ledgerDateToUtc('2026-08-27')).toBe('2026-08-26T15:00:00.000Z');
    expect(ledgerDateKey('2026-08-26T15:00:00.000Z')).toBe('2026-08-27');
    expect(() => ledgerDateToUtc('2026-02-31')).toThrow('날짜');
  });

  it('splits integer installments without losing the original total', () => {
    expect(splitInstallmentAmounts('1200000', 3)).toEqual(['400000', '400000', '400000']);
    const uneven = splitInstallmentAmounts('100', 3);
    expect(uneven).toEqual(['34', '33', '33']);
    expect(uneven.reduce((sum, value) => sum + BigInt(value), 0n)).toBe(100n);
  });
});

describe('ledger transaction validation', () => {
  it('accepts an expense and validates transfer shape', () => {
    expect(validateLedgerTransaction(base)).toBeNull();
    expect(
      validateLedgerTransaction({
        ...base,
        type: 'transfer',
        categoryId: null,
        transferAccountId: 'bank',
      }),
    ).toBeNull();
  });

  it('rejects a transfer to the same account', () => {
    expect(
      validateLedgerTransaction({
        ...base,
        type: 'transfer',
        categoryId: null,
        transferAccountId: 'cash',
      }),
    ).toContain('달라야');
  });
});

describe('ledger month boundaries', () => {
  it('creates Asia/Seoul boundaries in UTC', () => {
    expect(ledgerMonthRangeUtc('2026-08')).toEqual({
      start: '2026-07-31T15:00:00.000Z',
      end: '2026-08-31T15:00:00.000Z',
    });
  });
});

describe('ledger dashboard helpers', () => {
  it('creates Seoul date presets by complete calendar months', () => {
    expect(ledgerDashboardRange('3m', new Date('2026-08-31T03:00:00Z'))).toEqual({
      from: '2026-06-01',
      to: '2026-08-31',
    });
  });

  it('calculates ratios from bigint values without money precision loss', () => {
    expect(moneyRatioPercent('1', '3')).toBe(33.33);
    expect(moneyRatioPercent('9007199254740993', '18014398509481986')).toBe(50);
    expect(moneyChangePercent('150', '100')).toBe(50);
    expect(moneyChangePercent('1', '0')).toBeNull();
  });
});
