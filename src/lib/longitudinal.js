// Pure longitudinal derivations over the session archive (SessionRecord[]).
// The anti-dark-pattern frame (Longitudinal spec C3): the only count shown is
// "days of practice" — additive, cumulative, it cannot break, only grow. No
// streaks. Milestones drive the Bilderatlas triggers (C4). Slice 5.

export const MILESTONES = [30, 100, 365, 1000]

// Editable copy data (the spec's glosses; Knih's to revise).
export const MILESTONE_MEANING = {
  30: 'one month of practice',
  100: 'a body of work',
  365: 'one year',
  1000: 'a thousand',
}

// Distinct LOCAL calendar days with at least one session — additive, never a
// streak. Cannot break, only grow.
export function daysOfPractice(records) {
  const days = new Set()
  for (const r of records || []) {
    // Skip records with no real timestamp (legacy entries migrated with
    // startedAt:0): they'd otherwise all collapse into one epoch-day bucket and
    // fabricate/undercount a "day of practice" for data with no known date.
    if (!(r.startedAt > 0)) continue
    const d = new Date(r.startedAt)
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  }
  return days.size
}

export function isMilestone(count) {
  return MILESTONES.includes(count)
}

// At a session's close (count = records.length, INCLUDING the just-finished
// session), returns the milestone the NEXT session would hit, else null — the
// "announced at the prior session's close" trigger (C4.3).
export function nextMilestone(count) {
  return MILESTONES.includes(count + 1) ? count + 1 : null
}

// The practitioner-initiated buried Bilderatlas entry unlocks at session 30.
export function bilderatlasUnlocked(count) {
  return count >= 30
}

const YEAR_MS = 365 * 86400000

// The integer year(s) since the first session when `now` falls within
// ±windowDays of the yearly anniversary of records[0].startedAt (the C4.3
// "week surrounding the date" calendar trigger). Returns the year or null.
export function anniversaryYear(records, now, windowDays = 3) {
  if (!records || records.length === 0) return null
  const first = records[0].startedAt || 0
  const elapsed = now - first
  if (elapsed < YEAR_MS - windowDays * 86400000) return null
  const years = Math.round(elapsed / YEAR_MS)
  if (years < 1) return null
  const anniversaryTs = first + years * YEAR_MS
  return Math.abs(now - anniversaryTs) <= windowDays * 86400000 ? years : null
}
