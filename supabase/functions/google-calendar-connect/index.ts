import {
  activeHousehold,
  authenticatedUser,
  corsHeaders,
  json,
  randomState,
  requiredSecret,
  serviceClient,
  sha256,
} from '../_shared/google-calendar.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, 405, 'METHOD_NOT_ALLOWED');
  try {
    const user = await authenticatedUser(request);
    const service = serviceClient();
    const householdId = await activeHousehold(service, user.id);
    const state = randomState();
    const { error } = await service.from('google_oauth_states').insert({
      state_hash: await sha256(state),
      user_id: user.id,
      household_id: householdId,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) throw new Error('STATE_CREATE_FAILED');
    const params = new URLSearchParams({
      client_id: requiredSecret('GOOGLE_CLIENT_ID'),
      redirect_uri: requiredSecret('GOOGLE_CALENDAR_REDIRECT_URI'),
      response_type: 'code',
      scope: 'openid email https://www.googleapis.com/auth/calendar.events.owned',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return json(request, 200, 'OK', {
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CONNECT_FAILED';
    return json(
      request,
      code === 'AUTH_REQUIRED' ? 401 : code === 'ACTIVE_HOUSEHOLD_REQUIRED' ? 403 : 500,
      code,
    );
  }
});
