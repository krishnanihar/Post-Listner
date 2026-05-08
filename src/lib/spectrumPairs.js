// Spectrum word-pair definitions.
// PAIRS_LEGACY: the 8 pairs Phase 1 ships with — the audio assets in
//   public/spectrum/{left,right}.mp3 already exist for each.
// PAIRS_V2: the 9 polar pairs along orthogonal production-aesthetic axes
//   recommended by the redesign memo (Phase 2 scope item 4).
//   Asset dependency: public/spectrum/v2/{left,right}.mp3 × 9 pairs = 18 files,
//   ~8s each. Set ACTIVE_PAIRS = PAIRS_V2 once they land.

export const PAIRS_LEGACY = [
  { left: 'shadow',  right: 'warmth',
    coordL: { a: 0.30, v: 0.10, d: 0.50 }, coordR: { a: 0.30, v: 0.85, d: 0.50 } },
  { left: 'pulse',   right: 'shimmer',
    coordL: { a: 0.55, v: 0.20, d: 0.35 }, coordR: { a: 0.55, v: 0.80, d: 0.35 } },
  { left: 'weight',  right: 'air',
    coordL: { a: 0.20, v: 0.15, d: 0.60 }, coordR: { a: 0.20, v: 0.70, d: 0.60 } },
  { left: 'ache',    right: 'bloom',
    coordL: { a: 0.25, v: 0.10, d: 0.75 }, coordR: { a: 0.25, v: 0.90, d: 0.75 } },
  { left: 'machine', right: 'earth',
    coordL: { a: 0.50, v: 0.20, d: 0.40 }, coordR: { a: 0.50, v: 0.65, d: 0.40 } },
  { left: 'tension', right: 'resolve',
    coordL: { a: 0.60, v: 0.05, d: 0.55 }, coordR: { a: 0.60, v: 0.85, d: 0.55 } },
  { left: 'fog',     right: 'glass',
    coordL: { a: 0.15, v: 0.20, d: 0.65 }, coordR: { a: 0.15, v: 0.75, d: 0.65 } },
  { left: 'gravity', right: 'drift',
    coordL: { a: 0.65, v: 0.30, d: 0.30 }, coordR: { a: 0.15, v: 0.60, d: 0.70 } },
]

export const PAIRS_V2 = [
  // Each axis is one orthogonal production-aesthetic dimension.
  // coordL and coordR encode the AVD position the chosen end implies.
  { left: 'warm',        right: 'cold',
    coordL: { a: 0.40, v: 0.85, d: 0.50 }, coordR: { a: 0.40, v: 0.15, d: 0.50 } },
  { left: 'dense',       right: 'spare',
    coordL: { a: 0.50, v: 0.50, d: 0.85 }, coordR: { a: 0.50, v: 0.50, d: 0.15 } },
  { left: 'sung',        right: 'instrumental',
    coordL: { a: 0.45, v: 0.65, d: 0.55 }, coordR: { a: 0.45, v: 0.50, d: 0.55 } },
  { left: 'analog',      right: 'digital',
    coordL: { a: 0.45, v: 0.65, d: 0.55 }, coordR: { a: 0.55, v: 0.40, d: 0.45 } },
  { left: 'major',       right: 'modal',
    coordL: { a: 0.50, v: 0.85, d: 0.50 }, coordR: { a: 0.50, v: 0.30, d: 0.55 } },
  { left: 'slow',        right: 'fast',
    coordL: { a: 0.20, v: 0.50, d: 0.55 }, coordR: { a: 0.80, v: 0.50, d: 0.50 } },
  { left: 'driving',     right: 'floating',
    coordL: { a: 0.80, v: 0.55, d: 0.45 }, coordR: { a: 0.20, v: 0.55, d: 0.65 } },
  { left: 'low',         right: 'high',
    coordL: { a: 0.50, v: 0.40, d: 0.65 }, coordR: { a: 0.50, v: 0.60, d: 0.40 } },
  { left: 'reverberant', right: 'dry',
    coordL: { a: 0.40, v: 0.55, d: 0.75 }, coordR: { a: 0.55, v: 0.50, d: 0.30 } },
]

// Active set used by Spectrum.score.jsx. Toggle to PAIRS_V2 when the v2 audio
// assets are landed under public/spectrum/v2/.
export const ACTIVE_PAIRS = PAIRS_LEGACY
