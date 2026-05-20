import { useEffect, useRef } from 'react'
import { usePhoneMotion } from '../hooks/usePhoneMotion.js'

// A calm, peripheral glyph: a faint ink trail that forms from the phone's
// orientation. Part of Build B — ignorable by design (pointer-events: none,
// low opacity). The tapered-trail idea is borrowed from conductor-glb's
// ConductorCelestialField, much simplified: one fading stroke, no geometry,
// no audio reactivity. The cursor is roll (pan) → x, pitch (filterNorm) → y.
const TRACE_LIFE_MS = 4200
const MAX_POINTS = 160

export default function GlyphCanvas() {
  const canvasRef = useRef(null)
  const readMotion = usePhoneMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let w = 0
    let h = 0

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const trace = []
    const cursor = { x: 0, y: 0, init: false }
    let raf = 0
    let mounted = true

    const frame = () => {
      if (!mounted) return
      const now = performance.now()
      const m = readMotion()

      // roll (pan, 0..1) → x; pitch (filterNorm, 0..1) → y. Gentle: the
      // cursor reaches ±40% of the surface from centre at full tilt.
      const pan = m.pan == null ? 0.5 : m.pan
      const tilt = m.filterNorm == null ? 0.5 : m.filterNorm
      const tx = w / 2 + (pan - 0.5) * 2 * (w * 0.4)
      const ty = h / 2 + (tilt - 0.5) * 2 * (h * 0.4)
      if (!cursor.init) {
        cursor.x = tx
        cursor.y = ty
        cursor.init = true
      }
      cursor.x += (tx - cursor.x) * 0.18
      cursor.y += (ty - cursor.y) * 0.18

      const last = trace[trace.length - 1]
      if (!last || Math.hypot(cursor.x - last.x, cursor.y - last.y) > 1.5) {
        trace.push({ x: cursor.x, y: cursor.y, t: now })
      }
      while (trace.length && now - trace[0].t > TRACE_LIFE_MS) trace.shift()
      if (trace.length > MAX_POINTS) trace.splice(0, trace.length - MAX_POINTS)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (let i = 1; i < trace.length; i++) {
        const p0 = trace[i - 1]
        const p1 = trace[i]
        const life = 1 - (now - p1.t) / TRACE_LIFE_MS
        if (life <= 0) continue
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.lineWidth = 0.6 + life * 2.0
        ctx.strokeStyle = `rgba(150, 120, 70, ${life * 0.16})`
        ctx.stroke()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      mounted = false
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [readMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  )
}
