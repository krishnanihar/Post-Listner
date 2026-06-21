// src/lib/reflectionScript.js
// The end-of-Act-1 reflection the Admirer narrates: a grounded mirror of what
// the listener's body chose (warmth/depth/energy), then the faced world's
// feeling-first reading, then the handoff into the song. SINGLE SOURCE OF TRUTH
// for the copy — both the runtime (which clip to play) and the TTS generation
// script (scripts/generate-admirer-voice.js) import from here.
//
// The reflection is baked as two halves stitched at a sentence boundary:
//   1) a "gesture mirror" clip — FRAME + warmth + depth + energy (12 combos)
//   2) a "reading" clip — the world's reading + HANDOFF (6 worlds)
// Pure data + builders — unit-tested.

export const FRAME = 'i was watching how you moved.'
export const HANDOFF = 'this is the one that found you. stay with it.'

export const WARMTH_CLAUSE = {
  warm: 'you leaned toward warmth',
  cold: 'you leaned into the colder light',
}

export const DEPTH_CLAUSE = {
  inward: 'and drew it close — near, not open',
  open: 'and let it open, let it breathe',
}

export const ENERGY_CLAUSE = {
  low: 'you kept it low, unhurried.',
  'high-rode': 'you lifted it high, and met the peak.',
  'high-held': 'you lifted it high, but held back from the very top.',
}

// Feeling-first, unnamed (never says the archetype name). Keyed by archetype id.
// The handoff is appended at build time, so these are reading-only.
export const READING = {
  'late-night-architect':
    'you appreciate music that rewards a second listen — the kind with hidden depth. you keep your saddest songs for cab rides home.',
  'hearth-keeper':
    "you're drawn to music that arrives like a person sitting down beside you. you trust warmth more than spectacle, and you can tell the difference.",
  'velvet-mystic':
    'you hear architecture in music — height, light, the way a room holds sound. you collect songs the way other people collect rooms.',
  'quiet-insurgent':
    "you prefer the half-spoken thing to the chorus. there's a song you keep at the back of the queue on purpose.",
  'slow-glow':
    'you like music that takes its time, and assumes you will too. you hear groove as a kind of patience, not a kind of speed.',
  'sky-seeker':
    "you're drawn to music that makes the ceiling feel higher. you give yourself permission to be moved — most people don't.",
}

export const WARMTH_KEYS = Object.keys(WARMTH_CLAUSE)   // ['warm','cold']
export const DEPTH_KEYS = Object.keys(DEPTH_CLAUSE)     // ['inward','open']
export const ENERGY_KEYS = Object.keys(ENERGY_CLAUSE)   // ['low','high-rode','high-held']
export const WORLD_KEYS = Object.keys(READING)          // the 6 archetype ids

// Full spoken text of each half.
export function mirrorText(warmth, depth, energy) {
  return `${FRAME} ${WARMTH_CLAUSE[warmth]}, ${DEPTH_CLAUSE[depth]}. ${ENERGY_CLAUSE[energy]}`
}
export function readingText(worldId) {
  return `${READING[worldId]} ${HANDOFF}`
}

// Clip ids → the mp3 file names under public/admirer/voice/.
export function mirrorClipId(warmth, depth, energy) {
  return `reflect-mirror-${warmth}-${depth}-${energy}`
}
export function readingClipId(worldId) {
  return `reflect-reading-${worldId}`
}

// Every reflection clip id (12 mirror + 6 reading) — used by the runtime to
// know which clips exist.
export function allClipIds() {
  const ids = []
  for (const w of WARMTH_KEYS) {
    for (const d of DEPTH_KEYS) {
      for (const e of ENERGY_KEYS) ids.push(mirrorClipId(w, d, e))
    }
  }
  for (const world of WORLD_KEYS) ids.push(readingClipId(world))
  return ids
}

// { clipId: text } for all 18 clips — consumed by the generation script.
export function allLines() {
  const out = {}
  for (const w of WARMTH_KEYS) {
    for (const d of DEPTH_KEYS) {
      for (const e of ENERGY_KEYS) out[mirrorClipId(w, d, e)] = mirrorText(w, d, e)
    }
  }
  for (const world of WORLD_KEYS) out[readingClipId(world)] = readingText(world)
  return out
}
