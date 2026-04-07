// All times in seconds from the moment "show me who I am" is pressed (time 0:00)
// v2 — 16-minute timeline per ORCHESTRA-V2-VOICE-SCRIPTS-FINAL.md

export const STARTS = {
  BRIEFING: 0,       // 0:00
  BLOOM: 32,         // 0:32
  THRONE: 95,        // 1:35
  ASCENT: 390,       // 6:30
  DISSOLUTION: 645,  // 10:45
  RETURN: 855,       // 14:15
  END: 960,          // 16:00
}

export const TOTAL_DURATION = 960 // 16:00

// Track A (user's song) — 3-band frequency split
export const SECTIONS = {
  LOW:  { cutoff: 250, type: 'lowpass',  azimuth: -55, elevation: -10, distance: 2.5 },
  MID:  { cutoffLow: 250, cutoffHigh: 2500, azimuth: 0, elevation: 5, distance: 2.0 },
  HIGH: { cutoff: 2500, type: 'highpass', azimuth: 55, elevation: 15, distance: 2.0 },
}

// Per-section coupling decay during Ascent (absolute times)
export const FRACTURE = {
  HIGH: [
    [390, 1.0], [420, 0.7], [460, 0.5], [510, 0.2], [580, 0.1],
  ],
  MID: [
    [390, 1.0], [440, 0.8], [500, 0.5], [560, 0.3], [620, 0.15],
  ],
  LOW: [
    [390, 1.0], [460, 0.85], [530, 0.6], [600, 0.35], [645, 0.15],
  ],
  HIGH_DRIFT: 40,    // max azimuth drift in degrees
  MID_DRIFT: 15,
  HIGH_DETUNE: 12,   // max detune in cents
  MID_DETUNE: 5,
}

// Track B
export const TRACK_B = {
  ENTER: 490,              // 8:10 — enters during Ascent
  INITIAL_LOWPASS: 800,
  FINAL_LOWPASS: 4500,
  ORBITAL_SPEED: 0.03,     // rad/s
}

// Gains at key moments (interpolate between these)
export const GAINS = {
  TRACK_A: {
    BLOOM: 0.7,
    THRONE: 0.7,
    ASCENT_END: 0.25,
    DISSOLUTION_MID: 0.05,
    DISSOLUTION_END: 0.0,   // gone by ~12:00 (720s)
  },
  TRACK_B: {
    ENTER: 0.0,
    CROSSOVER: 0.25,        // ~8:40 (520s) — gain matches Track A
    DISSOLUTION: 0.70,
    PEAK: 0.80,             // brief swell on "Good" at 13:55 (835s)
    SILENCE: 0.0,
  },
  AUDIENCE: {
    BLOOM: 0.10,
    DISSOLUTION: 0.0,       // gone by Dissolution start
  },
  OVATION: {
    PEAK: 0.25,
    TIME: 320,              // 5:20 absolute
    DURATION: 12,           // seconds
  },
  HALL_WET: {
    BLOOM_START: 0.0,
    BLOOM_END: 0.55,
    THRONE: 0.55,
    ASCENT_END: 0.70,
  },
  BINAURAL: {
    MAX: 0.05,
    CARRIER: 400,
  },
}

// Sidechain ducking
export const DUCK = {
  GAIN: 0.71,          // 3dB cut
  ATTACK_TC: 0.033,
  RELEASE_TC: 0.1,
}

// Conducting exaggeration (first 60s of Throne)
export const CONDUCTING_EXAGGERATION = {
  START: 95,                // when Throne begins (absolute)
  END: 155,                 // 60 seconds of exaggerated response
  GAIN_MULTIPLIER: 2.5,
  FILTER_MULTIPLIER: 1.8,
}

// Caretaking trigger (fixed time, no gesture detection)
export const CARETAKING_TRIGGER = {
  FALLBACK_TIME: 450,      // 7:30 absolute
}

// Conducting parameters — re-export from existing chamber constants
export { CONDUCTING } from '../chamber/utils/constants.js'
