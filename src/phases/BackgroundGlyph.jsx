import { useEffect, useRef, useState } from 'react'
import { usePhoneMotion } from '../hooks/usePhoneMotion.js'
import { rasterizeTile, pickRandomTileId } from '../lib/glyphRasterizer.js'
import { subscribeMoments } from '../lib/momentBus.js'
import { stepParticle } from '../lib/glyphPhysics.js'

// v3 — image-to-particles with force-field physics + editorial-moment bursts.
//
// On mount: pick a random tile, rasterise it to an offscreen canvas at
// 320×320, extract up to PARTICLE_BUDGET (800) active-pixel target
// positions, and seed one particle per target with a random scatter.
//
// Per frame (rAF): each particle is stepped through glyphPhysics — a
// velocity-Verlet style integrator with spring-to-target (released) /
// spring-to-scatter (un-released), a motion-driven force vector
// (settled particles couple ~10× weaker so the formed geometry breathes
// without dissolving), and damping.
//
// Release ratio comes from momentBus. ALL dispatches happen in Admirer.jsx
// (mount, recordLexicon, fragment rated, startGeneration, AND the
// transcript watcher for agent questions + user turns). This component
// is a pure renderer: subscribe → render. It NEVER calls fireMoment.
//
// Particles are shuffled at mount; the first `floor(release * N)` are
// released. Each newly-released particle gets a staggered `releasedAt`
// so the visual is a *wave*, not a step.
//
// SVG fade-in overlay: the original source tile's <path> elements are
// rendered with their original fills, at opacity that ramps from 0 to 1
// over the final 30% of release progress. At release = 1, particles
// fade out + SVG is fully visible → exact source fidelity. Fidelity is
// guaranteed by the overlay, NOT by the particle stipple.
//
// Perf:
//   - DPR capped at 2 (a 3× DPR phone with 800 particles + per-frame
//     paint would otherwise spend most of its budget filling pixels).
//   - motionForce object hoisted out of the rAF body; its x/y fields
//     are mutated per frame so the loop allocates nothing.
//   - inkColor is read once on mount via getComputedStyle (it would be
//     a forced-layout read per-frame otherwise). The Admirer phase's
//     `--ink` is set by App.jsx and doesn't change while the phase is
//     mounted, so caching is safe.
//
// Color: var(--ink, currentColor) inherits the phase's theme contract.

const SCATTER_RADIUS = 70 // half-extent in tile-normalised units
const RELEASE_STAGGER_MS = 4
const SVG_FADE_IN_START = 0.7  // release ratio at which SVG opacity > 0
const SVG_FADE_IN_END = 1.0    // release ratio at which SVG opacity = 1
const SVG_FADE_DURATION_S = 0.5  // ease time for the SVG opacity to track a release-ratio change
const PARTICLE_BASE_OPACITY = 0.45
const MAX_DPR = 2

