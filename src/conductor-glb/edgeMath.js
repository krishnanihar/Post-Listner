/* Pure 2D geometry helpers for the sacred-geometry edge-lighting feature.
 * Kept dependency-free so it's trivially unit-testable. */

/**
 * Shortest distance from point P to line segment AB (all in 2D pixel space).
 * Returns 0 if P is on the segment. If the perpendicular projection of P
 * onto the line falls OUTSIDE the segment, returns the distance to the
 * nearer endpoint. Safe against a degenerate zero-length segment.
 */
export function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const ab2 = abx * abx + aby * aby
  if (ab2 < 1e-9) {
    return Math.hypot(px - ax, py - ay)
  }
  const apx = px - ax
  const apy = py - ay
  let t = (apx * abx + apy * aby) / ab2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const cx = ax + t * abx
  const cy = ay + t * aby
  return Math.hypot(px - cx, py - cy)
}
