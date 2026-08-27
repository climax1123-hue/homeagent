import type { CalendarOccurrence, HouseholdMember } from '@home/shared';

export type CalendarFilter = 'all' | 'family' | 'mine' | 'private' | `member:${string}`;

export function filterOccurrences(
  occurrences: CalendarOccurrence[],
  filter: CalendarFilter,
  currentUserId: string,
): CalendarOccurrence[] {
  if (filter === 'all') return occurrences;
  if (filter === 'family') {
    return occurrences.filter((value) => value.event.visibility === 'family');
  }
  if (filter === 'mine') {
    return occurrences.filter((value) => value.event.ownerUserId === currentUserId);
  }
  if (filter === 'private') {
    return occurrences.filter((value) => value.event.visibility === 'private');
  }
  const ownerUserId = filter.slice('member:'.length);
  return occurrences.filter((value) => value.event.ownerUserId === ownerUserId);
}

export function memberName(members: HouseholdMember[], userId: string, currentUserId: string) {
  const name =
    members.find((member) => member.userId === userId)?.displayName || '알 수 없는 구성원';
  return userId === currentUserId ? `${name} (나)` : name;
}

export function memberColorIndex(members: HouseholdMember[], userId: string) {
  const index = members.findIndex((member) => member.userId === userId);
  return index < 0 ? 0 : index % 6;
}

function compactUtc(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function compactDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date(value))
    .replace(/-/g, '');
}

export function createGoogleCalendarUrl(occurrence: CalendarOccurrence) {
  const { event } = occurrence;
  const dates = event.allDay
    ? `${compactDate(occurrence.occurrenceStart)}/${compactDate(occurrence.occurrenceEnd)}`
    : `${compactUtc(occurrence.occurrenceStart)}/${compactUtc(occurrence.occurrenceEnd)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    ctz: event.timezone,
  });
  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
