// Anatomical limits for conductor figure motion.
// Magnitudes are gain factors applied to the phone signal, NOT raw bone angles —
// the resulting bone angle is signal × gain, then clamped to the corresponding
// max. Tune the gain to make the figure responsive; tune the max to keep poses
// believable.

const DEG = Math.PI / 180

export const ANATOMICAL = {
  // ---- Continuous orientation gains ------------------------------------
  // Pushed back up after live testing showed 0.45 was still imperceptible
  // through the wrist-bent baked pose at typical viewing distance. With
  // idle dialed down to life-signs, gesture can carry the visible motion.
  HEAD_PITCH_GAIN: 0.80,
  HEAD_PITCH_MAX:  30 * DEG,
  HEAD_YAW_GAIN:   0.80,
  HEAD_YAW_MAX:    40 * DEG,

  CHEST_ROLL_GAIN: 0.80,
  CHEST_ROLL_MAX:  20 * DEG,

  CHEST_PITCH_FROM_PITCH_GAIN: 0.25,
  CHEST_PITCH_FROM_PITCH_MAX:  10 * DEG,

  // Upper arm uses the same per-axis Euler-decomposed approach as head/chest
  // (local-space, not parent-space premultiply). Empirically simpler and
  // matches what works for the other bones — same axis convention.
  ARM_PITCH_GAIN: 0.90,
  ARM_PITCH_MAX:  45 * DEG,
  ARM_ROLL_GAIN:  0.90,
  ARM_ROLL_MAX:   40 * DEG,
  ARM_YAW_GAIN:   0.40,
  ARM_YAW_MAX:    20 * DEG,

  // ---- Idle baseline animation -----------------------------------------
  // Always-running motion so the figure is alive between gestures.
  // Amplitudes are intentionally TINY — life signs, not visible motion.
  // Original 6° arm sweep drowned out the 7.5° gesture response. Now
  // every idle amplitude is < 2° so gesture clearly dominates.
  IDLE_PERIOD_S:        4.0,
  IDLE_BREATH_PERIOD_S: 5.0,
  IDLE_HEAD_YAW:        0.8 * DEG,
  IDLE_HEAD_PITCH:      0.4 * DEG,
  IDLE_BREATH_PITCH:    0.6 * DEG,
  IDLE_CHEST_ROLL:      0.5 * DEG,
  IDLE_ARM_SWEEP:       1.8 * DEG,
  IDLE_ARM_LIFT:        1.2 * DEG,

  // ---- Beat-driven ictus impulse ---------------------------------------
  // When phone-side downbeat fires, snap the right arm forward over a fast
  // attack, then rebound back to baseline. Conducting tradition: ictus is
  // the moment of beat (sharp), rebound carries info about next beat
  // (smooth). Total 250ms; magnitude scales with detected intensity.
  IMPULSE_ATTACK_MS:   50,
  IMPULSE_DECAY_MS:    200,
  IMPULSE_ARM_PEAK:    18 * DEG,    // peak forearm forward snap (around X)
  IMPULSE_UPPER_PEAK:  6 * DEG,     // small upper-arm assist (around X)
  IMPULSE_HEAD_PEAK:   2 * DEG,     // tiny head dip on the beat
}
