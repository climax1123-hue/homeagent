import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { LedgerBook, LedgerDashboardData } from '@home/shared';
import { LedgerDashboardPage } from './LedgerDashboardPage';

const book: LedgerBook = {
  id: 'book-1',
  householdId: 'home-1',
  ownerUserId: 'user-1',
  visibility: 'family',
  name: '우리집 가계부',
  currency: 'KRW',
  isActive: true,
  createdAt: '',
  updatedAt: '',
};
const summary = {
  incomeTotal: '3000000',
  expenseTotal: '1200000',
  netTotal: '1800000',
  transactionCount: 12,
  expenseTransactionCount: 10,
  activeDays: 8,
};
const data: LedgerDashboardData = {
  summary,
  previousSummary: { ...summary, expenseTotal: '1000000', netTotal: '2000000' },
  monthly: [{ period: '2026-08', income: '3000000', expense: '1200000', net: '1800000' }],
  categories: [
    {
      id: 'food',
      name: '식비',
      color: 'orange',
      amount: '700000',
      count: 6,
      previousAmount: '500000',
    },
  ],
  accounts: [{ id: 'card', name: '생활비 카드', amount: '1200000', count: 10 }],
  members: [{ id: 'user-1', name: '나', amount: '1200000', count: 10 }],
  weekdays: [{ id: '1', weekday: 1, name: '월', amount: '1200000', count: 10 }],
  daily: [{ date: '2026-08-27', income: '0', expense: '1200000' }],
  merchants: [{ id: 'mart', name: '우리마트', amount: '700000', count: 3, average: '233333' }],
  recurring: [
    { id: 'netflix', name: '넷플릭스', amount: '34000', count: 2, months: 2, average: '17000' },
  ],
};
const props = {
  books: [book],
  bookId: book.id,
  data,
  error: '',
  from: '2026-08-01',
  to: '2026-08-31',
  loading: false,
  preset: '1m' as const,
  onBookChange: vi.fn(),
  onPresetChange: vi.fn(),
  onFromChange: vi.fn(),
  onToChange: vi.fn(),
};

describe('LedgerDashboardPage', () => {
  it('shows decision metrics and all analysis perspectives', () => {
    render(
      <MemoryRouter>
        <LedgerDashboardPage {...props} />
      </MemoryRouter>,
    );
    expect(screen.getByText('3,000,000원')).toBeInTheDocument();
    expect(screen.getByText('식비')).toBeInTheDocument();
    expect(screen.getByText('생활비 카드')).toBeInTheDocument();
    expect(screen.getByText('우리마트')).toBeInTheDocument();
    expect(screen.getByText('넷플릭스')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '요일별 소비' })).toBeInTheDocument();
  });

  it('changes presets and custom date filters', () => {
    const onPresetChange = vi.fn(),
      onFromChange = vi.fn();
    render(
      <MemoryRouter>
        <LedgerDashboardPage
          {...props}
          onPresetChange={onPresetChange}
          onFromChange={onFromChange}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: '6개월' }));
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-01-01' } });
    expect(onPresetChange).toHaveBeenCalledWith('6m');
    expect(onFromChange).toHaveBeenCalledWith('2026-01-01');
  });

  it('explains when there is no ledger', () => {
    render(
      <MemoryRouter>
        <LedgerDashboardPage {...props} books={[]} bookId="" data={null} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '분석할 장부가 없습니다' })).toBeInTheDocument();
  });
});
