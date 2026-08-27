import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendInvitationEmail } from '../_shared/email-provider.ts';

type InvitationRequest = {
  householdId?: unknown;
  email?: unknown;
};

type CreatedInvitation = {
  invitation_id: string;
  raw_token: string;
  normalized_email: string;
  expires_at: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing server secret: ${name}`);
  }

  return value;
}

function allowedOrigin(request: Request): string {
  const requestOrigin = request.headers.get('origin') ?? '';
  const appUrl = requiredSecret('APP_URL');
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? appUrl)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins.includes(requestOrigin) ? requestOrigin : appUrl;
}

function responseHeaders(request: Request): HeadersInit {
  return {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': allowedOrigin(request),
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

function json(request: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request),
  });
}

function invitationUrl(rawToken: string): string {
  const url = new URL('/invite', requiredSecret('APP_URL'));
  url.hash = new URLSearchParams({ token: rawToken }).toString();
  return url.toString();
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(request) });
  }

  if (request.method !== 'POST') {
    return json(request, 405, { code: 'METHOD_NOT_ALLOWED' });
  }

  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return json(request, 401, { code: 'AUTH_REQUIRED' });
  }

  try {
    const supabaseUrl = requiredSecret('SUPABASE_URL');
    const publishableKey =
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim() || requiredSecret('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredSecret('SUPABASE_SERVICE_ROLE_KEY');

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json(request, 401, { code: 'AUTH_REQUIRED' });
    }

    const payload = (await request.json().catch(() => null)) as InvitationRequest | null;
    const householdId = typeof payload?.householdId === 'string' ? payload.householdId.trim() : '';
    const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';

    if (
      !UUID_PATTERN.test(householdId) ||
      email.length < 3 ||
      email.length > 320 ||
      !EMAIL_PATTERN.test(email)
    ) {
      return json(request, 400, { code: 'INVALID_INPUT' });
    }

    const { data, error: createError } = await adminClient.rpc('create_household_invitation', {
      p_actor_user_id: user.id,
      p_household_id: householdId,
      p_email: email,
    });

    if (createError || !Array.isArray(data) || data.length !== 1) {
      const code =
        createError?.message.match(
          /(ADMIN_REQUIRED|MEMBER_ALREADY_EXISTS|REMOVED_MEMBER_REJOIN_BLOCKED|INVITATION_ALREADY_PENDING)/,
        )?.[1] ?? 'INVITATION_CREATE_FAILED';
      const status =
        code === 'ADMIN_REQUIRED' ? 403 : code === 'INVITATION_CREATE_FAILED' ? 500 : 409;

      return json(request, status, { code });
    }

    const created = data[0] as CreatedInvitation;

    try {
      await sendInvitationEmail({
        to: created.normalized_email,
        invitationUrl: invitationUrl(created.raw_token),
      });

      await adminClient.rpc('mark_invitation_delivery', {
        p_invitation_id: created.invitation_id,
        p_succeeded: true,
      });
    } catch {
      await adminClient.rpc('mark_invitation_delivery', {
        p_invitation_id: created.invitation_id,
        p_succeeded: false,
      });
      await userClient.rpc('cancel_household_invitation', {
        p_invitation_id: created.invitation_id,
      });

      return json(request, 502, {
        code: 'INVITATION_DELIVERY_FAILED',
        retryable: true,
      });
    }

    return json(request, 202, {
      invitationId: created.invitation_id,
      deliveryStatus: 'sent',
      expiresAt: created.expires_at,
    });
  } catch {
    return json(request, 500, { code: 'INTERNAL_ERROR' });
  }
}

Deno.serve(async (request: Request) => {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  const response = await handle(request);
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);
  console.log(
    JSON.stringify({
      requestId,
      method: request.method,
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
    }),
  );
  return new Response(response.body, { status: response.status, headers });
});
