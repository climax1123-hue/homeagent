import type { CalendarEvent, CalendarOccurrence, HouseholdMember } from '@home/shared';
import { describe, expect, it } from 'vitest';
import { createGoogleCalendarUrl, filterOccurrences, memberName } from './calendar-filters';

const baseEvent: CalendarEvent = {
  id: 'event-1',
  householdId: 'house-1',
  ownerUserId: 'user-1',
  visibility: 'family',
  title: '병원 방문',
  description: '정기 검진',
  location: '서울 병원',
  startsAt: '2026-08-26T01:00:00.000Z',
  endsAt: '2026-08-26T02:00:00.000Z',
  allDay: false,
  timezone: 'Asia/Seoul',
  color: 'blue',
  recurrence: null,
  createdAt: '',
  updatedAt: '',
};
const occurrence: CalendarOccurrence = {
  event: baseEvent,
  occurrenceStart: baseEvent.startsAt,
  occurrenceEnd: baseEvent.endsAt,
  originalStart: baseEvent.startsAt,
  recurring: false,
};
const members: HouseholdMember[] = [
  {
    id: 'member-1',
    householdId: 'house-1',
    userId: 'user-1',
    displayName: '아빠',
    role: 'admin',
    status: 'active',
    joinedAt: '',
    statusChangedAt: '',
  },
];

describe('calendar filters', () => {
  it('filters by visibility, current user, and member', () => {
    const other = {
      ...occurrence,
      event: { ...baseEvent, id: 'event-2', ownerUserId: 'user-2', visibility: 'private' as const },
    };
    const values = [occurrence, other];
    expect(filterOccurrences(values, 'family', 'user-1')).toEqual([occurrence]);
    expect(filterOccurrences(values, 'mine', 'user-1')).toEqual([occurrence]);
    expect(filterOccurrences(values, 'private', 'user-1')).toEqual([other]);
    expect(filterOccurrences(values, 'member:user-2', 'user-1')).toEqual([other]);
  });

  it('labels the current and unknown member safely', () => {
    expect(memberName(members, 'user-1', 'user-1')).toBe('아빠 (나)');
    expect(memberName(members, 'missing', 'user-1')).toBe('알 수 없는 구성원');
  });

  it('creates a timed Google Calendar template URL', () => {
    const url = new URL(createGoogleCalendarUrl(occurrence));
    expect(url.origin).toBe('https://calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20260826T010000Z/20260826T020000Z');
    expect(url.searchParams.get('text')).toBe('병원 방문');
  });

  it('keeps the exclusive end date for an all-day Google event', () => {
    const url = new URL(
      createGoogleCalendarUrl({
        ...occurrence,
        occurrenceStart: '2026-08-25T15:00:00.000Z',
        occurrenceEnd: '2026-08-27T15:00:00.000Z',
        event: { ...baseEvent, allDay: true },
      }),
    );
    expect(url.searchParams.get('dates')).toBe('20260826/20260828');
  });
});
