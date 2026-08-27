import type { CalendarEvent } from '@home/shared';
import { describe, expect, it } from 'vitest';
import { expandOccurrences, monthGrid, startOfWeek, toDateKey } from './calendar-dates';

const event: CalendarEvent = {
  id: 'e',
  householdId: 'h',
  ownerUserId: 'u',
  visibility: 'family',
  title: '일정',
  description: '',
  location: '',
  startsAt: '2026-08-26T00:00:00.000Z',
  endsAt: '2026-08-26T01:00:00.000Z',
  allDay: false,
  timezone: 'Asia/Seoul',
  color: 'blue',
  recurrence: null,
  createdAt: '',
  updatedAt: '',
};

describe('calendar dates', () => {
  it('builds a 6-week month grid starting Sunday', () => {
    const days = monthGrid(new Date('2026-08-15T00:00:00Z'));
    expect(days).toHaveLength(42);
    expect(days[0].getUTCDay()).toBe(0);
  });
  it('starts a week on Sunday', () =>
    expect(startOfWeek(new Date('2026-08-26T03:00:00Z')).getUTCDay()).toBe(0));
  it('expands daily recurrence with count', () => {
    const values = expandOccurrences(
      [{ ...event, recurrence: { frequency: 'daily', interval: 1, until: null, count: 3 } }],
      [],
      new Date('2026-08-25T00:00:00Z'),
      new Date('2026-09-01T00:00:00Z'),
    );
    expect(values.map((value) => toDateKey(new Date(value.occurrenceStart)))).toEqual([
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
    ]);
  });
  it('clips occurrences outside the range', () =>
    expect(
      expandOccurrences(
        [event],
        [],
        new Date('2026-08-27T00:00:00Z'),
        new Date('2026-08-28T00:00:00Z'),
      ),
    ).toHaveLength(0));

  it('cancels and overrides individual recurring occurrences', () => {
    const recurring = {
      ...event,
      recurrence: { frequency: 'daily' as const, interval: 1, until: null, count: 3 },
    };
    const values = expandOccurrences(
      [recurring],
      [
        {
          id: 'cancel',
          eventId: 'e',
          householdId: 'h',
          ownerUserId: 'u',
          originalStartsAt: '2026-08-27T00:00:00.000Z',
          action: 'cancelled',
          title: null,
          description: null,
          location: null,
          startsAt: null,
          endsAt: null,
          allDay: null,
          color: null,
        },
        {
          id: 'override',
          eventId: 'e',
          householdId: 'h',
          ownerUserId: 'u',
          originalStartsAt: '2026-08-28T00:00:00.000Z',
          action: 'override',
          title: '변경 일정',
          description: '',
          location: '',
          startsAt: '2026-08-28T03:00:00.000Z',
          endsAt: '2026-08-28T04:00:00.000Z',
          allDay: false,
          color: 'orange',
        },
      ],
      new Date('2026-08-25T00:00:00Z'),
      new Date('2026-09-01T00:00:00Z'),
    );
    expect(values).toHaveLength(2);
    expect(values[1]).toMatchObject({
      overridden: true,
      originalStart: '2026-08-28T00:00:00.000Z',
    });
    expect(values[1].event.title).toBe('변경 일정');
  });
});
