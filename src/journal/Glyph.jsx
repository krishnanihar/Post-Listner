import { useEffect, useRef } from 'react'
import { revealGlyph } from '../lib/glyph.js'
import { mulberry32 } from '../lib/mulberry32.js'

/**
 * Glyph — the entry's hand-painted ink mark, for the journal detail view.
 *
 * Extracted from EntryPage. Two modes:
 *  - idle / paused / ended (playing=false): paints once. The complete mark
 *    when progress is 0 or >=1; the frozen partial when paused mid-song.
 *  - playing (playing=true): a rAF loop redraws the path up to progressRef's
 *    value each frame, so the ink advances in sync with the song.
 * Entries with no recorded glyph fall back to a procedural squiggle seeded
 * off the entry's chronological position; the fallback never animates.
 */

const W = 300
const H = 190
const PAD = 30

/** Size the canvas for the device pixel ratio, clear it, return a 2D ctx. */
function prepCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const ctx = canvas.getContext('2d')
  if (canvas.width !== W * dpr) canvas.width = W * dpr
  if (canvas.height !== H * dpr) canvas.height = H * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  return ctx
}

/**
 * The transform that fits a glyph's normalised 0..1 points into the padded
 * canvas box. Computed from the FULL path so a partially-revealed path is
 * drawn in its final position and grows in place rather than re-fitting.
 */
function glyphFitTransform(pts, pad) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const p of pts) {
    if (p[0] < minX) minX = p[0]
    if (p[0] > maxX) maxX = p[0]
    if (p[1] < minY) minY = p[1]
    if (p[1] > maxY) maxY = p[1]
  }
  const spanX = Math.max(maxX - minX, 0.001)
  const spanY = Math.max(maxY - minY, 0.001)
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY)
  return { scale, minX, minY, ox: (W - spanX * scale) / 2, oy: (H - spanY * scale) / 2 }
}

/** Map normalised points through a glyphFitTransform into canvas coordinates. */
function applyFit(pts, tf) {
  return pts.map((p) => [tf.ox + (p[0] - tf.minX) * tf.scale, tf.oy + (p[1] - tf.minY) * tf.scale])
}

/**
 * Lay a polyline down in three feathered passes (a wide pale bleed, a mid
 * body, a sharp core) so the edges feather like wet ink. Per-segment width
 * follows a taper envelope — thin at the ends, full in the middle — anchored
 * to `totalCount` (the FULL path length) so a partially-drawn glyph carries
 * the same stroke-weight profile it will have when complete.
 */
function strokeFeathered(ctx, xy, hand, totalCount) {
  const n = xy.length
  if (n < 2) return
  const total = totalCount || n
  const widthAt = (i) => {
    const u = total > 1 ? i / (total - 1) : 0.5
    const bell = Math.pow(Math.sin(Math.PI * u), hand.taper) // 0 at ends -> 1 mid
    return hand.minWidth + (hand.maxWidth - hand.minWidth) * bell
  }
  const passes = [
    { blur: 4, mul: 2.6, alpha: 0.10, light: hand.inkLight + 24 }, // wet bleed
    { blur: 0, mul: 1.5, alpha: 0.24, light: hand.inkLight + 10 }, // body
    { blur: 0, mul: 1.0, alpha: 0.62, light: hand.inkLight },      // core
  ]
  for (const p of passes) {
    ctx.filter = p.blur ? `blur(${p.blur}px)` : 'none'
    ctx.strokeStyle = `hsla(${hand.inkHue}, ${hand.inkSat}%, ${p.light}%, ${p.alpha})`
    for (let i = 1; i < n; i++) {
      ctx.beginPath()
      ctx.lineWidth = widthAt(i) * p.mul
      ctx.moveTo(xy[i - 1][0], xy[i - 1][1])
      ctx.lineTo(xy[i][0], xy[i][1])
      ctx.stroke()
    }
  }
  ctx.filter = 'none'
}

