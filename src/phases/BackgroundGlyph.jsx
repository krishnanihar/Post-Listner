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
// TWO COORDINATED LAYERS:
//
// 1. Scatter layer (canvas): short line-segment particles, scattered
//    across the canvas. Drift with phone motion when unreleased; ease
//    toward their chord-positions when released. As a path's particles
//    converge (form-progress 0.5→1.0) this layer's particles for THAT
//    path fade out.
//
// 2. Geometry layer (SVG): the actual source <path> elements with
//    stroke-dasharray/stroke-dashoffset. Initially invisible. As a
//    path's form-progress crosses 0.5, the dashoffset animates toward
//    0 (drawing the real curve). Final state = the source SVG exactly.
//
// form-progress per path = mean ease of all particles belonging to it.
//   - 0.0 → 0.5 : SVG invisible, particles at full opacity
//   - 0.5 → 1.0 : SVG draws in (dashoffset length→0), particles fade to 0
//   - 1.0        : SVG fully drawn, particles gone
//
// Release schedule:
//   - 10% released on mount (a faint hint of the form)
//   - Each new transcript line releases another ~7%
//   - Capped at 100%; never decreases
//
// Phone motion reactive: roll → x, pitch → y shifts the SCATTER cloud.
// Released particles are locked; unreleased ones drift. As more particles
// release the motion-reactive surface area shrinks.
//
// Color: var(--ink, currentColor) inherits the phase's theme contract.

const SCATTER_RADIUS = 60        // half-extent in tile-normalised units
const SETTLE_DURATION_MS = 1400
const MAX_RELEASED_INCREMENT_PER_TURN = 0.07
const INITIAL_RELEASED = 0.10
const SEGMENT_LENGTH_AT_REST_PX = 6

