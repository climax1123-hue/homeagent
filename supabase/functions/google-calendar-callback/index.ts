import { encryptToken, requiredSecret, serviceClient, sha256 } from '../_shared/google-calendar.ts';

const redirect = (path: string) =>
  Response.redirect(new URL(path, requiredSecret('APP_URL')).toString(), 302);

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || url.searchParams.get('error'))
    return redirect('/app/calendar?google=denied');
  try {
    const service = serviceClient();
    const { data: oauthState, error: stateError } = await service
      .from('google_oauth_states')
      .update({ consumed_at: new Date().toISOString() })
      .eq('state_hash', await sha256(state))
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('user_id, household_id')
      .single();
    if (stateError || !oauthState) return redirect('/app/calendar?google=invalid_state');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: requiredSecret('GOOGLE_CLIENT_ID'),
        client_secret: requiredSecret('GOOGLE_CLIENT_SECRET'),
        redirect_uri: requiredSecret('GOOGLE_CALENDAR_REDIRECT_URI'),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) return redirect('/app/calendar?google=token_error');
    const token = await tokenResponse.json();
    if (!token.refresh_token || !token.access_token)
      return redirect('/app/calendar?google=refresh_token_missing');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) return redirect('/app/calendar?google=profile_error');
    const profile = await profileResponse.json();
    const encrypted = await encryptToken(token.refresh_token);
    const { error } = await service.from('google_calendar_connections').upsert({
      user_id: oauthState.user_id,
      household_id: oauthState.household_id,
      google_account_email: profile.email,
      google_calendar_id: 'primary',
      refresh_token_ciphertext: encrypted.ciphertext,
      refresh_token_iv: encrypted.iv,
      scope: token.scope ?? 'https://www.googleapis.com/auth/calendar.events.owned',
      status: 'active',
      connected_at: new Date().toISOString(),
    });
    return redirect(error ? '/app/calendar?google=save_error' : '/app/calendar?google=connected');
  } catch {
    return redirect('/app/calendar?google=callback_error');
  }
});
