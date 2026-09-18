import {
  authenticatedUser,
  corsHeaders,
  decryptToken,
  json,
  refreshGoogleAccessToken,
  serviceClient,
  toGoogleEvent,
} from '../_shared/google-calendar.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, 405, 'METHOD_NOT_ALLOWED');
  try {
    const user = await authenticatedUser(request);
    const { eventId, action = 'upsert' } = await request.json();
    if (typeof eventId !== 'string') return json(request, 400, 'INVALID_INPUT');
    if (action !== 'upsert' && action !== 'delete') return json(request, 400, 'INVALID_ACTION');
    const service = serviceClient();
    const [{ data: connection }, { data: event }] = await Promise.all([
      service
        .from('google_calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
      service
        .from('calendar_events')
        .select(
          'id, owner_user_id, title, description, location, starts_at, ends_at, all_day, timezone, recurrence_frequency, recurrence_interval, recurrence_until, recurrence_count',
        )
        .eq('id', eventId)
        .maybeSingle(),
    ]);
    if (!event || event.owner_user_id !== user.id) return json(request, 403, 'EVENT_NOT_OWNED');
    const { data: link } = await service
      .from('calendar_google_event_links')
      .select('id, google_event_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!connection) {
      if (action === 'delete' && !link) return json(request, 200, 'NOT_LINKED');
      return json(request, 409, 'GOOGLE_NOT_CONNECTED');
    }
    if (action === 'delete' && !link?.google_event_id) {
      if (link) await service.from('calendar_google_event_links').delete().eq('id', link.id);
      return json(request, 200, 'NOT_LINKED');
    }
    const calendarId = encodeURIComponent(connection.google_calendar_id);
    if (action === 'upsert') {
      await service.from('calendar_google_event_links').upsert(
        {
          event_id: eventId,
          user_id: user.id,
          google_calendar_id: connection.google_calendar_id,
          google_event_id: link?.google_event_id ?? null,
          sync_status: 'pending',
          last_error: null,
        },
        { onConflict: 'event_id,user_id' },
      );
    } else if (link) {
      await service
        .from('calendar_google_event_links')
        .update({ sync_status: 'pending', last_error: null })
        .eq('id', link.id);
    }
    let accessToken: string;
    try {
      accessToken = await refreshGoogleAccessToken(
        await decryptToken(connection.refresh_token_ciphertext, connection.refresh_token_iv),
      );
    } catch (error) {
      await service
        .from('calendar_google_event_links')
        .update({
          sync_status: 'error',
          last_error: error instanceof Error ? error.message : 'GOOGLE_TOKEN_FAILED',
        })
        .eq('event_id', eventId)
        .eq('user_id', user.id);
      if (error instanceof Error && error.message === 'GOOGLE_REAUTH_REQUIRED') {
        await service
          .from('google_calendar_connections')
          .update({ status: 'reauthorization_required' })
          .eq('user_id', user.id);
      }
      throw error;
    }
    if (action === 'delete') {
      const deleteResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(link.google_event_id)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        await service
          .from('calendar_google_event_links')
          .update({
            sync_status: 'error',
            last_error: `GOOGLE_DELETE_${deleteResponse.status}`,
          })
          .eq('id', link.id);
        return json(request, 502, 'GOOGLE_DELETE_FAILED');
      }
      await service.from('calendar_google_event_links').delete().eq('id', link.id);
      return json(request, 200, 'DELETED');
    }
    const endpoint = link?.google_event_id
      ? `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(link.google_event_id)}`
      : `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
    const googleResponse = await fetch(endpoint, {
      method: link?.google_event_id ? 'PUT' : 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(toGoogleEvent(event)),
    });
    const googleEvent = await googleResponse.json();
    if (!googleResponse.ok || !googleEvent.id) {
      if (googleResponse.status === 401)
        await service
          .from('google_calendar_connections')
          .update({ status: 'reauthorization_required' })
          .eq('user_id', user.id);
      await service
        .from('calendar_google_event_links')
        .update({ sync_status: 'error', last_error: `GOOGLE_SYNC_${googleResponse.status}` })
        .eq('event_id', eventId)
        .eq('user_id', user.id);
      return json(request, 502, 'GOOGLE_SYNC_FAILED');
    }
    await service.from('calendar_google_event_links').upsert(
      {
        event_id: eventId,
        user_id: user.id,
        google_calendar_id: connection.google_calendar_id,
        google_event_id: googleEvent.id,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: 'event_id,user_id' },
    );
    return json(request, 200, 'SYNCED', { googleEventUrl: googleEvent.htmlLink ?? null });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'SYNC_FAILED';
    return json(
      request,
      code === 'AUTH_REQUIRED' ? 401 : code === 'GOOGLE_REAUTH_REQUIRED' ? 409 : 500,
      code,
    );
  }
});
