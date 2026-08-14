import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only Supabase client for the ERP database (uip-execs).
//
// This uses the service role key, which bypasses RLS. It must never be imported
// into a client component — the mirror tables grant SELECT to `authenticated`
// and nothing else, so writes are expected to come from here alone.

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
