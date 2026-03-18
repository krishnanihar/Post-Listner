// Phase durations in seconds
export const PHASE_DURATIONS = {
  INTRO: 45,        // 0:00 - 0:45
  THRONE: 120,      // 0:45 - 2:45
  ASCENT: 180,      // 2:45 - 5:45
  DISSOLUTION: 210, // 5:45 - 9:15
  SILENCE: 45,      // 9:15 - 10:00
};

export const TOTAL_DURATION = 600; // 10 minutes in seconds

// Cumulative phase start times
export const PHASE_START_TIMES = {
  INTRO: 0,
  THRONE: 45,
  ASCENT: 165,
  DISSOLUTION: 345,
  SILENCE: 555,
};

// Binaural beat parameters
export const BINAURAL = {
  CARRIER_FREQ: 400,         // Hz — optimal for binaural perception
  PHASE_1_BEAT: 10,          // Hz — alpha range
  PHASE_3_START_BEAT: 10,    // Hz — alpha
  PHASE_3_END_BEAT: 6,       // Hz — upper theta
  PHASE_4_BEAT: 4,           // Hz — theta (OBE-conducive)
  PHASE_5_END_BEAT: 2,       // Hz — delta
  GAIN: 0.12,                // Subliminal — below conscious attention
};

// Alpha amplitude modulation
export const MODULATION = {
  MIN_FREQ: 8,    // Hz — lower alpha
  MAX_FREQ: 13,   // Hz — upper alpha
  MIN_DEPTH: 0.0, // No modulation (Phase 1-2)
  MAX_DEPTH: 0.7, // Strong modulation (Phase 4)
};

// Coupling decay
export const COUPLING = {
  INITIAL: 1.0,
  PHASE_3_END: 0.3,
  PHASE_4: 0.0,
  SIGMOID_STEEPNESS: 6,
};

// Spatial audio positions (azimuth in degrees, elevation in degrees)
export const VOICE_POSITIONS = {
  ADMIRER: { azimuth: 0, elevation: 0, distance: 1.5 },
  GUIDE: { azimuth: 90, elevation: 15, distance: 3 },
  WITNESS: { azimuth: 180, elevation: 30, distance: 5 },
};

// Azimuth spread per category (degrees offset between voices in same category)
export const VOICE_SPREAD = {
  admirer: 25,
  guide: 30,
  witness: 40,
  whispers: 60,    // scattered wide
  fragments: 50,   // scattered wide
};

// Per-category voice gain multipliers — compensate for HRTF distance attenuation
export const VOICE_CATEGORY_GAINS = {
  admirer: 2.0,     // reference level (distance 1.5m)
  guide: 3.5,       // ~85-90% perceived vs admirer after distance atten
  witness: 5.0,     // ~70-75% perceived vs admirer
  whispers: 3.5,    // ~50-60% perceived vs admirer
  fragments: 3.0,   // ~40-50% perceived vs admirer
};

// Orbital motion for spatial sources
export const ORBITAL = {
  DRONE_SPEED: 0.12,
  GUIDE_SPEED: 0.25,
  COLLECTIVE_SPEED: 0.15,
  ELEVATION_RISE_RATE: 0.3,
  MAX_ELEVATION: 75,
  DISTANCE_BREATHE: 0.3,  // fraction of base distance for sinusoidal oscillation
};

// Phase-driven parameter targets: [startValue, endValue]
export const PHASE_PARAMS = {
  INTRO: {
    binauralBeat: [10, 10],
    binauralGain: [0, BINAURAL.GAIN],
    modDepth: [0, 0],
    musicGain: [0, 0],        // no chamber music — demo plays via demoGain
    collectiveGain: [0, 0],
  },
  THRONE: {
    binauralBeat: [10, 10],
    binauralGain: [BINAURAL.GAIN, BINAURAL.GAIN],
    modDepth: [0, 0],
    musicGain: [0, 0],        // still demo only
    collectiveGain: [0, 0],
  },
  ASCENT: {
    binauralBeat: [10, 6],
    binauralGain: [BINAURAL.GAIN, BINAURAL.GAIN],
    modDepth: [0, 0.2],
    musicGain: [0, 0.2],      // chamber track fades in as demo fades out
    collectiveGain: [0, 0.5],
  },
  DISSOLUTION: {
    binauralBeat: [6, 4],
    binauralGain: [BINAURAL.GAIN, BINAURAL.GAIN],
    modDepth: [0.2, 0.35],
    musicGain: [0.12, 0],     // quiet chamber fading to silence
    collectiveGain: [0.5, 0.8],
  },
  SILENCE: {
    binauralBeat: [4, 2],
    binauralGain: [BINAURAL.GAIN, 0],
    modDepth: [0.35, 0],
    musicGain: [0, 0],
    collectiveGain: [0.8, 0],
  },
};
