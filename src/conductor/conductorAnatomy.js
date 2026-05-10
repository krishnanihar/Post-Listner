// Anatomical limits for conductor figure motion.
// Magnitudes are gain factors applied to the phone signal, NOT raw bone angles —
// the resulting bone angle is signal × gain, then clamped to the corresponding
// max. Tune the gain to make the figure responsive; tune the max to keep poses
// believable.

const DEG = Math.PI / 180

export const ANATOMICAL = {
  // Head — gentle nods + turns
  HEAD_PITCH_GAIN: 0.40,        // phone forward/back tilt → head pitch
  HEAD_PITCH_MAX:  25 * DEG,    // ~25° comfortable nod range
  HEAD_YAW_GAIN:   0.50,        // phone yaw (twist) → head turn
  HEAD_YAW_MAX:    35 * DEG,    // ~35° comfortable turn range

  // Chest — subtle lean only; head + chest yaw are NOT both driven (would compound)
  CHEST_ROLL_GAIN: 0.40,        // phone side tilt → chest lean
  CHEST_ROLL_MAX:  15 * DEG,    // ~15° lateral flexion

  // Right upper arm — the "baton arm"
  // No gain on individual axes; we apply the *full* phone rotation in world
  // space (converted to bone-local), then clamp the resulting angular distance
  // from rest to ARM_MAX. The arm follows the phone but never folds backwards.
  ARM_DAMPING: 0.70,            // 0.0 = no influence, 1.0 = full mirror
  ARM_MAX:     90 * DEG,        // hard ceiling on world-space rotation from rest
}
