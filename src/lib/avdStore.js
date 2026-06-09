// Subscribable in-memory store for the session's continuous AVD vector.
// Mirrors the repo's pub/sub idiom (momentBus.js, formationStage.js):
// module-scope state, a Set of listeners, immediate emit on subscribe, and a
// reset that re-arms a fresh session.
//
// commitTurn() applies the spec EWMA (avdRuntime) using the running turn
// counter so cold-start turns 1–3 move faster. setAvd() writes the vector
// directly — used by the dev debug sliders and (later) by embodied-tilt
// nudges. The Admirer slice will compute targets and call commitTurn().

import { ewmaStep, clampUnitSigned } from './avdRuntime.js'

const NEUTRAL = { a: 0, v: 0, d: 0 }

let vector = { ...NEUTRAL }
let turnCount = 0
const listeners = new Set()

export function getAvd() {
  return { ...vector }
}

export function getTurnCount() {
  return turnCount
}

// Commit one conversational turn: EWMA-step the vector toward `target`
// (using the current turn index for the eta schedule), then advance the turn
// counter. `confidence` (read quality, 0..1) and `gain` (seed step weight)
// scale the step; both default to 1 so callers can omit them. Returns the
// new vector.
export function commitTurn(target, { confidence = 1, gain = 1 } = {}) {
  const factor = Math.max(0, confidence) * Math.max(0, gain)
  vector = ewmaStep(vector, target, turnCount, factor)
  turnCount += 1
  emit()
  return getAvd()
}

function pickAxis(next, current) {
  return typeof next === 'number' && Number.isFinite(next)
    ? clampUnitSigned(next)
    : current
}

// Write the vector directly (dev sliders / tilt nudges). Unspecified axes are
// left unchanged; every axis is clamped to [-1, 1]. Does NOT touch the turn
// counter.
export function setAvd(partial) {
  vector = {
    a: pickAxis(partial.a, vector.a),
    v: pickAxis(partial.v, vector.v),
    d: pickAxis(partial.d, vector.d),
  }
  emit()
}

export function subscribeAvd(fn) {
  listeners.add(fn)
  fn(getAvd())
  return () => listeners.delete(fn)
}

export function resetAvd() {
  vector = { ...NEUTRAL }
  turnCount = 0
  emit()
}

function emit() {
  const snapshot = getAvd()
  for (const l of listeners) l(snapshot)
}
