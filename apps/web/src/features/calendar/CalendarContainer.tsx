import type {
  CalendarEvent,
  CalendarEventException,
  CalendarEventInput,
  CalendarView,
  HouseholdMember,
  LedgerCommonCode,
} from '@home/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccess, useAuth } from '../auth/auth';
import { FeedbackDialog, type Feedback } from '../../components/FeedbackDialog';
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
  const [commonCodes, setCommonCodes] = useState<LedgerCommonCode[]>([]);
  const [exceptions, setExceptions] = useState<CalendarEventException[]>([]);
  const [eventReminderMinutes, setEventReminderMinutes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
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
    try {
      const [nextEvents, nextMembers, nextGoogleConnection, nextReminderMinutes, nextCodes] =
        await Promise.all([
          api.listEvents(active.householdId, range.start, range.end),
          householdApi.listMembers(active.householdId),
          googleApi.getConnection(),
          notificationApi.listEventReminderMinutes(),
          client
            .from('common_codes')
            .select('*')
            .eq('household_id', active.householdId)
            .eq('is_active', true)
            .order('sort_order'),
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
      if (nextCodes.error) throw new Error('공통코드를 불러오지 못했습니다.');
      setCommonCodes(
        (nextCodes.data ?? []).map((row) => ({
          id: String(row.id),
          householdId: String(row.household_id),
          groupKey: String(row.group_key),
          groupLabel: String(row.group_label),
          code: String(row.code),
          valueText: row.value_text == null ? undefined : String(row.value_text),
          label: String(row.label),
          sortOrder: Number(row.sort_order),
          isSystem: Boolean(row.is_system),
          isAdminEditable: Boolean(row.is_admin_editable),
          isActive: Boolean(row.is_active),
        })),
      );
    } catch (reason) {
      setFeedback({
        type: 'error',
        message: reason instanceof Error ? reason.message : '일정을 불러오지 못했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [active, api, client, googleApi, householdApi, notificationApi, range.end, range.start]);

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
  const occurrenceAction = async (action: () => Promise<void>, successMessage: string) => {
    try {
      await action();
      await load();
      setFeedback({ type: 'success', message: successMessage });
    } catch (reason) {
      setFeedback({
        type: 'error',
        message: reason instanceof Error ? reason.message : '일정 요청을 처리하지 못했습니다.',
      });
      throw reason;
    }
  };
  const remove = async (id: string) => {
    try {
      await api.deleteEvent(id);
      await load();
      setFeedback({ type: 'success', message: '일정을 정상적으로 삭제했습니다.' });
    } catch (reason) {
      setFeedback({
        type: 'error',
        message: reason instanceof Error ? reason.message : '일정을 삭제하지 못했습니다.',
      });
      throw reason;
    }
  };
  const googleAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setGoogleBusy(true);
    try {
      await action();
      await load();
      setFeedback({ type: 'success', message: successMessage });
    } catch (reason) {
      setFeedback({
        type: 'error',
        message: reason instanceof Error ? reason.message : 'Google Calendar 요청에 실패했습니다.',
      });
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <>
      <CalendarPage
        anchor={anchor}
        currentUserId={user.id}
        commonCodes={commonCodes}
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
          occurrenceAction(
            () =>
              api.cancelOccurrence(
                occurrence.sourceEvent ?? occurrence.event,
                occurrence.originalStart,
              ),
            '선택한 일정을 삭제했습니다.',
          )
        }
        onGoogleConnect={() =>
          googleAction(() => googleApi.connect(), 'Google Calendar를 연결했습니다.')
        }
        onGoogleDisconnect={() =>
          googleAction(() => googleApi.disconnect(), 'Google Calendar 연결을 해제했습니다.')
        }
        onGoogleSync={(eventId) =>
          googleAction(() => googleApi.syncEvent(eventId), 'Google Calendar에 일정을 반영했습니다.')
        }
        onReload={load}
        onRestoreOccurrence={(exceptionId) =>
          occurrenceAction(
            () => api.restoreOccurrence(exceptionId),
            '선택한 일정을 원래대로 복원했습니다.',
          )
        }
        onSave={save}
        onSaveOccurrence={(occurrence, input) =>
          occurrenceAction(
            () =>
              api.overrideOccurrence(
                occurrence.sourceEvent ?? occurrence.event,
                occurrence.originalStart,
                input,
              ),
            '선택한 일정을 수정했습니다.',
          )
        }
        onSaveReminder={(eventId, title, minutes) =>
          occurrenceAction(
            () =>
              notificationApi.saveEventReminder({
                eventId,
                householdId: active.householdId,
                userId: user.id,
                title,
                minutes,
              }),
            '일정 알림 설정을 저장했습니다.',
          )
        }
        onFeedback={(type, message) => setFeedback({ type, message })}
        onViewChange={setView}
        role={active.role}
        view={view}
      />
      <NotificationPanel client={client} householdId={active.householdId} userId={user.id} />
      <FeedbackDialog feedback={feedback} onClose={() => setFeedback(null)} />
    </>
  );
}
