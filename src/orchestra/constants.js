// All times in seconds from the moment "show me who I am" is pressed (time 0:00)

export const STARTS = {
  REVEAL: 0,         // 0:00 — briefing screen, song still playing
  BLOOM: 30,         // 0:30 — hall materializes, conducting goes live
  THRONE: 50,        // 0:50 — full conducting, ego inflation
  ASCENT: 180,       // 3:00 — orchestra fractures
  DISSOLUTION: 360,  // 6:00 — song dies, Track B dominant
  SILENCE: 555,      // 9:15 — everything fades
  RETURN: 600,       // 10:00 — screen brightens
}

export const TOTAL_DURATION = 630 // 10:30

// Track A (user's song) — 3-band frequency split
export const SECTIONS = {
  LOW:  { cutoff: 250, type: 'lowpass',  azimuth: -55, elevation: -10, distance: 2.5 },
  MID:  { cutoffLow: 250, cutoffHigh: 2500, azimuth: 0, elevation: 5, distance: 2.0 },
  HIGH: { cutoff: 2500, type: 'highpass', azimuth: 55, elevation: 15, distance: 2.0 },
}

// Per-section coupling decay during Ascent (absolute times)
export const FRACTURE = {
  HIGH: [
    [180, 1.0], [200, 0.7], [220, 0.5], [240, 0.2], [300, 0.1],
  ],
  MID: [
    [180, 1.0], [210, 0.8], [240, 0.5], [270, 0.3], [300, 0.15],
  ],
  LOW: [
    [180, 1.0], [220, 0.85], [260, 0.6], [300, 0.35], [330, 0.15],
  ],
  HIGH_DRIFT: 40,    // max azimuth drift in degrees
  MID_DRIFT: 15,
  HIGH_DETUNE: 12,   // max detune in cents
  MID_DETUNE: 5,
}

// Track B
export const TRACK_B = {
  ENTER: 240,              // 4:00 — enters during Ascent
  INITIAL_LOWPASS: 800,
  FINAL_LOWPASS: 4500,
  ORBITAL_SPEED: 0.03,     // rad/s
}

// Gains at key moments (interpolate between these)
export const GAINS = {
  TRACK_A: {
    REVEAL: 0.7,
    THRONE: 0.7,
    ASCENT_END: 0.25,
    DISSOLUTION_MID: 0.05,
    DISSOLUTION_END: 0.0,   // gone by 7:30 (450s)
  },
  TRACK_B: {
    ENTER: 0.0,
    CROSSOVER: 0.25,        // ~5:20 (320s) — node gain matches Track A (heard level lower due to 4m panner atten)
    DISSOLUTION: 0.70,
    PEAK: 0.80,             // brief swell on "Good"
    SILENCE: 0.0,
  },
  AUDIENCE: {
    BLOOM: 0.10,
    DISSOLUTION: 0.0,       // gone by 6:00
  },
  OVATION: {
    PEAK: 0.25,
    TIME: 160,              // 2:40 absolute
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

// Conducting parameters — re-export from existing chamber constants
export { CONDUCTING } from '../chamber/utils/constants.js'
