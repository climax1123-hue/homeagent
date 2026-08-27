import type { SupabaseClient } from '@supabase/supabase-js';

export type GoogleCalendarConnection = {
  email: string;
  status: 'active' | 'reauthorization_required' | 'error';
};

type ConnectionRow = {
  google_account_email: string;
  status: GoogleCalendarConnection['status'];
};

function functionError(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(fallback);
}

export function createGoogleCalendarApi(client: SupabaseClient) {
  return {
    async getConnection(): Promise<GoogleCalendarConnection | null> {
      const { data, error } = await client
        .from('google_calendar_connections')
        .select('google_account_email, status')
        .maybeSingle();
      if (error) {
        if (error.message.includes('does not exist')) return null;
        throw new Error('Google Calendar 연결 상태를 확인하지 못했습니다.');
      }
      if (!data) return null;
      const row = data as ConnectionRow;
      return { email: row.google_account_email, status: row.status };
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
        body: { eventId },
      });
      functionError(error, 'Google Calendar 동기화에 실패했습니다.');
      return (data?.googleEventUrl as string | null | undefined) ?? null;
    },
    async disconnect() {
      const { error } = await client.functions.invoke('google-calendar-disconnect');
      functionError(error, 'Google Calendar 연결을 해제하지 못했습니다.');
    },
  };
}
