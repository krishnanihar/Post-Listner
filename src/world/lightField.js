// Nocturne WorldStage — the light field. Pure light model + a thin canvas
// compositor. Light is the material of the living instrument (canon §2): a scene
// is a warm stage-black ground plus a primary lamp pool and up to 6 secondary
// sources, each painted as an additive ('screen') radial gradient. No WebGL, no
// React. The color/geometry math is pure + tested; compositeScene takes a 2D
// context so the same model drives the app and a headless test.
//
// Canon: docs/superpowers/specs/2026-07-06-nocturne-design-canon.md §3–4.

import { NOCTURNE, LAMP_SPECTRUM } from '../score/tokens.js'
import { breath } from '../lib/motionGrammar.js'

export const MAX_SOURCES = 6

// A neutral resting scene: a small warm pool, centered, candle-warm, intimate.
export function makeScene(partial = {}) {
  return {
    pool: { x: 0.5, y: 0.5, radius: 0.28, ...(partial.pool || {}) },
    warmth: partial.warmth == null ? 0.5 : clamp01(partial.warmth),
    breadth: partial.breadth == null ? 0 : clamp01(partial.breadth),
    intensity: partial.intensity == null ? 1 : clamp01(partial.intensity),
    sources: partial.sources ? partial.sources.slice(0, MAX_SOURCES) : [],
  }
}

// Merge a partial scene onto a base (used by worldStore.setScene). Pool merges
// field-wise; sources replace wholesale when provided.
export function mergeScene(base, partial = {}) {
  const next = makeScene({
    pool: { ...base.pool, ...(partial.pool || {}) },
    warmth: partial.warmth == null ? base.warmth : partial.warmth,
    breadth: partial.breadth == null ? base.breadth : partial.breadth,
    intensity: partial.intensity == null ? base.intensity : partial.intensity,
    sources: partial.sources == null ? base.sources : partial.sources,
  })
  return next
}

// Interpolate two scenes by k ∈ [0,1] — used for transitions (crossfades when
// reduced-motion). Sources lerp pairwise up to the shorter list; the longer
// list's tail fades by its own intensity toward k's target.
export function lerpScene(a, b, k) {
  const kk = clamp01(k)
  const n = Math.max(a.sources.length, b.sources.length)
  const sources = []
  for (let i = 0; i < n && i < MAX_SOURCES; i++) {
    const sa = a.sources[i]
    const sb = b.sources[i]
    if (sa && sb) sources.push(lerpSource(sa, sb, kk))
    else if (sb) sources.push({ ...sb, intensity: lerp(0, sb.intensity, kk) })
    else if (sa) sources.push({ ...sa, intensity: lerp(sa.intensity, 0, kk) })
  }
  return {
    pool: {
      x: lerp(a.pool.x, b.pool.x, kk),
      y: lerp(a.pool.y, b.pool.y, kk),
      radius: lerp(a.pool.radius, b.pool.radius, kk),
    },
    warmth: lerp(a.warmth, b.warmth, kk),
    breadth: lerp(a.breadth, b.breadth, kk),
    intensity: lerp(a.intensity, b.intensity, kk),
    sources,
  }
}

function lerpSource(a, b, k) {
  return {
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    radius: lerp(a.radius, b.radius, k),
    warmth: lerp(a.warmth == null ? 0.5 : a.warmth, b.warmth == null ? 0.5 : b.warmth, k),
    intensity: lerp(a.intensity == null ? 1 : a.intensity, b.intensity == null ? 1 : b.intensity, k),
  }
}

// The LAMP_SPECTRUM hex stops parsed to rgb ONCE at module load — so lampColor
// never re-parses the constant hex strings per frame.
const LAMP_STOPS_RGB = LAMP_SPECTRUM.map(([w, hex]) => [w, hexToRgb(hex)])