export default function BackgroundGlyph() {
  const canvasRef = useRef(null)
  const svgRef = useRef(null)
  const readMotion = usePhoneMotion()
  // data = { tileId, bbox, paths } from sampleTile — drives both layers.
  const [data, setData] = useState(null)
  // particlesRef holds flat particle list; each particle carries pathIdx.
  const particlesRef = useRef(null)
  const { transcript } = useSyncExternalStore(subscribeLiveSession, getLiveSession)

  // ── 1. MOUNT: pick tile, sample, build particle list ──────────────────
  useEffect(() => {
    let cancelled = false
    const tileId = pickRandomTileId()
    sampleTile(tileId).then(sampled => {
      if (cancelled) return
      // Materialise flat particle list; each particle remembers its pathIdx
      // so the render loop can accumulate per-path form-progress.
      const particles = []
      sampled.paths.forEach((pathData, pathIdx) => {
        for (const seg of pathData.segments) {
          const sx = (Math.random() - 0.5) * 2 * SCATTER_RADIUS
          const sy = (Math.random() - 0.5) * 2 * SCATTER_RADIUS
          const theta = Math.random() * Math.PI * 2
          const halfLen = SEGMENT_LENGTH_AT_REST_PX / 2
          const dx = Math.cos(theta) * halfLen
          const dy = Math.sin(theta) * halfLen
          particles.push({
            pathIdx,
            tx1: seg.x1, ty1: seg.y1,
            tx2: seg.x2, ty2: seg.y2,
            sx1: sx - dx, sy1: sy - dy,
            sx2: sx + dx, sy2: sy + dy,
            releasedAt: 0,
            phase: Math.random() * Math.PI * 2,
          })
        }
      })
      // Shuffle so the released subset isn't biased toward any one path.
      for (let i = particles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[particles[i], particles[j]] = [particles[j], particles[i]]
      }
      particlesRef.current = particles
      setData(sampled)
    }).catch(e => console.warn('[background-glyph] sampleTile failed', e))
    return () => { cancelled = true }
  }, [])

  // ── 2. RELEASE SCHEDULE: transcript turns → released fraction ─────────
  useEffect(() => {
    if (!particlesRef.current) return
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
        particles[i].releasedAt = now + i * 6 // stagger 6ms for cascading bloom
      }
    }
  }, [transcript.length, data])

  // ── 3. RENDER LOOP ─────────────────────────────────────────────────────
  // Canvas (scatter layer) + SVG dashoffsets (geometry layer).
  // TWO-PASS particle processing:
  //   Pass 1 — accumulate pathProgressSum[], stash per-particle render params.
  //   Pass 2 — compute formProgress per path, paint each particle with the
  //            correctly-faded opacity.
  useEffect(() => {
    if (!data || !particlesRef.current) return
    const canvas = canvasRef.current
    const svg = svgRef.current
    if (!canvas || !svg) return

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

    // Pre-grab SVG <path> elements — one per source path.
    const svgPaths = Array.from(svg.querySelectorAll('path'))

    const particles = particlesRef.current
    const numPaths = data.paths.length

    // Pre-compute per-path particle counts (constant for the life of the effect).
    const pathParticleCounts = new Array(numPaths).fill(0)
    for (const p of particles) pathParticleCounts[p.pathIdx]++

    // Per-frame stash for the two-pass render.
    // Each entry: [x1, y1, x2, y2, ease, pathIdx]
    const stash = new Array(particles.length)

    let raf = 0
    let mounted = true

    const frame = (now) => {
      if (!mounted) return
      const m = readMotion()
      const motionPanX = m.pan == null ? 0 : (m.pan - 0.5) * 2
      const motionPanY = m.filterNorm == null ? 0 : (m.filterNorm - 0.5) * 2
      const inkColor = getComputedStyle(canvas).getPropertyValue('--ink').trim() || '#1C1814'

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)

      const minDim = Math.min(w, h)
      const tileScale = (minDim * 0.62) / 100
      const cx = w / 2
      const cy = h / 2

      // ── Pass 1: accumulate form-progress, stash render params ─────────
      const pathProgressSum = new Array(numPaths).fill(0)

      for (let idx = 0; idx < particles.length; idx++) {
        const p = particles[idx]
        let x1, y1, x2, y2, ease

        if (p.releasedAt) {
          const t = Math.min(1, (now - p.releasedAt) / SETTLE_DURATION_MS)
          ease = 1 - Math.pow(1 - t, 3) // cubic ease-out
          x1 = p.sx1 + (p.tx1 - p.sx1) * ease
          y1 = p.sy1 + (p.ty1 - p.sy1) * ease
          x2 = p.sx2 + (p.tx2 - p.sx2) * ease
          y2 = p.sy2 + (p.ty2 - p.sy2) * ease
        } else {
          ease = 0
          const wobbleX = Math.sin(now * 0.0008 + p.phase) * 0.6
          const wobbleY = Math.cos(now * 0.0007 + p.phase) * 0.6
          const drift = 8
          x1 = p.sx1 + motionPanX * drift + wobbleX
          y1 = p.sy1 + motionPanY * drift + wobbleY
          x2 = p.sx2 + motionPanX * drift + wobbleX
          y2 = p.sy2 + motionPanY * drift + wobbleY
        }

        pathProgressSum[p.pathIdx] += ease
        stash[idx] = [x1, y1, x2, y2, ease, p.pathIdx]
      }

      // ── Pass 2: paint each particle, opacity informed by path progress ─
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      for (let idx = 0; idx < particles.length; idx++) {
        const [x1, y1, x2, y2, ease, pathIdx] = stash[idx]
        const count = pathParticleCounts[pathIdx]
        const formProgress = count > 0 ? pathProgressSum[pathIdx] / count : 0

        // Base opacity (0.18 unreleased → 0.60 settled).
        const baseOpacity = 0.18 + 0.42 * ease

        // Fade particles out as the path's SVG draws in (formProgress 0.5→1.0).
        // At formProgress ≥ 1.0, opacity is exactly 0.
        const fadeFactor = formProgress <= 0.5
          ? 1.0
          : Math.max(0, 1 - (formProgress - 0.5) * 2)

        const opacity = baseOpacity * fadeFactor
        if (opacity < 0.005) continue // skip invisible particles

        ctx.beginPath()
        ctx.moveTo(cx + x1 * tileScale, cy + y1 * tileScale)
        ctx.lineTo(cx + x2 * tileScale, cy + y2 * tileScale)
        ctx.lineWidth = 1.0
        ctx.strokeStyle = colorWithAlpha(inkColor, opacity)
        ctx.stroke()
      }

      // ── Geometry layer: update SVG dashoffsets ─────────────────────────
      for (let i = 0; i < numPaths; i++) {
        const count = pathParticleCounts[i]
        if (count === 0) continue
        const formProgress = pathProgressSum[i] / count
        const len = data.paths[i].length
        let drawAmount = 0
        if (formProgress > 0.5) {
          drawAmount = Math.min(1, (formProgress - 0.5) * 2)
        }
        const dashOffset = len * (1 - drawAmount)
        const svgPath = svgPaths[i]
        if (svgPath) {
          svgPath.setAttribute('stroke-dashoffset', String(dashOffset))
        }
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)

    return () => {
      mounted = false
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [data, readMotion])

  // ── Render: canvas (scatter) + SVG overlay (geometry) ─────────────────
  // The SVG uses viewBox="{bbox coords}" so source paths render with their
  // original coordinate system. CSS size is min(62vw,62vh) centred,
  // matching the canvas's tileScale = minDim*0.62/100. strokeWidth is in
  // SVG user-coords (bbox space); 0.35 keeps strokes ~1px at typical sizes.
  const viewBox = data
    ? `${data.bbox.x} ${data.bbox.y} ${data.bbox.width} ${data.bbox.height}`
    : '0 0 100 100'

  return (
    <>
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
      <svg
        ref={svgRef}
        aria-hidden
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 'min(62vw, 62vh)',
          height: 'min(62vw, 62vh)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 4,
          overflow: 'visible',
        }}
      >
        {data && data.paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke="var(--ink, currentColor)"
            strokeWidth="0.35"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={p.length}
            strokeDashoffset={p.length}
          />
        ))}
      </svg>
    </>
  )
}

// colorWithAlpha converts "#RRGGBB" → "rgba(r,g,b,a)".
// Falls back to a translucent dark for unrecognised formats.
function colorWithAlpha(color, alpha) {
  if (!color) return `rgba(28,24,20,${alpha})`
  const m = color.trim().match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${alpha})`
  }
  return color
}