export default function BackgroundGlyph() {
  const canvasRef = useRef(null)
  const svgNodeRef = useRef(null)               // NEW
  const animatedSvgOpacityRef = useRef(0)       // NEW
  const releaseRatioRef = useRef(0)             // NEW
  const { read: readMotion } = usePhoneMotion()
  const [data, setData] = useState(null)
  const [releaseRatio, setReleaseRatio] = useState(0)
  const particlesRef = useRef(null)

  // ── 1. MOUNT: pick tile, rasterise, build particle list ───────────────
  useEffect(() => {
    let cancelled = false
    const tileId = pickRandomTileId()
    rasterizeTile(tileId).then(result => {
      if (cancelled) return
      // Build particle list from targets. Scatter positions are random
      // within SCATTER_RADIUS. Velocity starts at 0.
      const particles = result.targets.map(t => {
        const sx = (Math.random() - 0.5) * 2 * SCATTER_RADIUS
        const sy = (Math.random() - 0.5) * 2 * SCATTER_RADIUS
        return {
          x: sx, y: sy,
          vx: 0, vy: 0,
          tx: t.x, ty: t.y,
          sx, sy,
          releasedAt: 0,
        }
      })
      // Shuffle so the released subset is uniformly random across the form.
      for (let i = particles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[particles[i], particles[j]] = [particles[j], particles[i]]
      }
      particlesRef.current = particles
      setData(result)
    }).catch(e => console.warn('[background-glyph] rasterizeTile failed', e))
    return () => { cancelled = true }
  }, [])

  // ── 2. Subscribe to momentBus for the release ratio ───────────────────
  useEffect(() => {
    return subscribeMoments(setReleaseRatio)
  }, [])

  // Mirror releaseRatio into a ref so the rAF loop reads the current value
  // without re-running on every momentBus fire. Each fire would otherwise
  // tear down + rebuild the rAF loop and the ResizeObserver.
  useEffect(() => {
    releaseRatioRef.current = releaseRatio
  }, [releaseRatio])

  // ── 3. Stage particle releases as release ratio grows ─────────────────
  useEffect(() => {
    if (!particlesRef.current) return
    const particles = particlesRef.current
    const targetReleasedCount = Math.floor(particles.length * releaseRatio)
    const now = performance.now()
    for (let i = 0; i < targetReleasedCount; i++) {
      if (!particles[i].releasedAt) {
        // Cascade by RELEASE_STAGGER_MS so the burst is a visible wave.
        particles[i].releasedAt = now + i * RELEASE_STAGGER_MS
      }
    }
  }, [releaseRatio, data])

  // ── 4. RENDER LOOP ─────────────────────────────────────────────────────
  // Hoists every per-frame allocation outside the loop body.
  useEffect(() => {
    if (!data || !particlesRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
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

    // Cache ink color once on mount. The Admirer phase's `--ink` is set
    // by App.jsx and doesn't change while mounted — re-reading via
    // getComputedStyle every frame would force a layout per frame.
    const inkColor = (getComputedStyle(canvas).getPropertyValue('--ink') || '').trim() || '#1C1814'

    // Hoisted motion-force object — its fields are mutated each frame.
    const motionForce = { x: 0, y: 0 }

    const particles = particlesRef.current
    let raf = 0
    let mounted = true
    let prevNow = performance.now()

    const frame = (now) => {
      if (!mounted) return
      // Cap dt so a stalled tab doesn't fire a huge integration step.
      const dtRaw = (now - prevNow) / 1000
      const dt = Math.max(0, Math.min(1 / 30, dtRaw))
      prevNow = now

      const m = readMotion()
      motionForce.x = m.pan == null ? 0 : (m.pan - 0.5) * 2
      motionForce.y = m.filterNorm == null ? 0 : (m.filterNorm - 0.5) * 2

      // Step physics for every particle.
      for (let i = 0; i < particles.length; i++) {
        stepParticle(particles[i], dt, motionForce, now)
      }

      // Ease the SVG opacity toward its target from releaseRatio. Both the
      // canvas particle fade and the SVG overlay opacity are driven by this
      // single eased value — one clock, no sync gap between layers.
      const svgOpacityTarget = svgOpacityForRelease(releaseRatioRef.current)
      const easeRate = dt / SVG_FADE_DURATION_S
      const cur = animatedSvgOpacityRef.current
      const delta = svgOpacityTarget - cur
      animatedSvgOpacityRef.current = cur + delta * Math.min(1, easeRate * 8)
      // ↑ exponential ease toward target — converges in ~0.5s for a step
      //   change. The * 8 factor is tuned empirically so a step from 0→1
      //   reaches ~95% in 500ms; it matches Motion's easeOut feel.
      const svgOpacity = animatedSvgOpacityRef.current
      const particleOpacity = PARTICLE_BASE_OPACITY * (1 - svgOpacity)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)

      const minDim = Math.min(w, h)
      const tileScale = (minDim * 0.62) / 100
      const cxp = w / 2
      const cyp = h / 2

      ctx.fillStyle = colorWithAlpha(inkColor, particleOpacity)
      for (const p of particles) {
        const x = cxp + p.x * tileScale
        const y = cyp + p.y * tileScale
        ctx.beginPath()
        ctx.arc(x, y, 1.0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Drive the SVG opacity from the same eased value as the canvas fade.
      if (svgNodeRef.current) {
        svgNodeRef.current.style.opacity = String(svgOpacity)
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
        ref={svgNodeRef}
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
          color: 'var(--ink, currentColor)',
          opacity: 0,  // initial; rAF loop drives the live value
        }}
      >
        {/* All source paths use a single near-black fill (#231F20) in the
            source SVG. fill="currentColor" intentionally discards the source
            color so the overlay inherits the phase's theme ink via var(--ink)
            — keeps the sacred-geometry rendering on-theme for both cream and
            dark phases. The source's per-path `fill` value lives in p.fill
            if multi-color tiles are ever added; currently unused. */}
        {data && data.pathElements.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill="currentColor"
            fillRule={p.fillRule}
          />
        ))}
      </svg>
    </>
  )
}

function svgOpacityForRelease(r) {
  if (r <= SVG_FADE_IN_START) return 0
  if (r >= SVG_FADE_IN_END) return 1
  return (r - SVG_FADE_IN_START) / (SVG_FADE_IN_END - SVG_FADE_IN_START)
}

function colorWithAlpha(color, alpha) {
  if (alpha <= 0) return 'rgba(0,0,0,0)'
  if (!color) return `rgba(28,24,20,${alpha})`
  const m = color.trim().match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${alpha})`
  }
  return color
}
