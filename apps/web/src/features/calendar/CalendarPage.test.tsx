import type { CalendarEvent, CalendarOccurrence } from '@home/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarPage } from './CalendarPage';

const event: CalendarEvent = {
  id: 'event-1',
  householdId: 'home-1',
  ownerUserId: 'user-1',
  visibility: 'family',
  title: '가족 여행',
  description: '',
  location: '제주도',
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
const noop = vi.fn().mockResolvedValue(undefined);

describe('CalendarPage month view', () => {
  it('shows a multi-day event title on every included date', () => {
    render(
      <CalendarPage
        anchor={new Date('2026-09-18T03:00:00Z')}
        currentUserId="user-1"
        eventReminderMinutes={{}}
        householdId="home-1"
        googleBusy={false}
        googleConnection={null}
        loading={false}
        members={[]}
        occurrences={[occurrence]}
        role="admin"
        view="month"
        onAnchorChange={vi.fn()}
        onDelete={noop}
        onCancelOccurrence={noop}
        onGoogleConnect={noop}
        onGoogleDisconnect={noop}
        onGoogleSync={noop}
        onReload={noop}
        onRestoreOccurrence={noop}
        onSave={vi.fn().mockResolvedValue('event-1')}
        onSaveOccurrence={noop}
        onSaveReminder={noop}
        onViewChange={vi.fn()}
        onFeedback={vi.fn()}
      />,
    );
    expect(screen.getAllByText('가족 여행')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /가족 여행/ })).toHaveLength(3);
  });
});
