// worldSound.js — the diegetic sound layer (Nocturne canon §5).
//
// Every state change in the opera is a sound *from the room*, never a UI blip:
// a lamp switching on, a pen writing one word, a felt mallet on a warm
// resonator, a hall opening. This module is a tiny, inert SFX player — it does
// nothing until a call site asks it to. Each cue maps to an mp3 under
// '/world/sfx/' generated once by scripts/generate-world-sfx.js.
//
// Discipline (mirrors Settle.jsx's settle-close.mp3): lazily construct an
// HTMLAudioElement, play it, and FAIL SILENT if the asset is absent or autoplay
// is blocked — the experience must run even with no sfx on disk. Elements are
// cached by id and reused. Reduced-motion is honoured as an *audio* analog:
// nothing is skipped (sound is not motion), but peak volume is softened so a
// cue can never startle. SSR / no-Audio environments are a no-op.
//
// Call sites gate *when* a cue fires (idempotent by eventId, momentBus idiom);
// this module is only responsible for playing it gently or not at all.

import { prefersReducedMotion } from '../lib/reducedMotion.js'

const SFX_DIR = '/world/sfx/'

// id → filename under '/world/sfx/'. The 13 diegetic cues of canon §5.
export const SFX_MANIFEST = {
  threshold: 'threshold.mp3',
  'lamp-up': 'lamp-up.mp3',
  'page-write': 'page-write.mp3',
  seat: 'seat.mp3',
  'beat-commit-warm': 'beat-commit-warm.mp3',
  'beat-commit-deep': 'beat-commit-deep.mp3',
  'pool-tip': 'pool-tip.mp3',
  'world-face': 'world-face.mp3',
  'lamp-wide': 'lamp-wide.mp3',
  ember: 'ember.mp3',
  'coda-settle': 'coda-settle.mp3',
  'constellation-open': 'constellation-open.mp3',
  'season-open': 'season-open.mp3',
}

// At reduced motion, soften every cue so nothing sudden or loud can startle.
const REDUCED_VOLUME_SCALE = 0.5

// id → HTMLAudioElement, built lazily on first use and reused thereafter.
const cache = new Map()

function hasAudio() {
  return typeof Audio !== 'undefined'
}

function getElement(id) {
  if (cache.has(id)) return cache.get(id)
  const file = SFX_MANIFEST[id]
  if (!file) return null
  let el = null
  try {
    el = new Audio(SFX_DIR + file)
    el.preload = 'auto'
  } catch {
    el = null
  }
  // Cache even a null so we don't retry construction on every call.
  cache.set(id, el)
  return el
}

/**
 * Play a diegetic cue by id. Fails silent when the asset is missing or autoplay
 * is blocked. At reduced motion the peak volume is softened (never skipped).
 *
 * @param {string} id — a key of SFX_MANIFEST
 * @param {{ volume?: number }} [opts] — base volume 0..1 (default 0.6)
 */
export function playSfx(id, { volume = 0.6 } = {}) {
  if (!hasAudio()) return
  const el = getElement(id)
  if (!el) return
  let v = volume
  if (prefersReducedMotion()) v *= REDUCED_VOLUME_SCALE
  // Clamp to a sane range; a silent cue is harmless, a >1 throws.
  el.volume = Math.max(0, Math.min(1, v))
  try {
    el.currentTime = 0
  } catch {
    /* currentTime can throw before metadata loads — ignore */
  }
  // play() returns a promise in modern browsers; swallow autoplay/asset errors.
  try {
    const p = el.play()
    if (p && typeof p.catch === 'function') p.catch(() => { /* silent */ })
  } catch {
    /* older browsers throw synchronously — silent */
  }
}

/**
 * Best-effort preload of every cue. Safe to call more than once; a no-op in
 * SSR / no-Audio environments. Never throws.
 */
export function preloadSfx() {
  if (!hasAudio()) return
  for (const id of Object.keys(SFX_MANIFEST)) {
    const el = getElement(id)
    if (el) el.preload = 'auto'
  }
}
