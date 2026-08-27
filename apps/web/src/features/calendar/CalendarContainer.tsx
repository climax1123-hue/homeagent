import type {
  CalendarEvent,
  CalendarEventException,
  CalendarEventInput,
  CalendarView,
  HouseholdMember,
} from '@home/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccess, useAuth } from '../auth/auth';
import { createHouseholdApi } from '../household/api/household-api';
import { createCalendarApi } from './api/calendar-api';
import { createGoogleCalendarApi, type GoogleCalendarConnection } from './api/google-calendar-api';
import { createNotificationApi } from './api/notification-api';
import { expandOccurrences, visibleRange } from './calendar-dates';
import { CalendarPage } from './CalendarPage';
import { NotificationPanel } from './NotificationPanel';

export function CalendarContainer() {
  const { client, user } = useAuth();
  const { access } = useAccess();
  const active = access?.kind === 'active' ? access : null;
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [exceptions, setExceptions] = useState<CalendarEventException[]>([]);
  const [eventReminderMinutes, setEventReminderMinutes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [googleConnection, setGoogleConnection] = useState<GoogleCalendarConnection | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const api = useMemo(() => createCalendarApi(client), [client]);
  const householdApi = useMemo(() => createHouseholdApi(client), [client]);
  const googleApi = useMemo(() => createGoogleCalendarApi(client), [client]);
  const notificationApi = useMemo(() => createNotificationApi(client), [client]);
  const range = useMemo(() => visibleRange(anchor, view), [anchor, view]);

  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError('');
    try {
      const [nextEvents, nextMembers, nextGoogleConnection, nextReminderMinutes] =
        await Promise.all([
          api.listEvents(active.householdId, range.start, range.end),
          householdApi.listMembers(active.householdId),
          googleApi.getConnection(),
          notificationApi.listEventReminderMinutes(),
        ]);
      const nextExceptions = await api.listExceptions(
        nextEvents.filter((event) => event.recurrence).map((event) => event.id),
        range.start,
        range.end,
      );
      setEvents(nextEvents);
      setExceptions(nextExceptions);
      setMembers(nextMembers.filter((member) => member.status === 'active'));
      setGoogleConnection(nextGoogleConnection);
      setEventReminderMinutes(nextReminderMinutes);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '일정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [active, api, googleApi, householdApi, notificationApi, range.end, range.start]);

  useEffect(() => {
    void load();
  }, [load]);
  const occurrences = useMemo(
    () => expandOccurrences(events, exceptions, range.start, range.end),
    [events, exceptions, range],
  );
  if (!active || !user) return null;

  const save = async (input: CalendarEventInput, id?: string) => {
    const saved = id ? await api.updateEvent(id, input) : await api.createEvent(input);
    await load();
    return saved.id;
  };
  const occurrenceAction = async (action: () => Promise<void>) => {
    await action();
    await load();
  };
  const remove = async (id: string) => {
    await api.deleteEvent(id);
    await load();
  };
  const googleAction = async (action: () => Promise<unknown>) => {
    setGoogleBusy(true);
    setError('');
    try {
      await action();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Google Calendar 요청에 실패했습니다.');
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <>
      <CalendarPage
        anchor={anchor}
        currentUserId={user.id}
        error={error}
        eventReminderMinutes={eventReminderMinutes}
        householdId={active.householdId}
        googleBusy={googleBusy}
        googleConnection={googleConnection}
        loading={loading}
        members={members}
        occurrences={occurrences}
        onAnchorChange={setAnchor}
        onDelete={remove}
        onCancelOccurrence={(occurrence) =>
          occurrenceAction(() =>
            api.cancelOccurrence(
              occurrence.sourceEvent ?? occurrence.event,
              occurrence.originalStart,
            ),
          )
        }
        onGoogleConnect={() => googleAction(() => googleApi.connect())}
        onGoogleDisconnect={() => googleAction(() => googleApi.disconnect())}
        onGoogleSync={(eventId) => googleAction(() => googleApi.syncEvent(eventId))}
        onReload={load}
        onRestoreOccurrence={(exceptionId) =>
          occurrenceAction(() => api.restoreOccurrence(exceptionId))
        }
        onSave={save}
        onSaveOccurrence={(occurrence, input) =>
          occurrenceAction(() =>
            api.overrideOccurrence(
              occurrence.sourceEvent ?? occurrence.event,
              occurrence.originalStart,
              input,
            ),
          )
        }
        onSaveReminder={(eventId, title, minutes) =>
          occurrenceAction(() =>
            notificationApi.saveEventReminder({
              eventId,
              householdId: active.householdId,
              userId: user.id,
              title,
              minutes,
            }),
          )
        }
        onViewChange={setView}
        role={active.role}
        view={view}
      />
      <NotificationPanel client={client} householdId={active.householdId} userId={user.id} />
    </>
  );
}
