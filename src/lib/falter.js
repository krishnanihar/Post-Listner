// Nocturne — the diegetic falter (canon §7). Sustained chaotic articulation
// (jerk above a threshold for >~4s) makes the hall "lean away": the reverb send
// eases down ~15%; settling restores it. The Personal-Orchestra "the orchestra
// stops when conducting is too erratic" pattern, lite — a felt error signal, not
// a punishment. Pure detector; the caller holds the state and applies the
// returned reduction to a reverb-send gain param OFF the audio hot path. Behind
// VITE_ENABLE_FALTER; ship dark, evaluate on device.
//
// The reduction is a factor in [0, maxReduction]: multiply the nominal reverb
// send by (1 - reduction). 0 = no change (calm); maxReduction = fully leaned
// away (sustained chaos).

export const DEFAULT_FALTER = {
  jerkThreshold: 3.0,   // m/s³-ish, matched to the conducting jerk scale
  sustainMs: 4000,      // chaos must persist this long before the room reacts
  rampInMs: 1500,       // time to reach full reduction once sustained
  rampOutMs: 1200,      // time to recover once the hand settles
  maxReduction: 0.15,   // 15% reverb-send cut at full falter
}

export function createFalterState() {
  return { chaosMs: 0, reduction: 0 }
}

// Advance the detector by dtMs given the current gesture jerk. Mutates + returns
// the state for zero-alloc reuse on repeated calls; `state.reduction` is the
// value to apply. Frame-rate independent via dtMs.
export function stepFalter(state, jerk, dtMs, opts = {}) {
  // Destructure with defaults (no per-call merged-object allocation — this runs
  // every conducting frame on the FALTER_ENABLED path).
  const {
    jerkThreshold = DEFAULT_FALTER.jerkThreshold,
    sustainMs = DEFAULT_FALTER.sustainMs,
    rampInMs = DEFAULT_FALTER.rampInMs,
    rampOutMs = DEFAULT_FALTER.rampOutMs,
    maxReduction = DEFAULT_FALTER.maxReduction,
  } = opts
  const dt = Number.isFinite(dtMs) && dtMs > 0 ? Math.min(dtMs, 250) : 0
  const chaotic = Number.isFinite(jerk) && jerk >= jerkThreshold

  if (chaotic) {
    state.chaosMs = Math.min(sustainMs + rampInMs, state.chaosMs + dt)
  } else {
    // Settling: bleed the accumulated chaos down at the ramp-out rate so a
    // brief calm doesn't instantly reset a long falter.
    state.chaosMs = Math.max(0, state.chaosMs - dt * (sustainMs / Math.max(1, rampOutMs)))
  }

  // Target reduction: 0 until sustained, then ramp to max over rampInMs.
  let target = 0
  if (state.chaosMs > sustainMs) {
    const over = state.chaosMs - sustainMs
    target = maxReduction * clamp01(over / rampInMs)
  }

  // Ease the live reduction toward target: quick in (rampIn), gentle out
  // (rampOut) so recovery feels like the room returning, not snapping back.
  const rate = target > state.reduction
    ? approachRate(dt, rampInMs)
    : approachRate(dt, rampOutMs)
  state.reduction = state.reduction + (target - state.reduction) * rate
  // Snap a sub-0.1%-send residual to zero: below this the reverb change is
  // inaudible, so treat the room as fully recovered rather than carrying a
  // micro-reduction that eases forever.
  if (state.reduction < 1e-3) state.reduction = 0
  return state
}

// The multiplier to apply to a nominal reverb send: 1 at rest, down to
// (1 - maxReduction) at full falter.
export function reverbSendFactor(state) {
  return 1 - (state ? state.reduction : 0)
}

function approachRate(dtMs, tauMs) {
  if (tauMs <= 0) return 1
  const r = 1 - Math.exp(-dtMs / tauMs)
  return r < 0 ? 0 : r > 1 ? 1 : r
}
function clamp01(v) {
  if (!Number.isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}
