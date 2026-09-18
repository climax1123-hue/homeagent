import type { CalendarOccurrence } from '@home/shared';
import { toDateKey } from './calendar-dates';

const DAY_MS = 86_400_000;

export function groupOccurrencesByDays(
  occurrences: CalendarOccurrence[],
  days: Date[],
): Map<string, CalendarOccurrence[]> {
  const result = new Map<string, CalendarOccurrence[]>();
  for (const day of days) {
    const dayStart = day.getTime();
    const dayEnd = dayStart + DAY_MS;
    const values = occurrences.filter(
      (occurrence) =>
        Date.parse(occurrence.occurrenceStart) < dayEnd &&
        Date.parse(occurrence.occurrenceEnd) > dayStart,
    );
    if (values.length) result.set(toDateKey(day), values);
  }
  return result;
}
