// Orchestra v3 — 3-phase, song-duration-driven, voice-free.
//
// Timeline relative to AudioContext start (t = 0 at briefing-onset, NOT
// absolute clock time as in v2). Total run = BRIEFING + BLOOM + song body
// + END_FADE + CLOSING_CARD.
//
//   t = 0                       briefing visual + spatial bed materializing
//   t = BRIEFING_DURATION       Bloom begins — hall reverb fades in,
//                                stems separate spatially, audience murmur
//                                appears
//   t = BRIEFING + BLOOM        Throne begins — full conducting agency for
//                                the duration of the song minus the fade
//                                tail
//   t = song_duration - END_FADE_DURATION
//                                Fade-out begins
//   t = song_duration           Song silent, closing card shown
//   t = song_duration + CLOSING_CARD_DURATION
//                                Auto-return to home

export const BRIEFING_DURATION = 12       // 12 s — silent visual threshold
export const BLOOM_DURATION = 24          // 24 s — spatialization bloom
export const END_FADE_DURATION = 4        // 4 s — final fade tail
export const CLOSING_CARD_DURATION = 7    // 7 s — Forer last-sentence card

// Phase milestones (relative to start). Throne start is fixed; Throne end
// is derived from each session's actual song duration at runtime.
export const PHASES = {
  BRIEFING_START: 0,
  BLOOM_START: BRIEFING_DURATION,                       // 12
  THRONE_START: BRIEFING_DURATION + BLOOM_DURATION,     // 36
}

// Track A — 4 stems (Demucs canonical order: vocals, drums, bass, other).
// Spatial placement per Research/spatial-audio-hrtf-externalization.md.
//   vocals: front-center, slight offset to avoid in-head localization
//   drums:  hard-left lateral
//   bass:   hard-right lateral
//   other:  behind, deepest reverb
export const STEMS = {
  VOCALS: { azimuth:    5, elevation:  5, distance: 3.0, reverbSend: 0.35 },
  DRUMS:  { azimuth:  -60, elevation:  0, distance: 2.0, reverbSend: 0.25 },
  BASS:   { azimuth:   60, elevation: -5, distance: 2.5, reverbSend: 0.30 },
  OTHER:  { azimuth:  180, elevation: 10, distance: 4.0, reverbSend: 0.40 },
}

// Pre-HRTF distance lowpass cutoff per stem.
// Cutoff = 20000 × √(1/distance) per spatial-audio doc §"Distance filtering".
export function distanceCutoff(distanceMeters) {
  return Math.max(2000, 20000 * Math.pow(1 / Math.max(distanceMeters, 1), 0.5))
}

// Image-source early reflections for a ~5×4×3 m virtual room.
// Per spatial-audio:175-185, 6 first-order reflections shared across all stems.
export const EARLY_REFLECTIONS = [
  { name: 'left-wall',   delayMs:  7, gainDb: -6, lpHz: 4500, azimuth:  -90, elevation:   0 },
  { name: 'right-wall',  delayMs:  7, gainDb: -6, lpHz: 4500, azimuth:   90, elevation:   0 },
  { name: 'front-wall',  delayMs: 10, gainDb: -8, lpHz: 4000, azimuth:    0, elevation:   0 },
  { name: 'back-wall',   delayMs: 10, gainDb: -8, lpHz: 4000, azimuth:  180, elevation:   0 },
  { name: 'floor',       delayMs:  4, gainDb: -9, lpHz: 3500, azimuth:    0, elevation: -45 },
  { name: 'ceiling',     delayMs:  6, gainDb: -9, lpHz: 3500, azimuth:    0, elevation:  45 },
]

// Yaw-quadrant spotlight (gesture-felt-agency:185).
// User's facing direction → angular-distance-weighted boost on the matching stem.
export const YAW_SPOTLIGHT = {
  BOOST_DB: 3.5,
  CUT_DB:   2.0,
  HALFWIDTH_DEG: 60,
}

// Static gain levels — without Ascent/Dissolution there's no fade arc on
// the song itself; the song carries its own dynamics. Hall + audience are
// the only envelope we ramp during Bloom.
export const GAINS = {
  TRACK_A: 0.7,                    // constant Track A level once Bloom completes
  AUDIENCE: 0.10,                  // constant audience-murmur bed during Bloom + Throne
  HALL_WET: {
    BLOOM_START: 0.0,
    BLOOM_END:   0.55,
  },
  BINAURAL: {
    MAX:     0.05,
    CARRIER: 400,
    BEAT_HZ: 10,                   // constant alpha (no sweep)
  },
}

// Conducting parameters — re-export from existing chamber constants
export { CONDUCTING } from '../chamber/utils/constants.js'
