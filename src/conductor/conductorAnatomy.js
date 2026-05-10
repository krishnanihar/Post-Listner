// Anatomical limits for conductor figure motion.
// Magnitudes are gain factors applied to the phone signal, NOT raw bone angles —
// the resulting bone angle is signal × gain, then clamped to the corresponding
// max. Tune the gain to make the figure responsive; tune the max to keep poses
// believable.

const DEG = Math.PI / 180

export const ANATOMICAL = {
  // Head — visible nods + turns. Gains were 0.40/0.50; bumped to 0.80/0.90 so
  // a typical 30° phone tilt produces ~24° bone motion (saturating near the
  // anatomical max), which reads clearly on screen.
  HEAD_PITCH_GAIN: 0.80,        // phone forward/back tilt → head pitch
  HEAD_PITCH_MAX:  25 * DEG,    // ~25° comfortable nod range
  HEAD_YAW_GAIN:   0.90,        // phone yaw (twist) → head turn
  HEAD_YAW_MAX:    35 * DEG,    // ~35° comfortable turn range

  // Chest — visible lean. Gain bumped 0.40 → 0.80 for the same reason.
  CHEST_ROLL_GAIN: 0.80,        // phone side tilt → chest lean
  CHEST_ROLL_MAX:  15 * DEG,    // ~15° lateral flexion

  // Right upper arm — the "baton arm"
  // We apply the full phone rotation as a damped local-space delta on top of
  // rest, then clamp the resulting angular distance from rest to ARM_MAX.
  ARM_DAMPING: 0.85,            // 0.0 = no influence, 1.0 = full mirror
  ARM_MAX:     90 * DEG,        // hard ceiling on rotation from rest
}
