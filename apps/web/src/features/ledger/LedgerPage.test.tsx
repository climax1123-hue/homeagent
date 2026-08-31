import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { LedgerPage } from './LedgerPage';

const baseProps = {
  accounts: [],
  balances: {},
  books: [],
  categories: [],
  classificationRules: [],
  statementProfiles: [],
  canManageConfiguration: true,
  currentBook: null,
  currentUserId: 'user-1',
  error: '',
  householdId: 'home-1',
  loading: false,
  members: [{ id: 'user-1', name: '나' }],
  month: '2026-08',
  role: 'admin' as const,
  summary: { incomeTotal: '0', expenseTotal: '0', netTotal: '0' },
  transactions: [],
  paymentCodes: [],
  onBookChange: vi.fn(),
  onMonthChange: vi.fn(),
  onCreateBook: vi.fn().mockResolvedValue(undefined),
  onCreateAccount: vi.fn().mockResolvedValue(undefined),
  onCreateTransaction: vi.fn().mockResolvedValue(undefined),
  onCreateCategory: vi.fn().mockResolvedValue(undefined),
  onUpdateTransaction: vi.fn().mockResolvedValue(undefined),
  onCommitImport: vi.fn().mockResolvedValue(0),
  onFindImportDuplicates: vi.fn().mockResolvedValue([]),
  onCreateClassificationRule: vi.fn().mockResolvedValue(undefined),
  onUpdateClassificationRule: vi.fn().mockResolvedValue(undefined),
  onDeleteClassificationRule: vi.fn().mockResolvedValue(undefined),
  onCreateStatementProfile: vi.fn().mockResolvedValue(undefined),
  onDeleteStatementProfile: vi.fn().mockResolvedValue(undefined),
  onDeleteTransaction: vi.fn().mockResolvedValue(undefined),
  onCreateInstallment: vi.fn().mockResolvedValue(undefined),
};
const renderPage = (page: ReactNode) => render(<MemoryRouter>{page}</MemoryRouter>);

describe('LedgerPage', () => {
  it('lets an admin start a family ledger', () => {
    renderPage(<LedgerPage {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: '가족 장부 만들기' }));
    expect(baseProps.onCreateBook).toHaveBeenCalledWith('family', '우리집 가계부');
  });

  it('prevents a member from creating the initial family ledger', () => {
    renderPage(<LedgerPage {...baseProps} role="member" />);
    expect(screen.getByRole('button', { name: '가족 장부 만들기' })).toBeDisabled();
    expect(screen.getByText('가족 장부는 관리자만 처음 만들 수 있어요.')).toBeInTheDocument();
  });

  it('shows daily totals and selected-date installment details', () => {
    const book = {
      id: 'book-1',
      householdId: 'home-1',
      ownerUserId: 'user-1',
      visibility: 'family' as const,
      name: '우리집 가계부',
      currency: 'KRW' as const,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    };
    const transaction = {
      id: 'tx-1',
      bookId: 'book-1',
      householdId: 'home-1',
      type: 'expense' as const,
      amount: '400000',
      occurredAt: '2026-08-26T15:00:00.000Z',
      accountId: 'account-1',
      transferAccountId: null,
      categoryId: null,
      merchant: '노트북',
      memo: '',
      payerUserId: 'user-1',
      createdBy: 'user-1',
      updatedBy: 'user-1',
      source: 'manual' as const,
      clientRequestId: 'request-1',
      installmentGroupId: 'group-1',
      installmentNumber: 1,
      installmentCount: 3,
      installmentOriginalTotal: '1200000',
      createdAt: '',
      updatedAt: '',
    };
    renderPage(
      <LedgerPage {...baseProps} books={[book]} currentBook={book} transactions={[transaction]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /27.*400,000원/ }));
    expect(screen.getAllByText('-400,000원')).toHaveLength(2);
    expect(screen.getByText(/노트북 · 1\/3회/)).toBeInTheDocument();
  });

  it('clearly labels active ledger filters and resets them', () => {
    const book = {
      id: 'book-1',
      householdId: 'home-1',
      ownerUserId: 'user-1',
      visibility: 'family' as const,
      name: '우리집 가계부',
      currency: 'KRW' as const,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    };
    renderPage(<LedgerPage {...baseProps} books={[book]} currentBook={book} />);
    expect(screen.getByRole('heading', { name: '거래 내역 필터' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('거래 유형 필터'), { target: { value: 'income' } });
    expect(screen.getByText('1개 조건 적용 중')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    expect(screen.getByText('전체 거래 표시 중')).toBeInTheDocument();
  });

  it('shows classification management only to a ledger configuration manager', () => {
    const book = {
      id: 'book-1',
      householdId: 'home-1',
      ownerUserId: 'user-1',
      visibility: 'family' as const,
      name: '우리집 가계부',
      currency: 'KRW' as const,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    };
    const { rerender } = renderPage(
      <LedgerPage {...baseProps} books={[book]} currentBook={book} canManageConfiguration />,
    );
    fireEvent.click(screen.getByRole('button', { name: '분류 규칙 관리' }));
    expect(screen.getByRole('heading', { name: '분류 규칙 관리' })).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <LedgerPage
          {...baseProps}
          books={[book]}
          currentBook={book}
          canManageConfiguration={false}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: '분류 규칙 관리' })).not.toBeInTheDocument();
  });
});
