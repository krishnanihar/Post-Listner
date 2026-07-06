// Nocturne — the Trace. The unifying instrument-voice that Act I writes and
// Act II conducts with (canon §7). Extracted verbatim from Orchestra's Throne
// feedback glyph so the Act-II rendering is BEHAVIOR-IDENTICAL — this module is
// the refactor gate the rest of the redesign builds on. The pure draw functions
// take a canvas / 2D context so they can be unit-tested headless and so the
// caller (Orchestra's conducting loop) keeps owning the imperative draw call
// inside its try/catch — the isolation-from-the-audio-loop pattern is unchanged.
//
// drawTraceGlyph — the live gesture correlate (roll→x, pitch→y, swell→size,
//   downbeat→rings). Moved verbatim from Orchestra.jsx (was drawThroneGlyph).
// drawTrace — NEW, additive: replays the accumulated Act-I trace strokes
//   (worldStore.getTrace()) as faint sealed marks. Used by the Act-I overlays
//   and the reflect beat; never called on the Act-II hot path.

export const GLYPH_AMBER = '212,160,83' // #D4A053 (candle)

// Draw the Trace glyph (was drawThroneGlyph): a soft amber dot that tracks the
// conducting gesture (roll → x, pitch → y), swells with gesture size, and rings
// out on the downbeat. Peripheral and calm by design — proof the hand is doing
// something, not a HUD. Allocation-light per frame (one gradient, small ring
// array). VERBATIM from the shipped Orchestra glyph — do not change behavior.
export function drawTraceGlyph(canvas, gesture, fx, now) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
  const w = canvas.clientWidth || canvas.width
  const h = canvas.clientHeight || canvas.height
  if (!w || !h) return
  const pxW = Math.round(w * dpr)
  const pxH = Math.round(h * dpr)
  if (canvas.width !== pxW || canvas.height !== pxH) { canvas.width = pxW; canvas.height = pxH }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  // Finite-guard the inputs: a non-finite gesture field (NaN slips past `??`,
  // which only catches null/undefined) would make createRadialGradient throw.
  const num = (v, fb) => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : fb)
  const pan = num(gesture.pan, 0.5)
  const fn = num(gesture.filterNorm, 0.5)
  const gain = num(gesture.gestureGain, 0)
  const reduced = fx.reduced
  const x = w * (0.5 + (pan - 0.5) * 0.6) // keep it in the central 60%
  const y = h * (0.5 - (fn - 0.5) * 0.5)  // brighter/higher tilt → higher

  // Downbeat rings — expand + fade over ~900ms.
  const rings = fx.rings
  for (let i = rings.length - 1; i >= 0; i--) {
    const age = (now - rings[i].start) / 900
    if (age >= 1) { rings.splice(i, 1); continue }
    const r = 20 + age * (60 + rings[i].intensity * 120)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${GLYPH_AMBER},${(1 - age) * 0.35})`
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // Core dot + soft glow, swelling with gesture size.
  const base = 10 + gain * (reduced ? 12 : 40)
  const glow = ctx.createRadialGradient(x, y, 0, x, y, base * 2.4)
  glow.addColorStop(0, `rgba(${GLYPH_AMBER},${reduced ? 0.26 : 0.4})`)
  glow.addColorStop(1, `rgba(${GLYPH_AMBER},0)`)
  ctx.fillStyle = glow
  ctx.beginPath(); ctx.arc(x, y, base * 2.4, 0, Math.PI * 2); ctx.fill()

  ctx.beginPath(); ctx.arc(x, y, Math.max(2.5, base * 0.32), 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${GLYPH_AMBER},0.75)`
  ctx.fill()
}

// NEW — replay the accumulated Act-I trace as faint sealed marks. `trace` is
// worldStore.getTrace() (strokes with normalized x,y + size). Pure of any clock;
// `reveal ∈ [0,1]` gates how many strokes are shown (for the reflect replay).
// `w`/`h` and the stroke radii are expected in the SAME unit — WorldStage calls
// this with device-pixel dims under an identity transform, so it passes its own
// `dpr` to scale the radii up to match (else strokes render half-size on a
// DPR-2 phone); callers working in CSS pixels can omit it (dpr defaults to 1).
// Never on the Act-II hot path. Returns the count drawn (handy for tests).
export function drawTrace(ctx, trace, w, h, opts = {}) {
  if (!ctx || !trace || trace.length === 0) return 0
  const { reveal = 1, alpha = 0.5, dpr = 1 } = opts
  const shown = Math.max(0, Math.min(trace.length, Math.round(trace.length * clamp01(reveal))))
  for (let i = 0; i < shown; i++) {
    const s = trace[i]
    const x = clamp01(s.x) * w
    const y = clamp01(s.y) * h
    const size = (4 + (Number.isFinite(s.size) ? s.size : 0.5) * 14) * dpr
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size * 2)
    grad.addColorStop(0, `rgba(${GLYPH_AMBER},${alpha})`)
    grad.addColorStop(1, `rgba(${GLYPH_AMBER},0)`)
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.arc(x, y, size * 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(x, y, Math.max(1.5 * dpr, size * 0.3), 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${GLYPH_AMBER},${Math.min(1, alpha + 0.3)})`
    ctx.fill()
  }
  return shown
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}
