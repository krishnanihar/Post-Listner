// Pure AVD math per the Ship-Blockers Spec §1. The continuous vector is
// (a, v, d) ∈ [-1, +1]³, updated per committed turn by an EWMA leaky
// integrator. Cold-start turns 1–3 use a faster learning rate; Depth moves
// slower than Arousal/Valence. Scene selection is nearest-centroid with a
// hysteresis gate so the back plane does not flicker between adjacent pools.
//
// No state and no DOM here — the subscribable store lives in avdStore.js and
// the per-frame visual easing in avdSpring.js.

export const ETA_COLD = 0.35        // learning rate, turns 1–3 (cold start)
export const ETA_STEADY = 0.18      // learning rate, steady state
export const DEPTH_ETA_SCALE = 0.6  // Depth axis updates at 0.6× A/V rate
export const COLD_START_TURNS = 3   // first N turns use ETA_COLD
export const HYSTERESIS_GATE = 0.12 // min Euclidean margin to switch scenes

export function etaForTurn(turnIndex) {
  return turnIndex < COLD_START_TURNS ? ETA_COLD : ETA_STEADY
}

export function clampUnitSigned(x) {
  return Math.max(-1, Math.min(1, x))
}

// One EWMA step toward `target`. `turnIndex` is the zero-based index of the
// turn being committed (0,1,2 are cold start). `factor` scales the step
// (default 1) — used to fold in answer-confidence and seed-gain so low-stakes
// turns observe more than they steer. Returns a fresh vector.
export function ewmaStep(current, target, turnIndex, factor = 1) {
  const f = Math.max(0, factor)
  const eta = etaForTurn(turnIndex) * f
  const etaD = eta * DEPTH_ETA_SCALE
  return {
    a: clampUnitSigned(current.a + eta * (target.a - current.a)),
    v: clampUnitSigned(current.v + eta * (target.v - current.v)),
    d: clampUnitSigned(current.d + etaD * (target.d - current.d)),
  }
}

function distTo(vector, anchor) {
  return Math.hypot(
    vector.a - anchor[0],
    vector.v - anchor[1],
    vector.d - anchor[2],
  )
}

// Nearest-centroid scene selection with a hysteresis gate. `scenes` is an
// array of { id, anchor: [a, v, d] }. Switches away from `currentSceneId`
// only when the current scene is farther from the vector than the best scene
// by MORE than HYSTERESIS_GATE (Euclidean distance). With no current scene,
// picks the plain nearest. Empty deck → returns currentSceneId unchanged.
export function selectScene(vector, scenes, currentSceneId = null) {
  if (!scenes || scenes.length === 0) return currentSceneId

  let best = null
  let bestD = Infinity
  for (const s of scenes) {
    const d = distTo(vector, s.anchor)
    if (d < bestD) { bestD = d; best = s }
  }
  if (!best) return currentSceneId
  if (currentSceneId == null) return best.id
  if (best.id === currentSceneId) return currentSceneId

  const current = scenes.find((s) => s.id === currentSceneId)
  if (!current) return best.id
  const currentD = distTo(vector, current.anchor)
  return currentD - bestD > HYSTERESIS_GATE + 1e-9 ? best.id : currentSceneId
}
