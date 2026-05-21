import { createClient } from '@supabase/supabase-js'

/**
 * supabaseClient — the project's single Supabase client.
 *
 * Holds accounts (Supabase Auth, Google OAuth) and journal entries. The URL
 * and anon key are public-by-design (the anon key is safe in the browser —
 * Row-Level Security is what protects the data; see supabase/schema.sql).
 *
 * If the env vars are absent the export is `null` — the desktop then falls
 * back to a no-auth dev journal on mock data, so the route never hard-fails
 * before Supabase is configured. See docs/supabase-setup.md.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
