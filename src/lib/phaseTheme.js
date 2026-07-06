// Phase → ink colour. ReflectionSurface (and any future cross-phase
// surface mounted as a sibling of the phase swap in App.jsx) reads the
// active ink via var(--ink, ...), so it stays theme-agnostic — this
// module owns the mapping between a phase identifier and the colour
// that paints on top of that phase's background.
//
// entry, admirer, settle render on the cream paper background (#F2EBD8)
// — dark ink reads. orchestra renders on the dark background — light
// cream ink reads.
//
// Nocturne (canon §2): when VITE_ENABLE_NOCTURNE is on, Act I (entry +
// admirer) renders on the dark WorldStage instead of cream paper, so its
// ink flips to LIGHT — every `var(--ink)`/`var(--ink-2)` consumer (the beat
// overlays' tracks/prompts/hints, the reflection caption, BackgroundGlyph)
// reads on the dark stage with ONE central change. settle stays a cream
// paper record (the Coda), and orchestra was always dark. When the flag is
// off this is byte-identical to the shipped mapping.

import { NOCTURNE_ENABLED } from '../world/flags.js'

const INK_CREAM = '#1C1814'  // matches COLORS.inkCream in score/tokens
const INK_CREAM_2 = '#6B5840' // matches COLORS.inkCreamSecondary
const INK_LIGHT = '#E8E4DD'  // the cream-light ink that reads on dark
const INK_LIGHT_2 = '#8A7556' // matches COLORS.inkDarkSecondary

const PHASE_INK = {
  entry: INK_CREAM,
  admirer: INK_CREAM,
  orchestra: INK_LIGHT,
  settle: INK_CREAM,
}
const PHASE_INK_2 = {
  entry: INK_CREAM_2,
  admirer: INK_CREAM_2,
  orchestra: INK_LIGHT_2,
  settle: INK_CREAM_2,
}

// Under Nocturne, entry + admirer move onto the dark stage → light ink.
const NOCTURNE_LIGHT_PHASES = new Set(['entry', 'admirer'])

export function inkForPhase(phase) {
  if (NOCTURNE_ENABLED && NOCTURNE_LIGHT_PHASES.has(phase)) return INK_LIGHT
  return PHASE_INK[phase] || INK_CREAM
}

export function ink2ForPhase(phase) {
  if (NOCTURNE_ENABLED && NOCTURNE_LIGHT_PHASES.has(phase)) return INK_LIGHT_2
  return PHASE_INK_2[phase] || INK_CREAM_2
}
