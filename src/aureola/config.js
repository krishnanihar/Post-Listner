// AUREOLA_V3 — verbatim from spec §14.1. Do not edit without consulting
// AUREOLA-FRAMEWORK-V3.md; this is the canonical config object.
export const AUREOLA_V3 = {
  // Bindu — figure center, normalized canvas coords
  bindu: { cx: 0.5, cy: 0.65 },

  // Twelve houses, clockwise from top
  houses: [
    { id: 12, theta: 0 },   { id: 1,  theta: 30 },
    { id: 2,  theta: 60 },  { id: 3,  theta: 90 },
    { id: 4,  theta: 120 }, { id: 5,  theta: 150 },
    { id: 6,  theta: 180 }, { id: 7,  theta: 210 },
    { id: 8,  theta: 240 }, { id: 9,  theta: 270 },
    { id: 10, theta: 300 }, { id: 11, theta: 330 },
  ],

  // Three rings, φ-progression (Hambidge / Modulor warrant)
  rings: {
    inner: { r: 0.25, scale: 0.6, depth: 0.15, opacity: 0.96 },
    mid:   { r: 0.42, scale: 1.0, depth: 0.10, opacity: 0.94 },
    outer: { r: 0.65, scale: 1.4, depth: 0.05, opacity: 0.90 },
  },

  // Three thematic axes (sector restriction by question category)
  axes: {
    ascent:    { houses: [10, 11, 12, 1, 2], warrant: 'Ripa: divine attributes above' },
    action:    { houses: [2, 3, 4, 8, 9, 10], warrant: 'Thangka: lateral attendants' },
    grounding: { houses: [4, 5, 6, 7, 8],     warrant: 'Ripa: suppression syntax / kundalini' },
  },

  // Archetype warrants and defaults
  archetypes: {
    eye:           { axis: 'action',  ring: 'inner', weight: 1.4, color: 'gold',         warrant: 'Eye-of-Providence; upper-axis emblematic tradition' },
    hand_right:    { axis: 'action',  house: 3, ring: 'mid', weight: 1.0, color: 'flesh', warrant: 'Anatomical placement' },
    hand_left:     { axis: 'action',  house: 9, ring: 'mid', weight: 1.0, color: 'flesh', warrant: 'Anatomical placement' },
    bird:          { axis: 'ascent',  ring: 'outer', weight: 1.2, color: 'white-cyan',   warrant: 'Holy Spirit dove; Ripa Fame/Glory' },
    serpent:       { axis: 'grounding', house: 6, ring: 'mid', weight: 1.1, color: 'earth-green', warrant: 'Kundalini base; Eden foot; ouroboros' },
    lotus:         { axis: ['ascent', 'grounding'], ring: 'mid', weight: 1.1, color: 'violet',    warrant: 'Buddhist throne or blooming consciousness' },
    planet:        { axis: 'grounding', ring: 'outer', weight: 0.9, color: 'blue',         warrant: 'Orbital body; off-axis' },
    flame:         { axis: ['ascent', 'action', 'grounding'], ring: 'inner', weight: 1.3, color: 'red-orange', warrant: 'Multivalent: Pentecost/chakra/Hellenistic' },
    wing_pair:     { axis: 'ascent',  house: 12, ring: 'outer', weight: 1.2, color: 'pale-gold', warrant: 'Winged sun disk; Victory; angels' },
    sigil:         { axis: ['action', 'ascent'], ring: 'inner', weight: 1.1, color: 'silver',    warrant: 'Marks of meaning near consciousness' },
    constellation: { axis: 'ascent',  house: 12, ring: 'outer', weight: 0.8, color: 'white-point', warrant: 'Sky is up; outer ring is cosmic edge' },
  },

  // Saturation caps
  saturation: {
    maxObjectsTotal: 5,
    maxObjectsPerRing: 2,
    maxObjectsPerQuadrant: 3,
  },

  // Symmetry tiebreaker
  symmetry: {
    pairs: [[1, 11], [2, 10], [3, 9], [4, 8], [5, 7]],
    axisLocked: [6, 12],
    heavyArchetypes: ['eye', 'bird', 'lotus', 'flame', 'wing_pair', 'hand_right', 'hand_left'],
    lightArchetypes: ['sigil', 'constellation', 'planet'],
    tiebreakerEpsilon: 0.05, // 5% of optimum imbalance
  },

  // Arnheim weight constraint
  weight: {
    figureBonus: 1.2,
    colorTempWarm: 1.2,
    colorTempCool: 0.8,
    animatedBonus: 0.5,
  },

  // Constellation threading
  constellation: {
    bezierControlPullToBindu: 0.3,
    stroke: 'gold',
    width: 1.5,
    opacity: 0.25,
  },
}

// --- Sprint-1 rendering and weight constants below ---
// These augment AUREOLA_V3 with concrete values for the placement sandbox.
// Real PNG assets, halos, and entry animations are out of scope per the
// sprint brief; everything below is placeholder-grade.

// Hex codes for placeholder circle rendering. Keys mirror config.archetypes[*].color.
export const ARCHETYPE_COLORS = {
  gold:          '#C9A227',
  flesh:         '#D4B5A0',
  'white-cyan':  '#B8E8F0',
  'earth-green': '#5B7C3A',
  violet:        '#7A4FA0',
  blue:          '#4A65B8',
  'red-orange':  '#D85F2A',
  'pale-gold':   '#E0D080',
  silver:        '#C0C0C0',
  'white-point': '#F0F0F0',
}

// Color hue → temperature factor (§6.1 color_temp_factor_i)
export const COLOR_TEMP_FACTOR = {
  gold:          1.2,
  flesh:         1.0,
  'white-cyan':  0.8,
  'earth-green': 1.0,
  violet:        0.8,
  blue:          0.8,
  'red-orange':  1.2,
  'pale-gold':   1.2,
  silver:        1.0,
  'white-point': 1.0,
}

// Per-archetype z-depth offset (§5.5 examples). Positive = closer to camera.
export const ARCHETYPE_DEPTH = {
  eye:           0.05,
  hand_right:    0.0,
  hand_left:     0.0,
  bird:          0.0,
  serpent:       0.0,
  lotus:         0.0,
  planet:       -0.05,
  flame:         0.03,
  wing_pair:     0.0,
  sigil:         0.0,
  constellation: 0.0,
}

// World-space rendering knobs
export const WORLD_RENDER = {
  // Aureola objects all live forward of the base scene's deepest displacement
  // (DEPTH_STRENGTH = 0.4 in bestiary/Workbench), so they're never occluded by
  // the figure. Final z = zBaseOffset + ring.depth + ARCHETYPE_DEPTH[name].
  zBaseOffset: 0.50,
  // Placeholder circle radius as fraction of the half-frame diagonal. Multiplied
  // by ring.scale per object. Frame-relative so circles read the same fraction
  // of the visible scene on phone (small world) and desktop (big world).
  objectRadiusFraction: 0.055,
  // Tessellation for Bezier polyline sampling
  bezierSegments: 32,
}

// Figure weight inputs for W_f (§6.2). The area value here is tuned so that the
// runtime ceiling allows ~3–5 medium objects before demotion triggers; the spec's
// formula is otherwise unit-agnostic and needs calibration. Bump area to relax,
// drop it to tighten.
export const FIGURE_WEIGHT_PARAMS = {
  area:       6.74,
  saturation: 0.85,
  value:      0.80,
}

// Default rendering parameters used when computing W_i for a candidate object
export const OBJECT_DEFAULT_SAT_VALUE = {
  saturation: 0.85,
  value:      0.85,
}
