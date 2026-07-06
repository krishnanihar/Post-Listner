// src/score/tokens.js
export const COLORS = {
  paperCream: '#F2EBD8',
  inkCream: '#1C1814',
  inkCreamSecondary: '#6B5840',
  paperDark: '#0B0908',
  inkDark: '#E8DFCB',
  inkDarkSecondary: '#8A7556',
  paperPureBlack: '#000000',
  scoreAmber: '#D4A053',
}

export const FONTS = {
  serif: "'Iowan Old Style', Palatino, 'EB Garamond', Georgia, serif",
  mono: "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, monospace",
}

export const STROKE = {
  staveLine: 0.4,
  primaryMark: 1.2,
  secondaryMark: 0.9,
  tactus: 1.0,
}

// Shared easing vocabulary so the Act-1 overlays read as one lesson (redesign
// area 5). `settle` = the decisive out-expo used for cursor/commit glides
// (Framer array form); `settleCss` = the same curve as a CSS string; `reveal` /
// `breathe` = Framer named eases for flashes and ambient loops.
export const EASE = {
  settle: [0.22, 1, 0.36, 1],
  settleCss: 'cubic-bezier(0.22,1,0.36,1)',
  reveal: 'easeOut',
  breathe: 'easeInOut',
}

// Nocturne (2026-07-06) — the "opera for one listener" re-forming. One rule:
// LIGHT is the material of the living instrument (the WorldStage canvas), PAPER
// is the material of the record (<Paper> DOM surfaces). The lamplight spectrum
// grades ember → candle → whiteGold by "warmth". moonSilver is RESERVED for the
// Prompter's presence and is never decorative. paper/paperInk match the shipped
// cream so record surfaces are visually continuous. Canon:
// docs/superpowers/specs/2026-07-06-nocturne-design-canon.md. All Nocturne
// rendering is gated behind VITE_ENABLE_NOCTURNE (default off → shipped theme).
export const NOCTURNE = {
  stageBlack: '#0B0908',   // warm near-black; the empty stage
  ember: '#8C5A28',        // lamplight, coldest/dimmest
  candle: '#D4A053',       // lamplight, nominal — the heritage amber
  whiteGold: '#F0E3C8',    // lamplight, hottest/brightest (strike peaks, bloom center)
  moonSilver: '#AEB4BD',   // RESERVED — the Prompter's presence only
  paper: '#F2EBD8',        // record surfaces only
  paperInk: '#1C1814',     // ink on paper
}

// The lamplight gradient as [warmth, hex] stops. lightField.lampGradientStops
// interpolates between these by warmth ∈ [0,1].
export const LAMP_SPECTRUM = [
  [0.0, NOCTURNE.ember],
  [0.5, NOCTURNE.candle],
  [1.0, NOCTURNE.whiteGold],
]
