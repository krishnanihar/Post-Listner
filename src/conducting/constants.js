// Conducting-core constants. Two parameter sets — LEGACY matches the
// pre-refactor behavior byte-for-byte; RESEARCH applies the spec from
// Research/gesture-felt-agency-phone-as-baton.md §3-5.
//
// Until step 5, the active set MUST be LEGACY so the refactor is a no-op
// for the user. Step 5 flips USE_RESEARCH_CONDUCTING_PARAMS to true.

export const LEGACY_PARAMS = {
  // Downbeat detection (matches src/orchestra/ConductingEngine.js + phone.js)
  DOWNBEAT_ACCEL_THRESHOLD: 2.0,    // m/s²
  DOWNBEAT_MIN_INTERVAL_MS: 250,
  DOWNBEAT_WINDOW_MS: 150,

  // Gesture size → gain band (consumed by OrchestraEngine)
  GESTURE_SIZE_WINDOW_MS: 2000,
  GESTURE_SIZE_RANGE: 5.0,          // m/s² peak-to-peak that maps to 1.0
  GESTURE_SIZE_GAIN_MIN: 0.15,
  GESTURE_SIZE_GAIN_MAX: 1.0,

  // One Euro filter params — disabled in legacy mode (use raw input).
  ONE_EURO_ORIENTATION: null,
  ONE_EURO_ACCEL: null,

  // Articulation
  ARTICULATION_JERK_RANGE: 3.0,     // m/s³ that maps to 1.0
}

export const RESEARCH_PARAMS = {
  DOWNBEAT_ACCEL_THRESHOLD: 4.0,
  DOWNBEAT_MIN_INTERVAL_MS: 300,
  DOWNBEAT_WINDOW_MS: 150,

  GESTURE_SIZE_WINDOW_MS: 2000,
  GESTURE_SIZE_RANGE: 5.0,
  GESTURE_SIZE_GAIN_MIN: 0.5,       // ±6 dB → 0.5× linear
  GESTURE_SIZE_GAIN_MAX: 2.0,       // ±6 dB → 2.0× linear

  ONE_EURO_ORIENTATION: { mincutoff: 1.0, beta: 0.007, dcutoff: 1.0 },
  ONE_EURO_ACCEL:       { mincutoff: 0.5, beta: 0.005, dcutoff: 1.0 },

  ARTICULATION_JERK_RANGE: 3.0,
}

// Feature flags — flip to true in step 5/6, default false through steps 1-4.
export const USE_RESEARCH_CONDUCTING_PARAMS = false
export const ENABLE_GYRO_ENERGY_COUPLING    = false

export function activeParams() {
  return USE_RESEARCH_CONDUCTING_PARAMS ? RESEARCH_PARAMS : LEGACY_PARAMS
}
