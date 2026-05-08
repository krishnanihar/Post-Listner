// Bias archetype scores when the user reported the Moment build-and-drop
// did NOT feel good (hedonic === false). Lean toward low-valence archetypes
// — the user accepted high arousal but didn't enjoy it; that points to
// tension-tolerant tastes (Quiet Insurgent) or low-arousal patience
// (Slow Glow), not the triumphant Sky-Seeker.

const HEDONIC_FALSE_MULTIPLIERS = {
  'quiet-insurgent': 2.0,
  'slow-glow':       1.6,
  'sky-seeker':      0.06,
  'hearth-keeper':   0.85,
  // late-night-architect and velvet-mystic stay at 1.0
}

export function applyHedonicBias(scores, hedonic) {
  if (hedonic !== false) return scores
  const biased = {}
  let sum = 0
  for (const [id, score] of Object.entries(scores)) {
    const m = HEDONIC_FALSE_MULTIPLIERS[id] ?? 1.0
    const v = score * m
    biased[id] = v
    sum += v
  }
  // Renormalize so the result is still a valid distribution.
  const result = {}
  for (const [id, v] of Object.entries(biased)) {
    result[id] = sum > 0 ? v / sum : 0
  }
  return result
}
