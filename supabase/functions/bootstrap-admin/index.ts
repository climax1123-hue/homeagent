import { createClient } from 'npm:@supabase/supabase-js@2';

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
}

function responseHeaders(request: Request): HeadersInit {
  const requestOrigin = request.headers.get('origin') ?? '';
  const appUrl = requiredSecret('APP_URL');
  const origins = (Deno.env.get('ALLOWED_ORIGINS') ?? appUrl)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': origins.includes(requestOrigin) ? requestOrigin : appUrl,
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

const reply = (
  request: Request,
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
) =>
  new Response(JSON.stringify({ code, ...extra }), { status, headers: responseHeaders(request) });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(request) });
  }
  if (request.method !== 'POST') return reply(request, 405, 'METHOD_NOT_ALLOWED');

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(request, 401, 'AUTH_REQUIRED');

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const allowedEmail = Deno.env.get('INITIAL_ADMIN_EMAIL')?.trim().toLowerCase();
  if (!url || !anonKey || !serviceKey || !allowedEmail)
    return reply(request, 500, 'BOOTSTRAP_FAILED');

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user) return reply(request, 401, 'AUTH_REQUIRED');
  if (!user.email_confirmed_at || user.email?.trim().toLowerCase() !== allowedEmail) {
    return reply(request, 403, 'BOOTSTRAP_NOT_ALLOWED');
  }

  let body: { householdName?: string; displayName?: string };
  try {
    body = await request.json();
  } catch {
    return reply(request, 400, 'INVALID_INPUT');
  }
  const householdName = body.householdName?.trim() ?? '';
  const displayName = body.displayName?.trim() ?? '';
  if (!householdName || householdName.length > 80 || !displayName || displayName.length > 50) {
    return reply(request, 400, 'INVALID_INPUT');
  }

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await service.rpc('bootstrap_initial_household', {
    p_user_id: user.id,
    p_household_name: householdName,
    p_display_name: displayName,
  });
  if (error?.message.includes('ALREADY_INITIALIZED'))
    return reply(request, 409, 'ALREADY_INITIALIZED');
  if (error || typeof data !== 'string') return reply(request, 500, 'BOOTSTRAP_FAILED');
  return reply(request, 201, 'CREATED', { householdId: data });
});
