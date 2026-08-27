import {
  authenticatedUser,
  corsHeaders,
  decryptToken,
  json,
  serviceClient,
} from '../_shared/google-calendar.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, 405, 'METHOD_NOT_ALLOWED');
  try {
    const user = await authenticatedUser(request);
    const service = serviceClient();
    const { data: connection } = await service
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (connection) {
      try {
        const token = await decryptToken(
          connection.refresh_token_ciphertext,
          connection.refresh_token_iv,
        );
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        /* Local disconnect must remain available when Google is unavailable. */
      }
      await service.from('google_calendar_connections').delete().eq('user_id', user.id);
    }
    return json(request, 200, 'DISCONNECTED');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DISCONNECT_FAILED';
    return json(request, code === 'AUTH_REQUIRED' ? 401 : 500, code);
  }
});
