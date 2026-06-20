// src/lib/attunementToAvd.js
// Maps each move-movement's raw gesture input to a signed AVD *target* for
// commitTurn(). Each helper takes the current vector and leaves the axes it
// does not probe untouched (commitTurn EWMA-steps every axis, so unprobed
// axes must target their current value). Pure — unit-tested.

function clampSigned(x) { return Math.max(-1, Math.min(1, x)) }

// Lean (roll → Valence) + Lift (pitch → Depth). pan/filterNorm are 0..1.
export function leanLiftTarget(pan, filterNorm, current) {
  return {
    a: current.a,                              // unprobed — hold
    v: clampSigned((pan - 0.5) * 2),           // left→-1 cold, right→+1 warm
    d: clampSigned((filterNorm - 0.5) * 2),    // forward→-1 open, back→+1 inward
  }
}

// Rise (swell size + ride/pull-back → Arousal, + hedonic). peakSwell 0..1.
export function riseTarget(peakSwell, rodeClimax, current) {
  let a = peakSwell * 2 - 1
  let v = current.v
  if (!rodeClimax) { a -= 0.3; v -= 0.15 }     // rejected the peak
  return { a: clampSigned(a), v: clampSigned(v), d: current.d }
}

export function riseHedonic(rodeClimax) { return !!rodeClimax }

// Confidence from how long the user held a lean before committing. Instant
// flicks and agonized holds are both discounted; a decisive 0.4–2s hold is
// full confidence. Mirrors Spectrum's dwell weighting.
export function dwellConfidence(dwellMs) {
  if (dwellMs <= 0) return 0
  if (dwellMs < 400) return (dwellMs / 400) * 0.9 + 0.1
  if (dwellMs <= 2000) return 1
  return Math.max(0.7, 1 - (dwellMs - 2000) / 6000)
}
