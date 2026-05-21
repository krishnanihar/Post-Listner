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
    .select('id, created_at, song, summary, glyph, region')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[entriesRepo] fetch failed:', error.message)
    return []
  }
  return normalizeEntries(data || [])
}

/**
 * Write one journal entry for a user. Called by useRiteSession when the phone
 * relays its entry at settle. Returns the inserted row, or null on failure /
 * no client (the no-backend dev fallback). RLS ("insert own entries") plus
 * the explicit user_id ensures a user only ever writes their own rows.
 */
export async function createEntry(userId, { song, summary, glyph, region }) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('entries')
    .insert({ user_id: userId, song, summary, glyph, region })
    .select()
    .single()
  if (error) {
    console.error('[entriesRepo] create failed:', error.message)
    return null
  }
  return data
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
    region: e.region ?? null,
  }))
  const { error } = await supabase.from('entries').insert(rows)
  if (error) console.error('[entriesRepo] seed failed:', error.message)
}
