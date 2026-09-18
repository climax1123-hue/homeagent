import type { SupabaseClient } from '@supabase/supabase-js';

export type GoogleCalendarConnection = {
  email: string;
  status: 'active' | 'reauthorization_required' | 'error';
  autoSyncEnabled: boolean;
};

export type GoogleCalendarSyncState = {
  eventId: string;
  status: 'synced' | 'pending' | 'error';
  lastSyncedAt: string | null;
  lastError: string | null;
};

type ConnectionRow = {
  google_account_email: string;
  status: GoogleCalendarConnection['status'];
  auto_sync_enabled: boolean;
};

type SyncStateRow = {
  event_id: string;
  sync_status: GoogleCalendarSyncState['status'];
  last_synced_at: string | null;
  last_error: string | null;
};

function functionError(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(fallback);
}

export function createGoogleCalendarApi(client: SupabaseClient) {
  return {
    async getConnection(): Promise<GoogleCalendarConnection | null> {
      const { data, error } = await client
        .from('google_calendar_connections')
        .select('google_account_email, status, auto_sync_enabled')
        .maybeSingle();
      if (error) {
        if (error.message.includes('does not exist')) return null;
        throw new Error('Google Calendar 연결 상태를 확인하지 못했습니다.');
      }
      if (!data) return null;
      const row = data as ConnectionRow;
      return {
        email: row.google_account_email,
        status: row.status,
        autoSyncEnabled: row.auto_sync_enabled,
      };
    },
    async listSyncStates(eventIds: string[]): Promise<Record<string, GoogleCalendarSyncState>> {
      if (!eventIds.length) return {};
      const { data, error } = await client
        .from('calendar_google_event_links')
        .select('event_id, sync_status, last_synced_at, last_error')
        .in('event_id', eventIds);
      if (error) throw new Error('Google Calendar 동기화 상태를 확인하지 못했습니다.');
      return ((data ?? []) as SyncStateRow[]).reduce<Record<string, GoogleCalendarSyncState>>(
        (states, row) => {
          states[row.event_id] = {
            eventId: row.event_id,
            status: row.sync_status,
            lastSyncedAt: row.last_synced_at,
            lastError: row.last_error,
          };
          return states;
        },
        {},
      );
    },
    async setAutoSync(enabled: boolean) {
      const { error } = await client
        .from('google_calendar_connections')
        .update({ auto_sync_enabled: enabled })
        .eq('user_id', (await client.auth.getUser()).data.user?.id ?? '');
      if (error) throw new Error('자동 동기화 설정을 저장하지 못했습니다.');
    },
    async connect() {
      const { data, error } = await client.functions.invoke('google-calendar-connect');
      functionError(error, 'Google 연결을 시작하지 못했습니다.');
      if (typeof data?.authorizationUrl !== 'string') {
        throw new Error('Google OAuth 설정이 아직 완료되지 않았습니다.');
      }
      window.location.assign(data.authorizationUrl);
    },
    async syncEvent(eventId: string) {
      const { data, error } = await client.functions.invoke('google-calendar-sync', {
        body: { eventId, action: 'upsert' },
      });
      functionError(error, 'Google Calendar 동기화에 실패했습니다.');
      return (data?.googleEventUrl as string | null | undefined) ?? null;
    },
    async deleteEvent(eventId: string) {
      const { error } = await client.functions.invoke('google-calendar-sync', {
        body: { eventId, action: 'delete' },
      });
      functionError(error, 'Google Calendar 일정 삭제에 실패했습니다. 다시 시도해 주세요.');
    },
    async disconnect() {
      const { error } = await client.functions.invoke('google-calendar-disconnect');
      functionError(error, 'Google Calendar 연결을 해제하지 못했습니다.');
    },
  };
}
