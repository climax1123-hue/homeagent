import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PublicEnv } from '../../config/public-env';

let singleton: SupabaseClient | null = null;
export function getSupabaseClient(env: PublicEnv): SupabaseClient {
  singleton ??= createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return singleton;
}
