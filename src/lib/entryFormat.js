import { MOCK_ENTRIES } from '../journal/mockEntries'

/**
 * entryFormat — pure helpers that translate between stored entry rows and
 * the shape the journal renders.
 *
 * A stored row has an ISO `created_at`; the journal wants a display `date`
 * ('may 21 · evening') and a chronological `seq` (oldest = 1) for the roman
 * numeral, glyph seed and wash seed. All date maths is UTC so it is
 * timezone-independent — `mockDateToIso` and `formatEntryDate` round-trip.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// representative hour for each part of day — the inverse of timeOfDay()
const PART_HOUR = { morning: 8, afternoon: 14, evening: 19, night: 22 }

/** Bucket an hour (0–23) into a part of the day. */
export function timeOfDay(hour) {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

/** 'may 21 · evening' -> ISO timestamp (UTC, year 2026). */
export function mockDateToIso(dateStr) {
  const [mon, dayStr, , part] = dateStr.trim().split(/\s+/)
  const month = MONTHS.indexOf(mon.toLowerCase())
  const day = parseInt(dayStr, 10)
  const hour = PART_HOUR[part] ?? 12
  return new Date(Date.UTC(2026, month, day, hour, 0, 0)).toISOString()
}

/** ISO timestamp -> 'may 21 · evening' display string. */
export function formatEntryDate(iso) {
  const d = new Date(iso)
  const mon = MONTHS[d.getUTCMonth()]
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${mon} ${day} · ${timeOfDay(d.getUTCHours())}`
}

/**
 * Supabase rows (already newest-first) -> journal entries.
 * `seq` is the chronological position — 1 is the oldest, n the newest.
 */
export function normalizeEntries(rows) {
  const n = rows.length
  return rows.map((r, i) => ({
    id: String(r.id),
    seq: n - i,
    date: formatEntryDate(r.created_at),
    summary: r.summary,
    song: r.song ?? null,
    glyph: r.glyph ?? null,
  }))
}

/** The bundled mock entries, normalised — the no-backend dev fallback. */
export function loadMockEntries() {
  return normalizeEntries(
    MOCK_ENTRIES.map((e) => ({
      id: e.id,
      created_at: mockDateToIso(e.date),
      summary: e.summary,
      song: null,
      glyph: null,
    })),
  )
}
