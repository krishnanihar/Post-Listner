// src/lib/reflectionState.js
// Captures the listener's per-beat choices as the Attunement arc runs, so the
// end-of-Act-1 reflection can narrate what they actually did. We capture the
// BUCKETS at each beat's commit (warmth from lean, depth from listen, energy
// from rise, world from face) because `face` hard-snaps the AVD vector onto the
// faced centroid — so the final vector no longer reflects the earlier gestures.
// Reset at the start of each rite. Plain module store (no React).

const state = { warmth: null, depth: null, energy: null, world: null }

export function setWarmth(bucket) { state.warmth = bucket }   // 'warm' | 'cold'
export function setDepth(bucket) { state.depth = bucket }     // 'inward' | 'open'
export function setEnergy(bucket) { state.energy = bucket }   // 'low' | 'high-rode' | 'high-held'
export function setWorld(id) { state.world = id }             // archetype id

export function getReflection() {
  return { warmth: state.warmth, depth: state.depth, energy: state.energy, world: state.world }
}

export function resetReflection() {
  state.warmth = null
  state.depth = null
  state.energy = null
  state.world = null
}

// Bucketing helpers (pure) — keep the thresholds in one place + testable.
export function warmthBucket(v) { return v >= 0 ? 'warm' : 'cold' }
export function depthBucket(d) { return d >= 0 ? 'inward' : 'open' }
export function energyBucket(peakSwell) {
  // Three magnitude bands of how big the swell got. (The score's rodeClimax is
  // itself just peakSwell > 0.5, so it can't distinguish "high but held" from
  // "high and rode" — we bucket on the swell magnitude directly instead.)
  if (peakSwell < 0.35) return 'low'         // never really lifted
  if (peakSwell < 0.6) return 'high-held'    // a real lift, but held back
  return 'high-rode'                         // crested the peak
}
