// src/lib/attunementMovements.js
// The Attunement Room's six-beat arc as data. Wording/visual copy lives in the
// movement components; this is the *structure* the choreographer sequences:
// kind, the gesture signals each move-movement reads, the AVD axes it probes,
// the commit gain, the room-expansion target reached when it commits, and the
// `ask` line the companion voices when the movement begins.
// Pure data + selectors — unit-tested. (See spec §5.)
//
// `ask` — the invitation/question the companion voices on movement entry. It is
// DATA (wording is Knih's to edit). `null` means the companion says nothing on
// entry for that movement: arrival is opened by the first_message greeting, and
// bloom is the silent act-1 → act-2 handoff. The listener never speaks — they
// answer every movement with their body (gestures); the `ask` is the companion
// posing the room's question aloud, not an instruction to speak.

export const MOVEMENTS = [
  { id: 'arrival',  kind: 'talk',    expansionTo: 0.0,  ask: null },
  { id: 'leanLift', kind: 'move',    signals: ['pan', 'filterNorm'], probes: ['v', 'd'], gain: 0.8, expansionTo: 0.2,  ask: 'turn toward the one that pulls you — and tip it toward light or shadow.' },
  { id: 'listen',   kind: 'tap',     expansionTo: 0.35, ask: 'this next one — could it be yours?' },
  { id: 'rise',     kind: 'move',    signals: ['gestureGain', 'downbeat'], probes: ['a'], gain: 0.9, expansionTo: 0.6,  ask: 'let it rise. give it room, and meet the peak when it comes.' },
  { id: 'face',     kind: 'move',    signals: ['yaw'], probes: ['v', 'd'], gain: 1.0, expansionTo: 0.85, ask: 'now — turn to the one that feels like home.' },
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
