import type { CalendarEvent, CalendarEventException, CalendarOccurrence } from '@home/shared';

const SEOUL_OFFSET = '+09:00';
const DAY_MS = 86_400_000;

export const toDateKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
export const fromDateKey = (key: string) => new Date(`${key}T00:00:00${SEOUL_OFFSET}`);
export const toDateTimeLocal = (iso: string) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(iso))
    .replace(' ', 'T');
export const fromDateTimeLocal = (value: string) =>
  new Date(`${value}:00${SEOUL_OFFSET}`).toISOString();

export function startOfWeek(date: Date) {
  const local = fromDateKey(toDateKey(date));
  return new Date(local.getTime() - local.getUTCDay() * DAY_MS);
}

export function monthGrid(anchor: Date) {
  const [year, month] = toDateKey(anchor).split('-').map(Number);
  const first = fromDateKey(`${year}-${String(month).padStart(2, '0')}-01`);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getTime() + index * DAY_MS));
}

export function visibleRange(anchor: Date, view: 'month' | 'week' | 'agenda') {
  if (view === 'month') {
    const days = monthGrid(anchor);
    return { start: days[0], end: new Date(days[41].getTime() + DAY_MS) };
  }
  const start = view === 'week' ? startOfWeek(anchor) : fromDateKey(toDateKey(anchor));
  return { start, end: new Date(start.getTime() + (view === 'week' ? 7 : 31) * DAY_MS) };
}

function addMonthsClamped(date: Date, months: number) {
  const source = new Date(date);
  const day = source.getUTCDate();
  source.setUTCDate(1);
  source.setUTCMonth(source.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 0),
  ).getUTCDate();
  source.setUTCDate(Math.min(day, last));
  return source;
}

function nextOccurrence(date: Date, frequency: string, interval: number) {
  if (frequency === 'daily') return new Date(date.getTime() + interval * DAY_MS);
  if (frequency === 'weekly') return new Date(date.getTime() + interval * 7 * DAY_MS);
  if (frequency === 'monthly') return addMonthsClamped(date, interval);
  return addMonthsClamped(date, interval * 12);
}

export function expandOccurrences(
  events: CalendarEvent[],
  exceptions: CalendarEventException[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarOccurrence[] {
  const occurrences: CalendarOccurrence[] = [];
  const exceptionMap = new Map(
    exceptions.map((exception) => [
      `${exception.eventId}/${exception.originalStartsAt}`,
      exception,
    ]),
  );
  const expandedStart = new Date(rangeStart.getTime() - 7 * DAY_MS);
  const expandedEnd = new Date(rangeEnd.getTime() + 7 * DAY_MS);
  for (const event of events) {
    let start = new Date(event.startsAt);
    const duration = Date.parse(event.endsAt) - start.getTime();
    let index = 0;
    while (index < 2000) {
      const end = new Date(start.getTime() + duration);
      const originalStart = start.toISOString();
      if (end > expandedStart && start < expandedEnd) {
        const exception = exceptionMap.get(`${event.id}/${originalStart}`);
        if (exception?.action !== 'cancelled') {
          const overridden = exception?.action === 'override';
          const occurrenceStart = overridden ? exception.startsAt! : originalStart;
          const occurrenceEnd = overridden ? exception.endsAt! : end.toISOString();
          if (new Date(occurrenceEnd) > rangeStart && new Date(occurrenceStart) < rangeEnd) {
            occurrences.push({
              event: overridden
                ? {
                    ...event,
                    title: exception.title!,
                    description: exception.description ?? '',
                    location: exception.location ?? '',
                    startsAt: occurrenceStart,
                    endsAt: occurrenceEnd,
                    allDay: exception.allDay!,
                    color: exception.color!,
                  }
                : event,
              sourceEvent: overridden ? event : undefined,
              occurrenceStart,
              occurrenceEnd,
              originalStart,
              recurring: Boolean(event.recurrence),
              exceptionId: exception?.id,
              overridden,
            });
          }
        }
      }
      index += 1;
      if (!event.recurrence || (event.recurrence.count && index >= event.recurrence.count)) break;
      const next = nextOccurrence(start, event.recurrence.frequency, event.recurrence.interval);
      if (event.recurrence.until && toDateKey(next) > event.recurrence.until) break;
      if (next >= expandedEnd && next > expandedStart) break;
      start = next;
    }
  }
  return occurrences.sort(
    (a, b) =>
      a.occurrenceStart.localeCompare(b.occurrenceStart) ||
      a.event.title.localeCompare(b.event.title),
  );
}

export const formatPeriod = (anchor: Date, view: string) =>
  view === 'month'
    ? new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'long',
      }).format(anchor)
    : new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: 'long',
        day: 'numeric',
      }).format(anchor);

export const formatEventTime = (occurrence: CalendarOccurrence) =>
  occurrence.event.allDay
    ? '종일'
    : new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(occurrence.occurrenceStart));
