export type PublicEnv = { supabaseUrl: string; supabaseKey: string; appUrl: string };

export function readPublicEnv(): PublicEnv | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
  )?.trim();
  if (!supabaseUrl || !supabaseKey) return null;
  const appUrl = import.meta.env.VITE_APP_URL?.trim() || window.location.origin;
  try {
    const parsedSupabaseUrl = new URL(supabaseUrl);
    const parsedAppUrl = new URL(appUrl);
    if (
      !['http:', 'https:'].includes(parsedSupabaseUrl.protocol) ||
      !['http:', 'https:'].includes(parsedAppUrl.protocol)
    )
      return null;
  } catch {
    return null;
  }
  return {
    supabaseUrl,
    supabaseKey,
    appUrl,
  };
}
