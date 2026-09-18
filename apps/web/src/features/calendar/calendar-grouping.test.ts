import type { CalendarEvent, CalendarOccurrence } from '@home/shared';
import { describe, expect, it } from 'vitest';
import { fromDateKey } from './calendar-dates';
import { groupOccurrencesByDays } from './calendar-grouping';

const event: CalendarEvent = {
  id: 'event-1',
  householdId: 'home-1',
  ownerUserId: 'user-1',
  visibility: 'family',
  title: '가족 여행',
  description: '',
  location: '',
  startsAt: '2026-09-17T15:00:00.000Z',
  endsAt: '2026-09-20T15:00:00.000Z',
  allDay: true,
  timezone: 'Asia/Seoul',
  color: 'blue',
  recurrence: null,
  createdAt: '',
  updatedAt: '',
};
const occurrence: CalendarOccurrence = {
  event,
  occurrenceStart: event.startsAt,
  occurrenceEnd: event.endsAt,
  originalStart: event.startsAt,
  recurring: false,
};

describe('groupOccurrencesByDays', () => {
  it('shows an all-day period on every included calendar date', () => {
    const days = ['2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'].map(
      fromDateKey,
    );
    expect([...groupOccurrencesByDays([occurrence], days).keys()]).toEqual([
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]);
  });
  it('does not include an event ending exactly at the start of a day', () => {
    const result = groupOccurrencesByDays([occurrence], [fromDateKey('2026-09-21')]);
    expect(result.size).toBe(0);
  });
});
