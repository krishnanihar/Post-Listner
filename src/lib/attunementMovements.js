// src/lib/attunementMovements.js
// The Attunement Room's seven-beat arc as data. Wording/visual copy lives in the
// movement components; this is the *structure* the choreographer sequences:
// kind, the gesture signals each move-movement reads, the AVD axes it probes,
// the commit gain, the room-expansion target reached when it commits, and the
// `ask` line the companion voices when the movement begins.
// Pure data + selectors — unit-tested. (See spec §5.)
//
// `ask` — the invitation/question the Prompter voices on movement entry. The
// wording lives in src/lib/prompterScript.js (single source of truth, shared
// with the TTS generation script); this file only declares WHICH movements
// speak. `null` means nothing is voiced on entry: arrival is opened by the
// pre-baked welcome clips, reflect narrates its own script, and bloom is the
// silent act-1 → act-2 handoff. The listener never speaks — they answer every
// movement with their body (gestures); the `ask` is the room's question posed
// aloud (a pre-baked TTS clip, id `ask-<movementId>`), not a cue to speak.
//
// When the clip is absent from disk the runtime is fail-silent and the beat's
// on-screen cue carries the prompt instead — so nothing here is load-bearing.

import { askText } from './prompterScript.js'

export const MOVEMENTS = [
  { id: 'arrival',  kind: 'talk',    expansionTo: 0.0,  ask: null },
  { id: 'leanLift', kind: 'move',    signals: ['pan'], probes: ['v'], gain: 0.8, expansionTo: 0.2,  ask: askText('leanLift'),
    // Two roll sub-rounds, both probing Valence (a 2nd read makes the axis
    // reliable). Each re-poles in place; SR2 commits at half gain (refines, does
    // not overwrite). Discipline: every sub-round moves ONLY this beat's axis.
    subfaces: [
      { id: 'warm-cold',     prompt: 'is it warmth, or a colder light?',          leftLabel: 'a colder light', rightLabel: 'warmth',  gain: 0.8 },
      { id: 'shadow-sunlit', prompt: 'and this one — shadowed, or sunlit?',        leftLabel: 'shadowed',       rightLabel: 'sunlit',  gain: 0.4 },
    ],
  },
  { id: 'listen',   kind: 'move',    signals: ['filterNorm'], probes: ['d'], gain: 0.8, expansionTo: 0.35, ask: askText('listen'),
    // Two pitch sub-rounds, both probing Depth. top = open/spare, bottom =
    // inward/dense (forward-tilt = dark/inward, matching the Orchestra). SR2
    // refines at half gain.
    subfaces: [
      { id: 'open-inward', prompt: 'open it up, or draw it close?',       topLabel: 'open · bright',        bottomLabel: 'inward · dark', gain: 0.8 },
      { id: 'dense-spare', prompt: 'all of it, or just the essentials?',  topLabel: 'just the essentials',  bottomLabel: 'all of it',     gain: 0.4 },
    ],
  },
  { id: 'rise',     kind: 'move',    signals: ['gestureGain', 'downbeat'], probes: ['a'], gain: 0.9, expansionTo: 0.6,  ask: askText('rise') },
  { id: 'face',     kind: 'move',    signals: ['yaw'], probes: ['v', 'd'], gain: 1.0, expansionTo: 0.85, ask: askText('face') },
  { id: 'era',      kind: 'search',  expansionTo: 0.87, ask: askText('era') },
  { id: 'reflect',  kind: 'narrate', expansionTo: 0.9,  ask: null },
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
