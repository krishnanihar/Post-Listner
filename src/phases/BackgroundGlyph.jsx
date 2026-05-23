import { useEffect, useRef, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { usePhoneMotion } from '../hooks/usePhoneMotion.js'
import { subscribeLiveSession, getLiveSession } from '../lib/liveSession.js'
import { sampleTile, pickRandomTileId } from '../lib/glyphSampler.js'

// A field of small line-segment particles that scatter at random across
// the canvas at first, and converge into a sacred-geometry pattern as
// the conversation progresses. Each particle's TARGET (settled) position
// + orientation is fixed at mount (one of 15 tile patterns picked at
// random per rite); the SCATTER (initial) position is randomised.
//
// Release schedule:
//   - 10% of particles are released on mount (a faint hint of the form)
//   - Each new transcript line (agent or user) releases another ~7%
//   - Capped at 100% after a generous number of turns; never decreases
//
// Phone motion reactive: roll → x, pitch → y shifts the SCATTER cloud
// (unreleased particles drift with the tilt). Released particles are
// locked in place and unaffected. As more particles release, the
// motion-reactive surface area shrinks — the world is settling into
// its shape under the conversation.
//
// Color: var(--ink, currentColor) inherits the phase's theme contract,
// so the same component reads correctly on the cream Admirer phase
// (dark ink) and the dark Orchestra phase (light cream).

const SCATTER_RADIUS = 60 // half-extent in % of canvas — wider than the tile
const SETTLE_DURATION_MS = 1400
const MAX_RELEASED_INCREMENT_PER_TURN = 0.07
const INITIAL_RELEASED = 0.10
const SEGMENT_LENGTH_AT_REST_PX = 6

export default function BackgroundGlyph() {
  const canvasRef = useRef(null)
  const readMotion = usePhoneMotion()
  const particlesRef = useRef(null)
  const [particlesReady, setParticlesReady] = useState(false)
  const { transcript } = useSyncExternalStore(subscribeLiveSession, getLiveSession)

  // One-shot sampling on mount: pick a tile, sample it, build particle list.
  useEffect(() => {
    let cancelled = false
    const tileId = pickRandomTileId()
    sampleTile(tileId).then(({ segments }) => {
      if (cancelled) return
      // Materialise particle state. Scatter positions are random; targets
      // come from the sampled segments. Each particle also has a random
      // "rotation seed" so its scatter orientation differs from target.
      const list = segments.map(seg => {
        // Random scatter centre + random angle, scattered across ±SCATTER_RADIUS.
        const sx = (Math.random() - 0.5) * 2 * SCATTER_RADIUS
        const sy = (Math.random() - 0.5) * 2 * SCATTER_RADIUS
        const theta = Math.random() * Math.PI * 2
        const halfLen = SEGMENT_LENGTH_AT_REST_PX / 2
        const dx = Math.cos(theta) * halfLen
        const dy = Math.sin(theta) * halfLen
        return {
          // Target (settled) endpoints — in tile-normalised coords (±50).
          tx1: seg.x1, ty1: seg.y1,
          tx2: seg.x2, ty2: seg.y2,
          // Scatter (initial) endpoints — in tile-normalised coords too.
          // Scaled radius keeps the particle visually similar in size.
          sx1: sx - dx, sy1: sy - dy,
          sx2: sx + dx, sy2: sy + dy,
          // Release state — set when this particle's release "arrives".
          releasedAt: 0,
          // Phase offset for subtle drift / shimmer.
          phase: Math.random() * Math.PI * 2,
        }
      })
      // Shuffle so the released subset isn't biased toward any one path.
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = list[i]; list[i] = list[j]; list[j] = tmp
      }
      particlesRef.current = list
      setParticlesReady(true)
    }).catch(e => console.warn('[background-glyph] sampleTile failed', e))
    return () => { cancelled = true }
  }, [])

  // Release scheduler: derive a target release ratio from transcript length.
  // Apply releasedAt timestamps when the ratio grows past each particle's
  // index threshold. Monotonic — once released, stays released.
  useEffect(() => {
    if (!particlesReady || !particlesRef.current) return
    const particles = particlesRef.current
    const turns = transcript.length
    const targetRatio = Math.min(
      1,
      INITIAL_RELEASED + turns * MAX_RELEASED_INCREMENT_PER_TURN
    )
    const targetReleasedCount = Math.floor(particles.length * targetRatio)
    const now = performance.now()
    for (let i = 0; i < targetReleasedCount; i++) {
      if (!particles[i].releasedAt) {
        particles[i].releasedAt = now + i * 6 // stagger by 6ms for a cascading bloom
      }
    }
  }, [transcript.length, particlesReady])

  // rAF render loop.
  useEffect(() => {
    if (!particlesReady) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let w = 0, h = 0
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let raf = 0
    let mounted = true
    // Read the ink colour from the CSS variable on the document — it's set
    // by App.jsx via inkForPhase(phase). Cached per frame.
    const frame = (now) => {
      if (!mounted) return
      const particles = particlesRef.current
      if (!particles) {
        raf = requestAnimationFrame(frame)
        return
      }
      const m = readMotion()
      const motionPanX = m.pan == null ? 0 : (m.pan - 0.5) * 2 // -1..1
      const motionPanY = m.filterNorm == null ? 0 : (m.filterNorm - 0.5) * 2
      const inkColor = getComputedStyle(canvas).getPropertyValue('--ink').trim() || 'currentColor'

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)

      // Map tile coords (±50) to canvas pixel coords. Use the larger of
      // viewport min-dimension and a min size so the glyph doesn't collapse
      // on tiny windows.
      const minDim = Math.min(w, h)
      const tileScale = (minDim * 0.62) / 100  // tile fills ~62% of min dimension
      const cx = w / 2
      const cy = h / 2

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      for (const p of particles) {
        let x1, y1, x2, y2, opacity
        if (p.releasedAt) {
          const t = Math.min(1, (now - p.releasedAt) / SETTLE_DURATION_MS)
          // Cubic ease-out
          const e = 1 - Math.pow(1 - t, 3)
          x1 = p.sx1 + (p.tx1 - p.sx1) * e
          y1 = p.sy1 + (p.ty1 - p.sy1) * e
          x2 = p.sx2 + (p.tx2 - p.sx2) * e
          y2 = p.sy2 + (p.ty2 - p.sy2) * e
          opacity = 0.18 + 0.42 * e  // unreleased: faint, settled: 0.6
        } else {
          // Unreleased: drift gently with phone motion + idle Brownian
          const drift = 8
          const wobbleX = Math.sin(now * 0.0008 + p.phase) * 0.6
          const wobbleY = Math.cos(now * 0.0007 + p.phase) * 0.6
          x1 = p.sx1 + motionPanX * drift + wobbleX
          y1 = p.sy1 + motionPanY * drift + wobbleY
          x2 = p.sx2 + motionPanX * drift + wobbleX
          y2 = p.sy2 + motionPanY * drift + wobbleY
          opacity = 0.18
        }
        // Paint
        ctx.beginPath()
        ctx.moveTo(cx + x1 * tileScale, cy + y1 * tileScale)
        ctx.lineTo(cx + x2 * tileScale, cy + y2 * tileScale)
        ctx.lineWidth = 1.0
        ctx.strokeStyle = colorWithAlpha(inkColor, opacity)
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
  }, [particlesReady, readMotion])

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

// Helpers — colorWithAlpha turns a "#RRGGBB" into "rgba(r,g,b,a)" with the
// requested alpha. Tolerant of currentColor / unknown shapes; falls back
// to a translucent dark.
function colorWithAlpha(color, alpha) {
  if (!color) return `rgba(28,24,20,${alpha})`
  const m = color.trim().match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${alpha})`
  }
  // Fallback for currentColor / rgb()
  return color
}
