import type { SupabaseClient } from '@supabase/supabase-js';

export type RecurringReminder = {
  id: string;
  title: string;
  body: string;
  localTime: string;
  weekdays: number[];
  enabled: boolean;
};

type ReminderRow = {
  id: string;
  title: string;
  body: string;
  local_time: string;
  weekdays: number[];
  enabled: boolean;
};

const mapReminder = (row: ReminderRow): RecurringReminder => ({
  id: row.id,
  title: row.title,
  body: row.body,
  localTime: row.local_time.slice(0, 5),
  weekdays: row.weekdays,
  enabled: row.enabled,
});

export function createNotificationApi(client: SupabaseClient) {
  return {
    async listEventReminderMinutes() {
      const { data, error } = await client
        .from('calendar_reminders')
        .select('event_id, advance_minutes')
        .eq('kind', 'event');
      if (error) throw new Error('일정 알림 설정을 불러오지 못했습니다.');
      return Object.fromEntries(
        ((data ?? []) as { event_id: string; advance_minutes: number }[]).map((row) => [
          row.event_id,
          row.advance_minutes,
        ]),
      ) as Record<string, number>;
    },
    async listRecurring() {
      const { data, error } = await client
        .from('calendar_reminders')
        .select('id, title, body, local_time, weekdays, enabled')
        .eq('kind', 'recurring')
        .order('local_time');
      if (error) throw new Error('반복 알림을 불러오지 못했습니다.');
      return ((data ?? []) as ReminderRow[]).map(mapReminder);
    },
    async saveSubscription(userId: string, subscription: PushSubscription) {
      const value = subscription.toJSON();
      if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth)
        throw new Error('INVALID_SUBSCRIPTION');
      const { error } = await client.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: value.endpoint,
          p256dh: value.keys.p256dh,
          auth_key: value.keys.auth,
          user_agent: navigator.userAgent.slice(0, 500),
          active: true,
        },
        { onConflict: 'endpoint' },
      );
      if (error) throw new Error('알림 기기를 등록하지 못했습니다.');
    },
    async removeSubscription(endpoint: string) {
      const { error } = await client.from('push_subscriptions').delete().eq('endpoint', endpoint);
      if (error) throw new Error('알림 기기 등록을 해제하지 못했습니다.');
    },
    async createRecurring(input: {
      householdId: string;
      userId: string;
      title: string;
      body: string;
      localTime: string;
      weekdays: number[];
    }) {
      const { error } = await client.from('calendar_reminders').insert({
        household_id: input.householdId,
        owner_user_id: input.userId,
        kind: 'recurring',
        title: input.title.trim(),
        body: input.body.trim(),
        local_time: input.localTime,
        weekdays: input.weekdays,
        starts_on: new Date().toISOString().slice(0, 10),
        enabled: true,
      });
      if (error) throw new Error('반복 알림을 저장하지 못했습니다.');
    },
    async toggleReminder(id: string, enabled: boolean) {
      const { error } = await client.from('calendar_reminders').update({ enabled }).eq('id', id);
      if (error) throw new Error('알림 상태를 변경하지 못했습니다.');
    },
    async deleteReminder(id: string) {
      const { error } = await client.from('calendar_reminders').delete().eq('id', id);
      if (error) throw new Error('반복 알림을 삭제하지 못했습니다.');
    },
    async saveEventReminder(input: {
      eventId: string;
      householdId: string;
      userId: string;
      title: string;
      minutes: number | null;
    }) {
      const existing = await client
        .from('calendar_reminders')
        .select('id')
        .eq('kind', 'event')
        .eq('event_id', input.eventId)
        .eq('owner_user_id', input.userId)
        .maybeSingle();
      if (existing.error) throw new Error('일정 알림 설정을 확인하지 못했습니다.');
      if (input.minutes === null) {
        if (!existing.data) return;
        const { error } = await client
          .from('calendar_reminders')
          .delete()
          .eq('id', existing.data.id);
        if (error) throw new Error('일정 알림을 해제하지 못했습니다.');
        return;
      }
      const values = {
        household_id: input.householdId,
        owner_user_id: input.userId,
        kind: 'event',
        event_id: input.eventId,
        title: input.title.trim(),
        body: '',
        advance_minutes: input.minutes,
        local_time: null,
        weekdays: null,
        enabled: true,
      };
      const result = existing.data
        ? await client.from('calendar_reminders').update(values).eq('id', existing.data.id)
        : await client.from('calendar_reminders').insert(values);
      if (result.error) throw new Error('일정 알림을 저장하지 못했습니다.');
    },
  };
}
