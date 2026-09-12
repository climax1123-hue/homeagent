import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { DEFAULT_WIDGET_ORDER, moveDashboardWidget, type DashboardData } from './dashboard-types';

const data: DashboardData = {
  occurrences: [
    {
      event: {
        id: 'event-1',
        householdId: 'home-1',
        ownerUserId: 'user-1',
        visibility: 'family',
        title: '가족 식사',
        description: '',
        location: '우리집',
        startsAt: '2099-01-01T10:00:00Z',
        endsAt: '2099-01-01T11:00:00Z',
        allDay: false,
        timezone: 'Asia/Seoul',
        color: 'blue',
        recurrence: null,
        createdAt: '',
        updatedAt: '',
      },
      occurrenceStart: '2099-01-01T10:00:00Z',
      occurrenceEnd: '2099-01-01T11:00:00Z',
      originalStart: '2099-01-01T10:00:00Z',
      recurring: false,
    },
  ],
  ledgerBookName: '우리집 가계부',
  ledgerSummary: { incomeTotal: '3200000', expenseTotal: '2180000', netTotal: '1020000' },
  ddays: [
    {
      id: 'dday-1',
      householdId: 'home-1',
      ownerUserId: 'user-1',
      visibility: 'family',
      title: '결혼기념일',
      targetDate: '2099-04-30',
      memo: '',
      repeatYearly: false,
      createdAt: '',
      updatedAt: '',
    },
  ],
  goals: [
    {
      id: 'goal-1',
      householdId: 'home-1',
      ownerUserId: 'user-1',
      visibility: 'family',
      title: '가족 여행 준비',
      description: '',
      targetDate: null,
      status: 'active',
      progress: 65,
      createdAt: '',
      updatedAt: '',
    },
  ],
  warnings: [],
};
const renderPage = (onSaveOrder = vi.fn().mockResolvedValue(undefined)) =>
  render(
    <MemoryRouter>
      <DashboardPage
        data={data}
        loading={false}
        order={DEFAULT_WIDGET_ORDER}
        userEmail="family@example.test"
        onSaveOrder={onSaveOrder}
      />
    </MemoryRouter>,
  );

describe('DashboardPage', () => {
  it('shows summaries from all four features', () => {
    renderPage();
    expect(screen.getByText('가족 식사')).toBeInTheDocument();
    expect(screen.getByText('3,200,000원')).toBeInTheDocument();
    expect(screen.getByText('결혼기념일')).toBeInTheDocument();
    expect(screen.getByText('가족 여행 준비')).toBeInTheDocument();
  });
  it('reorders and saves widgets for the member', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderPage(save);
    fireEvent.click(screen.getByRole('button', { name: /편집/ }));
    fireEvent.click(screen.getByRole('button', { name: '다가오는 일정 아래로 이동' }));
    fireEvent.click(screen.getByRole('button', { name: '순서 저장' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(['ledger', 'schedule', 'ddays', 'goals', 'quick_actions']),
    );
  });
  it('moves a widget without mutating the source order', () => {
    const source = [...DEFAULT_WIDGET_ORDER];
    expect(moveDashboardWidget(source, 0, 2)).toEqual([
      'ledger',
      'ddays',
      'schedule',
      'goals',
      'quick_actions',
    ]);
    expect(source).toEqual(DEFAULT_WIDGET_ORDER);
  });
});
