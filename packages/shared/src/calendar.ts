export const CALENDAR_COLORS = ['blue', 'green', 'orange', 'pink', 'purple', 'gray'] as const;
export type CalendarColor = (typeof CALENDAR_COLORS)[number];
export type CalendarVisibility = 'family' | 'private';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type CalendarView = 'month' | 'week' | 'agenda';

export type CalendarRecurrence = {
  frequency: RecurrenceFrequency;
  interval: number;
  until: string | null;
  count: number | null;
};

export type CalendarEvent = {
  id: string;
  householdId: string;
  ownerUserId: string;
  visibility: CalendarVisibility;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: 'Asia/Seoul';
  color: CalendarColor;
  recurrence: CalendarRecurrence | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventInput = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;

export type CalendarEventException = {
  id: string;
  eventId: string;
  householdId: string;
  ownerUserId: string;
  originalStartsAt: string;
  action: 'cancelled' | 'override';
  title: string | null;
  description: string | null;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  allDay: boolean | null;
  color: CalendarColor | null;
};

export type CalendarOccurrence = {
  event: CalendarEvent;
  sourceEvent?: CalendarEvent;
  occurrenceStart: string;
  occurrenceEnd: string;
  originalStart: string;
  recurring: boolean;
  exceptionId?: string;
  overridden?: boolean;
};

export function validateCalendarEvent(input: CalendarEventInput): string | null {
  const title = input.title.trim();
  if (!title || title.length > 120) return '일정 제목을 1자 이상 120자 이하로 입력해 주세요.';
  if (input.description.length > 2000) return '설명은 2000자 이하로 입력해 주세요.';
  if (input.location.length > 200) return '장소는 200자 이하로 입력해 주세요.';
  if (!Number.isFinite(Date.parse(input.startsAt)) || !Number.isFinite(Date.parse(input.endsAt)))
    return '시작과 종료 시각을 확인해 주세요.';
  if (Date.parse(input.endsAt) <= Date.parse(input.startsAt))
    return '종료 시각은 시작 시각보다 늦어야 합니다.';
  if (input.recurrence && (input.recurrence.interval < 1 || input.recurrence.interval > 30))
    return '반복 간격은 1에서 30 사이여야 합니다.';
  if (input.recurrence?.until && input.recurrence.count)
    return '반복 종료일과 횟수 중 하나만 선택해 주세요.';
  return null;
}
