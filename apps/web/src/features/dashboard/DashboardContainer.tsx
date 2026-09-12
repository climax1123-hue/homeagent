import type { LedgerMonthSummary } from '@home/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FeedbackDialog, type Feedback } from '../../components/FeedbackDialog';
import { useAccess, useAuth } from '../auth/auth';
import { createCalendarApi } from '../calendar/api/calendar-api';
import { expandOccurrences, fromDateKey, toDateKey } from '../calendar/calendar-dates';
import { createDdaysApi } from '../ddays/api/ddays-api';
import { createGoalsApi } from '../goals/api/goals-api';
import { createLedgerApi } from '../ledger/api/ledger-api';
import { createDashboardApi } from './api/dashboard-api';
import { DashboardPage } from './DashboardPage';
import {
  DEFAULT_WIDGET_ORDER,
  type DashboardData,
  type DashboardWidgetId,
} from './dashboard-types';

const EMPTY_DATA: DashboardData = {
  occurrences: [],
  ledgerBookName: null,
  ledgerSummary: null,
  ddays: [],
  goals: [],
  warnings: [],
};
const monthKey = () => toDateKey(new Date()).slice(0, 7);

export function DashboardContainer() {
  const { client, user } = useAuth();
  const { access } = useAccess();
  const active = access?.kind === 'active' ? access : null;
  const calendarApi = useMemo(() => createCalendarApi(client), [client]);
  const ledgerApi = useMemo(() => createLedgerApi(client), [client]);
  const goalsApi = useMemo(() => createGoalsApi(client), [client]);
  const ddaysApi = useMemo(() => createDdaysApi(client), [client]);
  const dashboardApi = useMemo(() => createDashboardApi(client), [client]);
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [order, setOrder] = useState<DashboardWidgetId[]>(DEFAULT_WIDGET_ORDER);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const load = useCallback(async () => {
    if (!active || !user) return;
    setLoading(true);
    const start = fromDateKey(toDateKey(new Date()));
    const end = new Date(start.getTime() + 14 * 86_400_000);
    const [eventsResult, booksResult, goalsResult, ddaysResult, orderResult] =
      await Promise.allSettled([
        calendarApi.listEvents(active.householdId, start, end),
        ledgerApi.listBooks(active.householdId),
        goalsApi.list(active.householdId),
        ddaysApi.list(active.householdId),
        dashboardApi.getOrder(active.householdId, user.id),
      ]);
    const warnings: string[] = [];
    let occurrences: DashboardData['occurrences'] = [];
    if (eventsResult.status === 'fulfilled') {
      try {
        const exceptions = await calendarApi.listExceptions(
          eventsResult.value.filter((event) => event.recurrence).map((event) => event.id),
          start,
          end,
        );
        occurrences = expandOccurrences(eventsResult.value, exceptions, start, end).slice(0, 5);
      } catch {
        warnings.push('일정 일부를 불러오지 못했습니다.');
      }
    } else warnings.push('일정을 불러오지 못했습니다.');
    let ledgerBookName: string | null = null;
    let ledgerSummary: LedgerMonthSummary | null = null;
    if (booksResult.status === 'fulfilled' && booksResult.value[0]) {
      const familyBook = booksResult.value.find((book) => book.visibility === 'family');
      const book = familyBook ?? booksResult.value[0];
      ledgerBookName = book.name;
      try {
        ledgerSummary = await ledgerApi.getMonthSummary(book.id, monthKey());
      } catch {
        warnings.push('가계부 요약을 불러오지 못했습니다.');
      }
    } else if (booksResult.status === 'rejected') warnings.push('가계부를 불러오지 못했습니다.');
    if (goalsResult.status === 'rejected') warnings.push('목표를 불러오지 못했습니다.');
    if (ddaysResult.status === 'rejected') warnings.push('디데이를 불러오지 못했습니다.');
    if (orderResult.status === 'fulfilled') setOrder(orderResult.value);
    else warnings.push('저장한 카드 순서를 불러오지 못했습니다.');
    setData({
      occurrences,
      ledgerBookName,
      ledgerSummary,
      goals: goalsResult.status === 'fulfilled' ? goalsResult.value : [],
      ddays: ddaysResult.status === 'fulfilled' ? ddaysResult.value : [],
      warnings,
    });
    setLoading(false);
  }, [active, calendarApi, dashboardApi, ddaysApi, goalsApi, ledgerApi, user]);

  useEffect(() => void load(), [load]);
  if (!active || !user) return null;
  return (
    <>
      <DashboardPage
        data={data}
        loading={loading}
        order={order}
        userEmail={user.email ?? ''}
        onSaveOrder={async (nextOrder) => {
          try {
            await dashboardApi.saveOrder(active.householdId, user.id, nextOrder);
            setOrder(nextOrder);
            setFeedback({ type: 'success', message: '내 대시보드 카드 순서를 저장했습니다.' });
          } catch (reason) {
            setFeedback({
              type: 'error',
              message:
                reason instanceof Error ? reason.message : '카드 순서를 저장하지 못했습니다.',
            });
            throw reason;
          }
        }}
      />
      <FeedbackDialog feedback={feedback} onClose={() => setFeedback(null)} />
    </>
  );
}
