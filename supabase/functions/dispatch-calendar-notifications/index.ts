import webpush from 'npm:web-push@3.6.7';
import { requiredSecret, serviceClient } from '../_shared/google-calendar.ts';

type Reminder = {
  id: string;
  owner_user_id: string;
  kind: 'event' | 'recurring';
  title: string;
  body: string;
  advance_minutes: number | null;
  local_time: string | null;
  weekdays: number[] | null;
  starts_on: string | null;
  ends_on: string | null;
  calendar_events: {
    id: string;
    title: string;
    starts_at: string;
    recurrence_frequency: string | null;
    recurrence_interval: number;
    recurrence_until: string | null;
    recurrence_count: number | null;
  } | null;
};

type ExceptionRow = {
  event_id: string;
  original_starts_at: string;
  action: 'cancelled' | 'override';
  title: string | null;
  starts_at: string | null;
};

const DAY_MS = 86_400_000;
function addMonthsClamped(date: Date, months: number) {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  return next;
}
function nextOccurrence(date: Date, frequency: string, interval: number) {
  if (frequency === 'daily') return new Date(date.getTime() + interval * DAY_MS);
  if (frequency === 'weekly') return new Date(date.getTime() + interval * 7 * DAY_MS);
  return addMonthsClamped(date, frequency === 'monthly' ? interval : interval * 12);
}

const seoulParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday')),
  };
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (request.headers.get('x-cron-secret') !== requiredSecret('NOTIFICATION_CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }
  webpush.setVapidDetails(
    requiredSecret('VAPID_SUBJECT'),
    requiredSecret('VAPID_PUBLIC_KEY'),
    requiredSecret('VAPID_PRIVATE_KEY'),
  );
  const service = serviceClient();
  const now = new Date();
  const local = seoulParts(now);
  const { data, error } = await service
    .from('calendar_reminders')
    .select(
      'id, owner_user_id, kind, title, body, advance_minutes, local_time, weekdays, starts_on, ends_on, calendar_events(id, title, starts_at, recurrence_frequency, recurrence_interval, recurrence_until, recurrence_count)',
    )
    .eq('enabled', true);
  if (error) return new Response('Query failed', { status: 500 });
  const reminders = data as unknown as Reminder[];
  const eventIds = reminders.flatMap((reminder) =>
    reminder.calendar_events?.id ? [reminder.calendar_events.id] : [],
  );
  const { data: exceptionRows } = eventIds.length
    ? await service
        .from('calendar_event_exceptions')
        .select('event_id, original_starts_at, action, title, starts_at')
        .in('event_id', eventIds)
        .gte('original_starts_at', new Date(now.getTime() - 8 * DAY_MS).toISOString())
        .lte('original_starts_at', new Date(now.getTime() + 15 * DAY_MS).toISOString())
    : { data: [] };
  const exceptionMap = new Map(
    ((exceptionRows ?? []) as ExceptionRow[]).map((value) => [
      `${value.event_id}/${value.original_starts_at}`,
      value,
    ]),
  );

  const due = reminders.flatMap((reminder) => {
    if (reminder.kind === 'recurring') {
      const activeDate =
        (!reminder.starts_on || reminder.starts_on <= local.date) &&
        (!reminder.ends_on || reminder.ends_on >= local.date);
      if (
        !activeDate ||
        !reminder.weekdays?.includes(local.weekday) ||
        reminder.local_time?.slice(0, 5) !== local.time
      )
        return [];
      return [
        {
          reminder,
          scheduledFor: new Date(`${local.date}T${local.time}:00+09:00`),
          title: reminder.title,
        },
      ];
    }
    if (!reminder.calendar_events || reminder.advance_minutes === null) return [];
    const source = reminder.calendar_events;
    let occurrence = new Date(source.starts_at);
    for (let index = 0; index < 2000; index += 1) {
      const originalStart = occurrence.toISOString();
      const exception = exceptionMap.get(`${source.id}/${originalStart}`);
      const effectiveStart =
        exception?.action === 'override' && exception.starts_at
          ? new Date(exception.starts_at)
          : occurrence;
      const scheduledFor = new Date(effectiveStart.getTime() - reminder.advance_minutes * 60_000);
      if (
        exception?.action !== 'cancelled' &&
        Math.abs(now.getTime() - scheduledFor.getTime()) < 60_000
      ) {
        return [{ reminder, scheduledFor, title: exception?.title ?? source.title }];
      }
      if (
        !source.recurrence_frequency ||
        (source.recurrence_count && index + 1 >= source.recurrence_count)
      )
        break;
      const next = nextOccurrence(
        occurrence,
        source.recurrence_frequency,
        source.recurrence_interval,
      );
      if (source.recurrence_until && seoulParts(next).date > source.recurrence_until) break;
      if (next.getTime() - reminder.advance_minutes * 60_000 > now.getTime() + 8 * DAY_MS) break;
      occurrence = next;
    }
    return [];
  });

  let sent = 0;
  for (const item of due) {
    const { data: subscriptions } = await service
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', item.reminder.owner_user_id)
      .eq('active', true);
    for (const subscription of subscriptions ?? []) {
      const { data: claim } = await service
        .from('notification_deliveries')
        .insert({
          reminder_id: item.reminder.id,
          subscription_id: subscription.id,
          scheduled_for: item.scheduledFor.toISOString(),
          status: 'claimed',
        })
        .select('id')
        .maybeSingle();
      if (!claim) continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
          },
          JSON.stringify({
            title:
              item.reminder.kind === 'event'
                ? (item.title ?? item.reminder.calendar_events?.title)
                : item.reminder.title,
            body:
              item.reminder.body ||
              (item.reminder.kind === 'event'
                ? '일정 시간이 다가옵니다.'
                : '설정한 반복 알림입니다.'),
            url: '/app/calendar',
            tag: `reminder-${item.reminder.id}-${item.scheduledFor.toISOString()}`,
          }),
        );
        await service.from('notification_deliveries').update({ status: 'sent' }).eq('id', claim.id);
        await service
          .from('push_subscriptions')
          .update({ last_success_at: now.toISOString() })
          .eq('id', subscription.id);
        sent += 1;
      } catch (sendError) {
        const status = (sendError as { statusCode?: number }).statusCode;
        await service
          .from('notification_deliveries')
          .update({ status: 'failed', error_code: status ? `HTTP_${status}` : 'PUSH_FAILED' })
          .eq('id', claim.id);
        await service
          .from('push_subscriptions')
          .update({
            last_failure_at: now.toISOString(),
            active: ![404, 410].includes(status ?? 0),
          })
          .eq('id', subscription.id);
      }
    }
  }
  return Response.json({ due: due.length, sent });
});
