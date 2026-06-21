// src/lib/attunementMovements.js
// The Attunement Room's six-beat arc as data. Wording/visual copy lives in the
// movement components; this is the *structure* the choreographer sequences:
// kind, the gesture signals each move-movement reads, the AVD axes it probes,
// the commit gain, the room-expansion target reached when it commits, and the
// `ask` line the companion voices when the movement begins.
// Pure data + selectors — unit-tested. (See spec §5.)
//
// `ask` — the invitation/question the companion voices on movement entry. It is
// DATA (wording is Knih's to edit). `null` means nothing is voiced on entry for
// that movement: arrival is opened by the pre-baked welcome clip, leanLift is
// already cued by the welcome's tail ("lean toward whatever's pulling at you")
// so its on-screen serif cue carries it, and bloom is the silent act-1 → act-2
// handoff. The listener never speaks — they answer every movement with their
// body (gestures); the `ask` is the room's question posed aloud (now a pre-baked
// TTS clip, id `ask-<movementId>`), not an instruction to speak.

export const MOVEMENTS = [
  { id: 'arrival',  kind: 'talk',    expansionTo: 0.0,  ask: null },
  { id: 'leanLift', kind: 'move',    signals: ['pan'], probes: ['v'], gain: 0.8, expansionTo: 0.2,  ask: null },
  { id: 'listen',   kind: 'move',    signals: ['filterNorm'], probes: ['d'], gain: 0.8, expansionTo: 0.35, ask: null },
  { id: 'rise',     kind: 'move',    signals: ['gestureGain', 'downbeat'], probes: ['a'], gain: 0.9, expansionTo: 0.6,  ask: null },
  { id: 'face',     kind: 'move',    signals: ['yaw'], probes: ['v', 'd'], gain: 1.0, expansionTo: 0.85, ask: null },
  { id: 'bloom',    kind: 'handoff', expansionTo: 1.0,  ask: null },
]

export const MOVEMENT_ORDER = MOVEMENTS.map((m) => m.id)

export function getMovement(id) {
  return MOVEMENTS.find((m) => m.id === id) || null
}

export function firstMovementId() {
  return MOVEMENT_ORDER[0]
}

export function nextMovementId(id) {
  const i = MOVEMENT_ORDER.indexOf(id)
  if (i < 0 || i >= MOVEMENT_ORDER.length - 1) return null
  return MOVEMENT_ORDER[i + 1]
}