/** The procedural squiggle — the fallback mark for entries with no glyph. */
function drawProcedural(ctx, seed) {
  const rand = mulberry32((seed + 1) * 2654435761)
  ctx.translate(W / 2, H / 2)

  // soft pigment blooms behind the mark
  ctx.filter = 'blur(20px)'
  for (let i = 0; i < 3; i++) {
    const warm = rand() < 0.78
    ctx.fillStyle = warm
      ? `rgba(158, 104, 48, ${(0.11 + rand() * 0.08).toFixed(2)})`
      : `rgba(140, 96, 96, ${(0.07 + rand() * 0.05).toFixed(2)})`
    ctx.beginPath()
    ctx.arc((rand() - 0.5) * 120, (rand() - 0.5) * 70, 38 + rand() * 36, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.filter = 'none'

  // build the squiggle path once, then render it in feathered passes
  const pts = []
  let x = (rand() - 0.5) * 40
  let y = (rand() - 0.5) * 26
  const steps = 5 + Math.floor(rand() * 4)
  pts.push({ x, y })
  for (let i = 0; i < steps; i++) {
    const nx = (rand() - 0.5) * 190
    const ny = (rand() - 0.5) * 118
    const mx = (x + nx) / 2 + (rand() - 0.5) * 110
    const my = (y + ny) / 2 + (rand() - 0.5) * 110
    const w = 1.7 + rand() * 5.4
    pts.push({ x: nx, y: ny, mx, my, w })
    x = nx
    y = ny
  }

  const passes = [
    { blur: 4, mul: 2.7, alpha: 0.1, col: '74, 52, 28' }, // wet bleed
    { blur: 0, mul: 1.5, alpha: 0.24, col: '52, 38, 22' }, // body
    { blur: 0, mul: 1.0, alpha: 0.6, col: '32, 24, 16' }, // core
  ]
  for (const p of passes) {
    ctx.filter = p.blur ? `blur(${p.blur}px)` : 'none'
    ctx.strokeStyle = `rgba(${p.col}, ${p.alpha})`
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      ctx.beginPath()
      ctx.lineWidth = b.w * p.mul
      ctx.moveTo(a.x, a.y)
      ctx.quadraticCurveTo(b.mx, b.my, b.x, b.y)
      ctx.stroke()
    }
  }
  ctx.filter = 'none'

  // a few ink spatter flecks
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(40, 30, 18, ${(0.12 + rand() * 0.3).toFixed(2)})`
    ctx.beginPath()
    ctx.arc((rand() - 0.5) * 230, (rand() - 0.5) * 150, 0.6 + rand() * 2.1, 0, Math.PI * 2)
    ctx.fill()
  }
}

export default function Glyph({ glyph, seed, hand, playing, progressRef }) {
  const ref = useRef(null)
  const real = !!(glyph && Array.isArray(glyph.pts) && glyph.pts.length >= 2)

  // static paint — the complete mark (idle / ended), the frozen partial
  // (paused mid-song), or the procedural fallback. Skipped while playing —
  // the animation effect owns the canvas then.
  useEffect(() => {
    if (playing && real) return
    const ctx = prepCanvas(ref.current)
    if (!real) {
      drawProcedural(ctx, seed)
      return
    }
    const p = progressRef ? progressRef.current : 1
    const tf = glyphFitTransform(glyph.pts, PAD)
    const pts = p > 0 && p < 1 ? revealGlyph(glyph, p) : glyph.pts
    if (pts.length >= 2) strokeFeathered(ctx, applyFit(pts, tf), hand, glyph.pts.length)
  }, [glyph, seed, hand, playing, real, progressRef])

  // animated paint — redraw the path up to progress every frame while playing
  useEffect(() => {
    if (!playing || !real) return undefined
    const tf = glyphFitTransform(glyph.pts, PAD)
    let raf = 0
    const draw = () => {
      const ctx = prepCanvas(ref.current)
      const pts = revealGlyph(glyph, progressRef.current)
      if (pts.length >= 2) strokeFeathered(ctx, applyFit(pts, tf), hand, glyph.pts.length)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [playing, real, glyph, hand, progressRef])

  return <canvas ref={ref} style={{ width: W, height: H }} />
}
