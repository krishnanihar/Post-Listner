// src/lib/questionSeeds.js
// The Admirer's authored question deck (Option B). Seeds are DATA: the client
// selects which seed to ask (seedSelection.js) and the agent only re-voices
// the `text`. The poetic core of every locate seed is authored by Knih; the
// biography seeds are the spec's. Wording is freely editable — selection logic
// and tests key off structure (id/kind/probes/gain), never exact text.
//
// Seed shape:
//   id           unique string
//   kind         'biography' | 'locate' | 'selection' | 'closing'
//   text         the authored line the agent re-voices
//   probes       'A' | 'V' | 'D' | null  (axis the answer should resolve)
//   intent       { a, v, d } small directional bias of the question itself
//   gain         step multiplier (locate 0.8; arrival/biography 0.3)
//   sessionScope 'first' (session 1 only) | 'always'
//   tier         1 | 3   (3 = unlocks only at year-tier 3)
//   options      selection seeds only: [{ label, avd: {a,v,d} }]

const N = { a: 0, v: 0, d: 0 }

export const SEEDS = [
  // --- Biography (session 1 only; observe, don't steer) ---
  { id: 'bio-stayed', kind: 'biography', sessionScope: 'first', tier: 1, gain: 0.3, probes: null, intent: N,
    text: 'What is a piece of music that has stayed with you?' },
  { id: 'bio-last', kind: 'biography', sessionScope: 'first', tier: 1, gain: 0.3, probes: null, intent: N,
    text: 'When did you last listen to it on purpose?' },
  { id: 'bio-first', kind: 'biography', sessionScope: 'first', tier: 1, gain: 0.3, probes: null, intent: N,
    text: 'What were you doing when it first found you?' },

  // --- Locate (every session; the instrument's recurring voice) ---
  { id: 'locate-arrival', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.3, probes: null, intent: N,
    text: "What's around you, right now?" },
  { id: 'locate-arousal', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'A', intent: N,
    text: 'Do you want something that moves you, or something that stays still with you?' },
  { id: 'locate-valence', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'V', intent: N,
    text: 'Is today asking you to lift, or to be held?' },
  { id: 'locate-depth', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'D', intent: N,
    text: "Should this keep you company, or take you somewhere you haven't been?" },
  { id: 'locate-quiet', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'V', intent: { a: -0.2, v: 0, d: 0.2 },
    text: 'Where does your mind go when the room gets quiet?' },

  // --- Selection (tap-to-choose; options carry their own AVD) ---
  { id: 'locate-color', kind: 'selection', sessionScope: 'always', tier: 1, gain: 0.8, probes: null, intent: N,
    text: 'If this evening were a color — amber, slate, rose, or ink?',
    options: [
      { label: 'amber', avd: { a: -0.3, v: 0.6, d: 0.0 } },
      { label: 'slate', avd: { a: -0.4, v: -0.4, d: 0.4 } },
      { label: 'rose', avd: { a: 0.0, v: 0.5, d: 0.2 } },
      { label: 'ink', avd: { a: 0.1, v: -0.1, d: 0.7 } },
    ] },

  // --- Closing (no AVD; the refusal-to-know) ---
  { id: 'closing', kind: 'closing', sessionScope: 'always', tier: 1, gain: 0, probes: null, intent: N,
    text: "I won't tell you what this was. That's yours." },
]

// How many locate/selection seeds to ask per session (biography is extra,
// session 1 only). ~3 per the spec's ~16-min arc. NOTE: the arrival opener
// (locate-arrival) counts toward this budget, so a session asks the opener
// + (LOCATE_BUDGET - 1) axis questions.
export const LOCATE_BUDGET = 3

export function getSeed(id) {
  return SEEDS.find((s) => s.id === id) || null
}
