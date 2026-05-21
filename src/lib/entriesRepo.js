import { supabase } from './supabaseClient'
import { normalizeEntries, mockDateToIso } from './entryFormat'
import { MOCK_ENTRIES } from '../journal/mockEntries'

/**
 * entriesRepo — Supabase IO for journal entries.
 *
 * The pure shaping lives in entryFormat.js; this file is the thin data layer.
 * Every function is null-safe: with no Supabase client it degrades quietly so
 * the no-backend dev fallback never throws.
 */

/** Fetch one user's entries, newest-first, normalised for the journal. */
export async function fetchEntries(userId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('entries')
    .select('id, created_at, song, summary, glyph')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[entriesRepo] fetch failed:', error.message)
    return []
  }
  return normalizeEntries(data || [])
}

/**
 * Dev helper — populate a signed-in account with the 10 bundled mock entries
 * so the returning-journal flow is testable before the rite writes real
 * entries (slice 3). Exposed only via the FirstTimer dev affordance.
 */
export async function seedSampleEntries(userId) {
  if (!supabase) return
  const rows = MOCK_ENTRIES.map((e) => ({
    user_id: userId,
    created_at: mockDateToIso(e.date),
    summary: e.summary,
    song: null,
  }))
  const { error } = await supabase.from('entries').insert(rows)
  if (error) console.error('[entriesRepo] seed failed:', error.message)
}
