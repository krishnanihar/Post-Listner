// src/lib/attunementMovements.js
// The Attunement Room's six-beat arc as data. Wording/visual copy lives in the
// movement components; this is the *structure* the choreographer sequences:
// kind, the gesture signals each move-movement reads, the AVD axes it probes,
// the commit gain, and the room-expansion target reached when it commits.
// Pure data + selectors — unit-tested. (See spec §5.)

export const MOVEMENTS = [
  { id: 'arrival',  kind: 'talk',    expansionTo: 0.0 },
  { id: 'leanLift', kind: 'move',    signals: ['pan', 'filterNorm'], probes: ['v', 'd'], gain: 0.8, expansionTo: 0.2 },
  { id: 'listen',   kind: 'tap',     expansionTo: 0.35 },
  { id: 'rise',     kind: 'move',    signals: ['gestureGain', 'downbeat'], probes: ['a'], gain: 0.9, expansionTo: 0.6 },
  { id: 'face',     kind: 'move',    signals: ['yaw'], probes: ['v', 'd'], gain: 1.0, expansionTo: 0.85 },
  { id: 'bloom',    kind: 'handoff', expansionTo: 1.0 },
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
