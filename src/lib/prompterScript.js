// src/lib/prompterScript.js
// The Prompter's spoken score — the lines the room says at each beat of Act I
// and at the two Coda doors. SINGLE SOURCE OF TRUTH for the copy: both the
// runtime (which clip id to play) and the TTS generation script
// (scripts/generate-admirer-voice.js) import from here, so the two can't drift.
// Same discipline as reflectionScript.js: pure data + id builders, no React,
// no DOM. Selection logic keys off ids, never text — the wording is Knih's
// to edit and every line here is safe to rewrite without touching code.
//
// Why this exists: Act I is an audio instrument that, until now, taught itself
// almost entirely with on-screen text. The score already fired a per-beat spoken
// cue (useAttunementScore's onAsk → Admirer.playVoiceLine('ask-<beat>')), but
// every `ask` was null and no clip existed, so the path was silent. These are
// those lines. When a clip is missing from disk the runtime falls back to the
// on-screen cue (playVoiceLine is fail-silent), so nothing here is load-bearing
// for the choreography.
//
// Canon (docs/superpowers/specs/2026-07-06-nocturne-design-canon.md §8):
//   - The Prompter DESCRIBES, never diagnoses.
//   - It never speaks an archetype name or a number (Invariant 3).
//   - Voice xzZRXG86mSM3naOyL9fa, unchanged. Clip filenames ARE the ids.

// ── the beat invitations (spoken on movement entry) ──────────────────────────
// One per gesture beat. These carry what the overlay's long instructional
// sentence used to carry: what the body should do, and what it will mean later.
// `arrival` is opened by the welcome clips and `bloom` is the silent handoff,
// so neither has an ask.
export const ASKS = {
  leanLift:
    "lean the phone toward whichever one pulls at you. don't decide — let your hand decide. this is the same lean that will place the sound around you later.",
  listen:
    'now tilt it away from you, or draw it back toward your chest. forward opens the sound out. back brings it in close, and darker.',
  rise:
    'make the movement bigger. as big as you like — the room will follow you up. when it feels high enough, strike down once to seal it. a sharp strike cuts. a soft one swells.',
  face:
    'six of them are around you now. turn — with your whole body, not your wrist — until one of them is in front of you. strike down when you have found it.',
  era: 'one more thing. name a song that has stayed with you. it does not have to be a good one.',
}

// ── the seals (spoken after a beat commits) ──────────────────────────────────
// Canon §8's transfer lines: the moment the listener learns their gesture was
// KEPT. Fires under the beat-commit sfx, after the trace stroke is written.
export const SEALS = {
  leanLift: 'the orchestra will remember this lean.',
  listen: 'and this — how far in you went.',
  rise: 'that was the downbeat. it keeps it.',
  face: 'you turned toward that one. it heard you.',
}

// ── the transitions ──────────────────────────────────────────────────────────
export const TRANSITIONS = {
  // Spoken once in arrival — canon §8's renamed self-reference. The role is
  // never given a proper name.
  'prompter-intro':
    'think of me as the one who listens for the orchestra — the prompter, in the box, out of the light.',
  // Opens the reflect beat, under the trace replaying its strokes.
  'reflect-open': 'here is what your hands just wrote.',
  // The sacred seam: spoken as the room widens into the hall.
  'bloom-hall': 'now — the same room, opened. lift your hand.',
  // The two Coda doors.
  'constellation-line': 'others are practicing too. none of them are named.',
  'season-door': 'the record is yours, and only yours.',
}

export const ASK_KEYS = Object.keys(ASKS)
export const SEAL_KEYS = Object.keys(SEALS)
export const TRANSITION_KEYS = Object.keys(TRANSITIONS)

// ── clip ids ─────────────────────────────────────────────────────────────────
// The ask id shape is fixed by the runtime: useAttunementScore fires
// onAsk(movementId) and Admirer.jsx plays `ask-${movementId}`.
export function askClipId(movementId) {
  return `ask-${movementId}`
}
export function sealClipId(movementId) {
  return `seal-${movementId}`
}

export function askText(movementId) {
  return ASKS[movementId] || null
}
export function sealText(movementId) {
  return SEALS[movementId] || null
}

// Every Prompter clip id — used by the runtime to know which clips exist
// (Admirer.jsx's AVAILABLE_VOICE_LINES) and by the generation script.
export function allClipIds() {
  return [
    ...ASK_KEYS.map(askClipId),
    ...SEAL_KEYS.map(sealClipId),
    ...TRANSITION_KEYS,
  ]
}

// { clipId: text } for every Prompter clip — consumed by the generation script.
export function allLines() {
  const out = {}
  for (const id of ASK_KEYS) out[askClipId(id)] = ASKS[id]
  for (const id of SEAL_KEYS) out[sealClipId(id)] = SEALS[id]
  for (const id of TRANSITION_KEYS) out[id] = TRANSITIONS[id]
  return out
}
