// GEMS-9 + Cowen-13 union: 6 emotion tiles for the Gems probe.
// Each tile carries a small AVD nudge derived from the discrete emotion's
// canonical position in valence/arousal space. Nudges are intentionally small
// (~0.05 per tile) so AVD doesn't get hijacked by GEMS — Phase 1's archetype
// selection still dominates.

export const GEMS_TAGS = [
  // Sublimity cluster (Zentner 2008): wonder, transcendence, nostalgia, peacefulness.
  { id: 'awed',        label: 'awed',        avdNudge: { a:  0.04, v:  0.05, d:  0.06 } },
  { id: 'peaceful',    label: 'peaceful',    avdNudge: { a: -0.06, v:  0.04, d:  0.02 } },
  { id: 'tender',      label: 'tender',      avdNudge: { a: -0.04, v:  0.05, d:  0.03 } },
  { id: 'nostalgic',   label: 'nostalgic',   avdNudge: { a: -0.02, v:  0.02, d:  0.05 } },
  // Unease cluster: tension, sadness, defiance.
  { id: 'melancholic', label: 'melancholic', avdNudge: { a: -0.05, v: -0.06, d:  0.04 } },
  { id: 'defiant',     label: 'defiant',     avdNudge: { a:  0.07, v: -0.04, d:  0.02 } },
]

const TAG_BY_ID = Object.fromEntries(GEMS_TAGS.map(t => [t.id, t]))

const NUDGE_CAP = 0.3

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function gemsExcerptsToAvdNudge(excerpts) {
  let a = 0, v = 0, d = 0
  for (const ex of excerpts || []) {
    for (const tileId of ex.tilesSelected || []) {
      const tag = TAG_BY_ID[tileId]
      if (!tag) continue
      a += tag.avdNudge.a
      v += tag.avdNudge.v
      d += tag.avdNudge.d
    }
  }
  return {
    a: clamp(a, -NUDGE_CAP, NUDGE_CAP),
    v: clamp(v, -NUDGE_CAP, NUDGE_CAP),
    d: clamp(d, -NUDGE_CAP, NUDGE_CAP),
  }
}

export function dominantGemsTag(excerpts) {
  const counts = {}
  for (const ex of excerpts || []) {
    for (const tileId of ex.tilesSelected || []) {
      if (!TAG_BY_ID[tileId]) continue
      counts[tileId] = (counts[tileId] || 0) + 1
    }
  }
  let topId = null, topCount = 0
  for (const [id, c] of Object.entries(counts)) {
    if (c > topCount) { topCount = c; topId = id }
  }
  return topId
}
