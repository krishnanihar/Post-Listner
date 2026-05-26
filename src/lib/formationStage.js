// Three-stage formation store for the Admirer phase's 3D scene.
//
//   0 — sacred geometry forming (particles → flower-of-life on middle plane)
//   1 — cosmic periphery (back plane) fading in
//   2 — front figure fading in
//
// Stages only advance, never go back. Reset on phase entry.

let stage = 0
const listeners = new Set()

export function getFormationStage() {
  return stage
}

export function advanceFormationStage(target) {
  if (target <= stage) return
  stage = target
  listeners.forEach((fn) => fn(stage))
}

export function subscribeFormationStage(fn) {
  listeners.add(fn)
  fn(stage)
  return () => listeners.delete(fn)
}

export function resetFormationStage() {
  if (stage === 0) return
  stage = 0
  listeners.forEach((fn) => fn(stage))
}
