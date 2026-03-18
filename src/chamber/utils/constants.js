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
  GAIN: 0.05,                // Subliminal — below conscious attention
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

// Conducting gesture parameters
export const CONDUCTING = {
  // Downbeat detection
  DOWNBEAT_ACCEL_THRESHOLD: 3.0,    // m/s² — minimum Y acceleration spike to qualify as downbeat
  DOWNBEAT_MIN_INTERVAL_MS: 250,    // ms — minimum time between downbeats (~240 BPM max)
  DOWNBEAT_WINDOW_MS: 150,          // ms — sliding window for zero-crossing detection
  DOWNBEAT_GAIN_SPIKE_MIN: 1.3,     // multiplier on current gain for weakest qualifying downbeat
  DOWNBEAT_GAIN_SPIKE_MAX: 2.0,     // multiplier for strongest downbeat
  DOWNBEAT_GAIN_DECAY_TC: 0.15,     // seconds — exponential decay time constant after spike
  DOWNBEAT_Q_MIN: 4,                // filter Q on weak downbeat
  DOWNBEAT_Q_MAX: 12,               // filter Q on strong downbeat
  DOWNBEAT_Q_DECAY_TC: 0.10,        // seconds — Q decay time constant
  DOWNBEAT_TRANSIENT_GAIN: 0.04,    // gain of percussive noise transient on downbeat
  DOWNBEAT_TRANSIENT_DURATION: 0.03, // seconds
  DOWNBEAT_HAPTIC_MS: 15,           // vibration duration in ms

  // Gesture size → dynamics
  GESTURE_SIZE_WINDOW_MS: 2000,     // ms — rolling window for peak-to-peak amplitude
  GESTURE_SIZE_GAIN_MIN: 0.15,      // minimum music gain (near-silence when still)
  GESTURE_SIZE_GAIN_MAX: 1.0,       // maximum music gain (full volume on big gestures)
  GESTURE_SIZE_SMOOTHING_TC: 0.5,   // seconds — smoothing time constant for dynamics
  GESTURE_SIZE_RANGE: 8.0,          // m/s² — acceleration range that maps to full gain (0 to this value)

  // Articulation (jerk → filter resonance)
  ARTICULATION_Q_BASE: 1,           // resting Q
  ARTICULATION_Q_MAX: 8,            // max Q from sharp gestures
  ARTICULATION_THRESHOLD: 0.3,      // minimum articulation (0-1) to trigger Q boost
  ARTICULATION_DECAY_TC: 0.10,      // seconds — Q decay after jerk spike

  // Orientation baseline calibration
  CALIBRATION_DURATION_MS: 2000,    // ms to sample for neutral orientation
  CALIBRATION_SAMPLES_TARGET: 100,  // target number of samples during calibration

  // Latency-optimized time constants (seconds)
  PAN_TC: 0.02,                     // stereo pan response
  FILTER_FREQ_TC: 0.02,             // filter cutoff response
  INTENSITY_TC: 0.02,               // gain response for motion intensity
};

// Phase-driven parameter targets: [startValue, endValue]
export const PHASE_PARAMS = {
  INTRO: {
    binauralBeat: [10, 10],
    binauralGain: [0, BINAURAL.GAIN],
    modDepth: [0, 0],
    musicGain: [0, 0],
    collectiveGain: [0, 0],
    demoGain: [0, 0.45],      // song fades in from silence across INTRO
  },
  THRONE: {
    binauralBeat: [10, 10],
    binauralGain: [BINAURAL.GAIN, BINAURAL.GAIN],
    modDepth: [0, 0],
    musicGain: [0, 0],
    collectiveGain: [0, 0.10], // crowd fades in gently during THRONE
    demoGain: [0.45, 0.45],   // full presence throughout THRONE
  },
  ASCENT: {
    binauralBeat: [10, 6],
    binauralGain: [BINAURAL.GAIN, BINAURAL.GAIN],
    modDepth: [0, 0.2],
    musicGain: [0, 0.2],
    collectiveGain: [0.10, 0.5],
    demoGain: [0.45, 0],      // song dies across ASCENT
  },
  DISSOLUTION: {
    binauralBeat: [6, 4],
    binauralGain: [BINAURAL.GAIN, BINAURAL.GAIN],
    modDepth: [0.2, 0.35],
    musicGain: [0.12, 0],
    collectiveGain: [0.5, 0.8],
    demoGain: [0, 0],         // song is gone
  },
  SILENCE: {
    binauralBeat: [4, 2],
    binauralGain: [BINAURAL.GAIN, 0],
    modDepth: [0.35, 0],
    musicGain: [0, 0],
    collectiveGain: [0.8, 0],
    demoGain: [0, 0],         // song is gone
  },
};
