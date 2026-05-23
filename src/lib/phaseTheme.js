// Phase → ink colour. ReflectionSurface (and any future cross-phase
// surface mounted as a sibling of the phase swap in App.jsx) reads the
// active ink via var(--ink, ...), so it stays theme-agnostic — this
// module owns the mapping between a phase identifier and the colour
// that paints on top of that phase's background.
//
// entry, admirer, settle render on the cream paper background (#F2EBD8)
// — dark ink reads. orchestra renders on the dark background — light
// cream ink reads.

const INK_CREAM = '#1C1814'  // matches COLORS.inkCream in score/tokens
const INK_LIGHT = '#E8E4DD'  // the cream-light ink that reads on dark

const PHASE_INK = {
  entry: INK_CREAM,
  admirer: INK_CREAM,
  orchestra: INK_LIGHT,
  settle: INK_CREAM,
}

export function inkForPhase(phase) {
  return PHASE_INK[phase] || INK_CREAM
}