// The lamp color at a given warmth, interpolated along LAMP_SPECTRUM
// (ember → candle → whiteGold). Returns {r,g,b} 0..255. Pass an optional `out`
// object to write into (zero-alloc for the per-frame render loop, same idiom as
// avdSpring.stepSpring); omit it and a fresh object is returned (pure/test use).
export function lampColor(warmth, out) {
  const w = clamp01(warmth)
  const stops = LAMP_STOPS_RGB
  for (let i = 0; i < stops.length - 1; i++) {
    const [w0, c0] = stops[i]
    const [w1, c1] = stops[i + 1]
    if (w <= w1 || i === stops.length - 2) {
      const t = w1 === w0 ? 0 : (w - w0) / (w1 - w0)
      return lerpRgbInto(c0, c1, clamp01(t), out)
    }
  }
  return copyRgb(stops[stops.length - 1][1], out)
}

// The effective pool radius in pixels: intimate at breadth 0 (small centered
// pool), hall-filling at breadth 1. minDim is min(w,h). Pure so bloom coupling
// is testable against Orchestra's timeline.
export function poolRadiusPx(pool, breadth, minDim, maxDim) {
  const base = pool.radius * minDim
  // At full breadth the pool grows to cover the frame diagonal-ish so light
  // reaches every corner (the "hall opens").
  const hall = maxDim * 0.85
  return lerp(base, Math.max(base, hall), clamp01(breadth))
}

// ── Canvas compositor ───────────────────────────────────────────────────────
// Paints stage-black, then each source as an additive radial gradient. tMs
// drives a subtle breath on the primary pool's intensity (folded to 0 when
// reduced). Allocation-light: reuses no per-frame arrays beyond gradient objects
// the 2D API forces us to create.
export function compositeScene(ctx, scene, w, h, tMs, opts = {}) {
  const { reduced = false, glow = 0 } = opts
  const minDim = Math.min(w, h)
  const maxDim = Math.max(w, h)

  const bg = NOCTURNE.stageBlack
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.globalCompositeOperation = 'screen'

  // Primary pool.
  const pool = scene.pool
  const px = pool.x * w
  const py = pool.y * h
  const rad = poolRadiusPx(pool, scene.breadth, minDim, maxDim)
  // Breath modulates intensity gently around its set value; glow (gesture size)
  // adds on top. Both fold appropriately under reduced motion.
  const b = 1 + 0.06 * breath(tMs, { hz: 0.1, amp: 1, reduced })
  const primaryIntensity = clamp01(scene.intensity * b + glow * 0.4)
  paintSource(ctx, px, py, rad, scene.warmth, primaryIntensity)

  // Secondary sources.
  const sources = scene.sources
  for (let i = 0; i < sources.length && i < MAX_SOURCES; i++) {
    const s = sources[i]
    paintSource(
      ctx,
      s.x * w,
      s.y * h,
      (s.radius || 0.1) * minDim,
      s.warmth == null ? scene.warmth : s.warmth,
      s.intensity == null ? 1 : s.intensity,
    )
  }

  ctx.globalCompositeOperation = 'source-over'
}

// Module-level scratch for the source color — paintSource fully consumes it
// synchronously each call, so reusing it across sources within a frame is safe
// and keeps compositeScene allocation-free (beyond the gradient the 2D API forces).
const _srcRgb = { r: 0, g: 0, b: 0 }
function paintSource(ctx, x, y, radius, warmth, intensity) {
  if (radius <= 0 || intensity <= 0) return
  const { r, g, b } = lampColor(warmth, _srcRgb)
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
  const a = clamp01(intensity)
  grad.addColorStop(0, `rgba(${r},${g},${b},${a})`)
  grad.addColorStop(0.55, `rgba(${r},${g},${b},${a * 0.35})`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

// ── helpers ─────────────────────────────────────────────────────────────────
export function clamp01(v) {
  if (!Number.isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}
function lerp(a, b, t) { return a + (b - a) * t }
function lerpRgbInto(a, b, t, out) {
  const o = out || { r: 0, g: 0, b: 0 }
  o.r = Math.round(lerp(a.r, b.r, t))
  o.g = Math.round(lerp(a.g, b.g, t))
  o.b = Math.round(lerp(a.b, b.b, t))
  return o
}
function copyRgb(c, out) {
  const o = out || { r: 0, g: 0, b: 0 }
  o.r = c.r; o.g = c.g; o.b = c.b
  return o
}
function hexToRgb(hex) {
  const m = String(hex).trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return { r: 212, g: 160, b: 83 } // candle fallback
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}
