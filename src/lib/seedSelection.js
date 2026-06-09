// src/lib/seedSelection.js
// Client-side seed selection for the Admirer (Option B). Chooses the next
// authored seed by session #, year-tier, and which AVD axis is least resolved.
// Pure — the host (Admirer.jsx) supplies the live vector + asked-ids.

import { SEEDS as DEFAULT_DECK, LOCATE_BUDGET } from './questionSeeds.js'

function isEligible(seed, { sessionCount, yearTier }) {
  if (seed.kind === 'closing') return false
  if (seed.tier === 3 && yearTier < 3) return false
  if (seed.sessionScope === 'first' && sessionCount !== 0) return false
  return true
}

const isConversational = (s) => s.kind === 'locate' || s.kind === 'selection'

export function selectNextSeed({
  vector = { a: 0, v: 0, d: 0 },
  askedIds = [],
  sessionCount = 0,
  yearTier = 1,
  deck = DEFAULT_DECK,
} = {}) {
  const asked = new Set(askedIds)
  const eligible = deck.filter((s) => !asked.has(s.id) && isEligible(s, { sessionCount, yearTier }))

  // First session: biography seeds first, in deck order.
  const bio = eligible.find((s) => s.kind === 'biography')
  if (bio) return bio

  // Per-session budget on conversational seeds. NOTE: the arrival opener
  // counts toward this, so a session asks the opener + (LOCATE_BUDGET - 1)
  // further questions. Bump LOCATE_BUDGET if you want all three axes probed
  // in addition to the opener.
  const askedCount = deck.filter((s) => asked.has(s.id) && isConversational(s)).length
  if (askedCount >= LOCATE_BUDGET) return null

  const pool = eligible.filter(isConversational)
  if (pool.length === 0) return null

  // The opener is the non-probing LOCATE seed (e.g. "what's around you").
  // Keyed on kind too, so a null-probe SELECTION seed (e.g. the color tap) is
  // never mistaken for the opener. Asked before the axis-probing seeds.
  const opener = pool.find((s) => s.kind === 'locate' && s.probes == null)
  if (opener) return opener

  // Otherwise: least-resolved probed axis first; non-probing seeds score 1
  // (treated as "resolved") so probes win ties; deck order breaks exact ties.
  const axisVal = { A: Math.abs(vector.a), V: Math.abs(vector.v), D: Math.abs(vector.d) }
  const score = (s) => (s.probes && axisVal[s.probes] != null ? axisVal[s.probes] : 1)
  return [...pool].sort((x, y) => {
    const dx = score(x)
    const dy = score(y)
    if (dx !== dy) return dx - dy
    return deck.indexOf(x) - deck.indexOf(y)
  })[0]
}
