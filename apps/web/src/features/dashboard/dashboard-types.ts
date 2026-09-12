import type { CalendarOccurrence, Dday, Goal, LedgerMonthSummary } from '@home/shared';

export const DASHBOARD_WIDGETS = ['schedule', 'ledger', 'ddays', 'goals', 'quick_actions'] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number];
export type DashboardData = {
  occurrences: CalendarOccurrence[];
  ledgerBookName: string | null;
  ledgerSummary: LedgerMonthSummary | null;
  ddays: Dday[];
  goals: Goal[];
  warnings: string[];
};
export const DEFAULT_WIDGET_ORDER: DashboardWidgetId[] = [...DASHBOARD_WIDGETS];
export const moveDashboardWidget = (order: DashboardWidgetId[], from: number, to: number) => {
  if (from === to || to < 0 || to >= order.length) return order;
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};
