// src/lib/leanCommit.js
// Pure commit detector for the first-lean ("tipping world") beat. The lean
// commits the instant its balance |b| first crosses the brink WHILE still
// moving outward — a deliberate push past the line, not a held pose and not
// jitter sitting on the threshold. There is no timer anywhere: decisiveness is
// rewarded, hesitation costs nothing. Pure — unit-tested.
//
// b is the signed balance (pan − 0.5) * 2 ∈ [−1, +1]: −1 = full left/cold,
// +1 = full right/warm.

// The lean must carry the balance this far to tip the world over. Matches the
// old detection floor (the previous beat fired at |b| > 0.55 *plus* a 900ms
// hold; an instantaneous crossing at the same threshold is strictly easier).
// ~25° wrist roll under GestureCore's (gamma + 45) / 90 mapping. On-device
// tunable.
export const LEAN_BRINK = 0.55

// How far past center the lean must travel before we start timing the approach
// (for commit confidence). Below this the hand is effectively still/neutral.
export const LEAN_DEADZONE = 0.12

export function isBrinkCrossing({ b, prevB, brink = LEAN_BRINK, fired = false }) {
  if (fired) return false
  if (Math.abs(b) < brink) return false
  const dir = Math.sign(b)
  if (dir === 0) return false
  // Outward = the balance moved further in the direction it already points.
  // A retreat (moving back toward center) or jitter sitting on the threshold
  // (no movement) does not fire.
  return Math.sign(b - prevB) === dir
}
