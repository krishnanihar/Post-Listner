import { hashText } from './textHash.js'

/**
 * glyph — the journal's glyph system (design doc §8 / spec §3).
 *
 * Two pure concerns:
 *  - distillGlyph: the phone reduces a raw ~14k-sample conducting path into a
 *    small, shape- and tempo-faithful polyline that fits a jsonb column.
 *  - deriveHand: the desktop derives a stable per-account render style (the
 *    "hand") so all of one user's glyphs read as one person's handwriting.
 *
 * A stored glyph is { v, pts: [[x, y, t], ...], dur } — x,y normalised 0..1,
 * t in ms since capture start, dur the total capture length in ms.
 */

export const GLYPH_VERSION = 1

const DEFAULT_BUDGET = 600 // max points in a distilled glyph
const MAX_PRE = 2400 // uniform pre-decimation cap — bounds RDP recursion depth

/** Perpendicular distance from point p to the line a→b (x,y only). */
function perpDistance(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/**
 * Ramer–Douglas–Peucker polyline simplification. Keeps points where the path
 * deviates more than `epsilon`; drops redundant near-straight runs. Endpoints
 * are always preserved. Each point is [x, y, t]; only x,y drive the distance.
 */
export function simplifyPath(points, epsilon) {
  if (points.length <= 2) return points.slice()
  let maxDist = 0
  let idx = 0
  const end = points.length - 1
  for (let i = 1; i < end; i++) {
    const d = perpDistance(points[i], points[0], points[end])
    if (d > maxDist) {
      maxDist = d
      idx = i
    }
  }
  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, idx + 1), epsilon)
    const right = simplifyPath(points.slice(idx), epsilon)
    return left.slice(0, -1).concat(right)
  }
  return [points[0], points[end]]
}

/**
 * Distil a raw conducting buffer into a stored glyph. Uniformly pre-decimates
 * huge buffers (bounding RDP recursion), then RDP-simplifies with an epsilon
 * swept upward until the result is within `budget`. A hard slice cap is the
 * final safety net. Coordinates round to 3 decimals, t to whole ms.
 */
export function distillGlyph(rawPts, opts = {}) {
  const budget = Math.max(2, opts.budget ?? DEFAULT_BUDGET)
  const round3 = (n) => Math.round(n * 1000) / 1000
  const pack = (pts) => pts.map((p) => [round3(p[0]), round3(p[1]), Math.round(p[2])])

  if (!Array.isArray(rawPts) || rawPts.length === 0) {
    return { v: GLYPH_VERSION, pts: [], dur: 0 }
  }
  const dur = Math.max(0, Math.round(rawPts[rawPts.length - 1][2] || 0))
  if (rawPts.length <= 2) {
    return { v: GLYPH_VERSION, pts: pack(rawPts), dur }
  }

  // 1. uniform pre-decimation — bounds RDP recursion on huge buffers
  let work = rawPts
  if (rawPts.length > MAX_PRE) {
    const step = rawPts.length / MAX_PRE
    work = []
    for (let i = 0; i < MAX_PRE; i++) work.push(rawPts[Math.floor(i * step)])
    work.push(rawPts[rawPts.length - 1])
  }

  // 2. RDP — sweep epsilon upward until within budget
  let epsilon = 0.004
  let simplified = simplifyPath(work, epsilon)
  let guard = 0
  while (simplified.length > budget && guard < 24) {
    epsilon *= 1.6
    simplified = simplifyPath(work, epsilon)
    guard += 1
  }

  // 3. hard cap — safety net if the sweep never converged. The strided slice
  // can miss the true last point, so force both endpoints back in afterwards
  // (the spec requires endpoints always survive).
  if (simplified.length > budget) {
    const step = simplified.length / budget
    const capped = []
    for (let i = 0; i < budget; i++) capped.push(simplified[Math.floor(i * step)])
    capped[0] = simplified[0]
    capped[capped.length - 1] = simplified[simplified.length - 1]
    simplified = capped
  }

  return { v: GLYPH_VERSION, pts: pack(simplified), dur }
}

/**
 * revealGlyph — the points of a glyph that should be drawn at a given
 * playback progress (0..1). Used to re-animate the recorded path in sync
 * with the entry's song (spec §4.1). The per-point `t` sets the order and
 * relative pacing; `progress` is normalised onto the glyph's own `dur`.
 *
 * Returns [[x, y], ...] — every point whose t <= progress*dur, plus one
 * interpolated point on the segment straddling that time so the ink advances
 * smoothly. progress <= 0 -> the first point only; >= 1 -> the whole path.
 * A missing/short/malformed glyph is handled without throwing.
 */
export function revealGlyph(glyph, progress) {
  const pts = glyph && Array.isArray(glyph.pts) ? glyph.pts : []
  if (pts.length === 0) return []
  const xy = (p) => [p[0], p[1]]
  if (pts.length === 1) return [xy(pts[0])]
  if (progress <= 0) return [xy(pts[0])]
  if (progress >= 1) return pts.map(xy)

  const dur = glyph.dur > 0 ? glyph.dur : pts[pts.length - 1][2] || 1
  const targetT = progress * dur

  const out = [xy(pts[0])]
  for (let i = 1; i < pts.length; i++) {
    const t = pts[i][2]
    if (t <= targetT) {
      out.push(xy(pts[i]))
    } else {
      // interpolate the straddling segment; skip when the fraction is 0 so
      // the result never duplicates the previous whole point
      const prev = pts[i - 1]
      const span = t - prev[2]
      const f = span > 0 ? (targetT - prev[2]) / span : 0
      if (f > 0) {
        out.push([
          prev[0] + (pts[i][0] - prev[0]) * f,
          prev[1] + (pts[i][1] - prev[1]) * f,
        ])
      }
      break
    }
  }
  return out
}

/**
 * Derive the per-account "hand" — a stable render style for one user's
 * glyphs. The account id is hashed (FNV-1a, via textHash) and independent
 * fields are carved from the 32-bit result. Constant for a given seed, so
 * every entry a user makes is drawn in the same hand.
 */
export function deriveHand(seed) {
  const h = parseInt(hashText(String(seed ?? '')), 16) >>> 0
  // f(shift, bits) → a 0..1 fraction from `bits` bits at `shift`
  const f = (shift, bits) => {
    const mask = (1 << bits) - 1
    return ((h >>> shift) & mask) / mask
  }
  const weightT = f(8, 6)
  return {
    inkHue: Math.round(18 + f(0, 8) * 20), // 18..38° — warm sienna/umber band
    inkSat: 46,
    inkLight: 16,
    minWidth: 0.8 + weightT * 0.7, // 0.8..1.5
    maxWidth: 3.4 + weightT * 3.0, // 3.4..6.4
    taper: 0.35 + f(14, 6) * 0.5, // 0.35..0.85 — how concentrated the fat middle is
  }
}
