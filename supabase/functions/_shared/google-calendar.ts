import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export const requiredSecret = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
};

export function corsHeaders(request: Request): HeadersInit {
  const appUrl = requiredSecret('APP_URL');
  const origin = request.headers.get('origin') ?? '';
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? appUrl).split(',').map((v) => v.trim());
  return {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : appUrl,
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

export const json = (request: Request, status: number, code: string, extra = {}) =>
  new Response(JSON.stringify({ code, ...extra }), { status, headers: corsHeaders(request) });

export function serviceClient() {
  return createClient(requiredSecret('SUPABASE_URL'), requiredSecret('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

export async function authenticatedUser(request: Request): Promise<User> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED');
  const client = createClient(requiredSecret('SUPABASE_URL'), requiredSecret('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error('AUTH_REQUIRED');
  return user;
}

export async function activeHousehold(service: SupabaseClient, userId: string) {
  const { data, error } = await service
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !data?.household_id) throw new Error('ACTIVE_HOUSEHOLD_REQUIRED');
  return data.household_id as string;
}

const bytesToBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const base64UrlToBytes = (value: string) => {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
};

export function randomState() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function encryptionKey() {
  const raw = base64UrlToBytes(requiredSecret('GOOGLE_TOKEN_ENCRYPTION_KEY'));
  if (raw.byteLength !== 32) throw new Error('INVALID_ENCRYPTION_KEY');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(),
    new TextEncoder().encode(token),
  );
  return { ciphertext: bytesToBase64Url(new Uint8Array(encrypted)), iv: bytesToBase64Url(iv) };
}

export async function decryptToken(ciphertext: string, iv: string) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(iv) },
    await encryptionKey(),
    base64UrlToBytes(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requiredSecret('GOOGLE_CLIENT_ID'),
      client_secret: requiredSecret('GOOGLE_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok)
    throw new Error(response.status === 400 ? 'GOOGLE_REAUTH_REQUIRED' : 'GOOGLE_UNAVAILABLE');
  const body = await response.json();
  if (!body.access_token) throw new Error('GOOGLE_UNAVAILABLE');
  return body.access_token as string;
}

type CalendarRow = {
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  timezone: string;
  recurrence_frequency: string | null;
  recurrence_interval: number;
  recurrence_until: string | null;
  recurrence_count: number | null;
};

const dateInSeoul = (value: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));

export function toGoogleEvent(row: CalendarRow) {
  const resource: Record<string, unknown> = {
    summary: row.title,
    description: row.description || undefined,
    location: row.location || undefined,
    visibility: 'private',
    start: row.all_day
      ? { date: dateInSeoul(row.starts_at) }
      : { dateTime: row.starts_at, timeZone: row.timezone },
    end: row.all_day
      ? { date: dateInSeoul(row.ends_at) }
      : { dateTime: row.ends_at, timeZone: row.timezone },
  };
  if (row.recurrence_frequency) {
    const parts = [
      `FREQ=${row.recurrence_frequency.toUpperCase()}`,
      `INTERVAL=${row.recurrence_interval}`,
    ];
    if (row.recurrence_count) parts.push(`COUNT=${row.recurrence_count}`);
    if (row.recurrence_until) parts.push(`UNTIL=${row.recurrence_until.replace(/-/g, '')}T145959Z`);
    resource.recurrence = [`RRULE:${parts.join(';')}`];
  }
  return resource;
}
