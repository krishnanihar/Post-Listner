// Nocturne — the conducting bridge. The zero-alloc channel from Act II's SACRED
// conducting rAF loop to the WorldStage light. The conducting loop must not do
// per-frame allocation or take on WorldStage's work (Invariant 2 + 7): it calls
// pushConducting(gesture) ONCE per frame, which MUTATES a single module-level
// object in place (no allocation, cannot meaningfully throw), and WorldStage —
// on its OWN loop — reads getConducting() and translates the numbers to light.
//
// This keeps all the scene compositing + strike enqueueing on WorldStage's side.
// The conducting loop only writes primitives here. When the flag is off nothing
// calls these, and WorldStage isn't mounted, so it's inert.
//
//   pan        roll → light-pool azimuth
//   filterNorm pitch → light color temperature (warmth)
//   glow       gesture size → pool glow amplitude
//   yaw        facing → a faint beam toward the boosted quadrant
//   breadth    the bloom envelope → hall opening (light widens with reverb)
//   falter     the diegetic falter reduction → the room "leans away" (dims/cools)
//   downbeatSeq monotonic counter; WorldStage strikes on each increment
//
// Canon: docs/superpowers/specs/2026-07-06-nocturne-design-canon.md §7.

const state = {
  active: false,
  pan: 0.5,
  filterNorm: 0.5,
  glow: 0,
  yaw: 0,
  breadth: 0,
  falter: 0,
  downbeatSeq: 0,
  downbeatIntensity: 0,
  articulation: 0,
}

// Called ONCE per frame from the conducting loop with the live gesture. Mutates
// in place — zero allocation. Finite-guards so a bad field can't poison the
// light (WorldStage clamps again, but keep the channel clean).
export function pushConducting(gesture) {
  if (!gesture) return
  state.pan = fin(gesture.pan, 0.5)
  state.filterNorm = fin(gesture.filterNorm, 0.5)
  state.glow = fin(gesture.gestureGain, 0)
  state.yaw = fin(gesture.yaw, 0)
  state.articulation = fin(gesture.articulation, 0)
  if (gesture.downbeat && gesture.downbeat.fired) {
    state.downbeatSeq += 1
    state.downbeatIntensity = fin(gesture.downbeat.intensity, 0.5)
  }
}

// The bloom envelope (0 = intimate pool, 1 = hall open). Written each frame from
// the bloom fade; a plain field write, zero alloc.
export function setBloom(breadth) {
  state.breadth = clamp01(breadth)
}

// The diegetic falter reduction (0 = calm, up to ~0.15). The room leans away.
export function setFalter(reduction) {
  state.falter = clamp01(reduction)
}

export function activateConducting() {
  state.active = true
  state.breadth = 0
  state.falter = 0
  state.downbeatSeq = 0
}

export function deactivateConducting() {
  state.active = false
}

// WorldStage reads this — returns the SAME object every call (no alloc).
export function getConducting() {
  return state
}

function fin(v, fb) {
  return Number.isFinite(v) ? v : fb
}
function clamp01(v) {
  if (!Number.isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}
