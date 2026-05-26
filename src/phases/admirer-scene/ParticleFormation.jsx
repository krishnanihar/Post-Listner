import { useEffect, useRef } from 'react'
import { usePhoneMotion } from '../../hooks/usePhoneMotion.js'
import { subscribeMoments } from '../../lib/momentBus.js'
import { buildFlowerOfLifeTargets } from '../../lib/flowerOfLifeTargets.js'
import { stepParticle } from '../../lib/glyphPhysics.js'

// Particle overlay for the AdmirerScene3D: forms the same flower-of-life
// the MiddleShaderPlane draws, then fades out as release approaches 1 so
// the 3D plane becomes the persistent form. Mirrors BackgroundGlyph's
// physics + release-wave staging but targets the flower-of-life directly
// instead of a rasterised SVG tile.
//
// Coordinate space: glyphPhysics works in a ±50 origin-centered space; we
// scale points onto the screen so the flower (full diameter 4 * LATTICE_R
// = 40 units in that space) spans ~30% of the smaller viewport dimension —
// matching the visual size of MiddleShaderPlane's shader-rendered flower
// behind it.

const PARTICLE_COUNT = 800
const SCATTER_RADIUS = 70
const RELEASE_STAGGER_MS = 4
const PARTICLE_FADE_START = 0.7
const PARTICLE_FADE_END = 1.0
const PARTICLE_BASE_OPACITY = 0.55
const FLOWER_EXTENT_UNITS = 40
const FLOWER_EXTENT_SCREEN_FRAC = 0.30
const MAX_DPR = 2

export default function ParticleFormation() {
  const canvasRef = useRef(null)
  const releaseRef = useRef(0)
  const particlesRef = useRef(null)
  const readMotion = usePhoneMotion()

  useEffect(() => {
    const targets = buildFlowerOfLifeTargets(PARTICLE_COUNT)
    const particles = targets.map((t) => {
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
    for (let i = particles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[particles[i], particles[j]] = [particles[j], particles[i]]
    }
    particlesRef.current = particles
  }, [])

  useEffect(() => subscribeMoments((r) => { releaseRef.current = r }), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
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

    const inkColor = (getComputedStyle(canvas).getPropertyValue('--ink') || '').trim() || '#1C1814'
    const motionForce = { x: 0, y: 0 }
    let raf = 0
    let mounted = true
    let prevNow = performance.now()
    let lastReleasedCount = 0

    const frame = (now) => {
      if (!mounted) return
      const dtRaw = (now - prevNow) / 1000
      const dt = Math.max(0, Math.min(1 / 30, dtRaw))
      prevNow = now

      const particles = particlesRef.current
      if (!particles) {
        raf = requestAnimationFrame(frame)
        return
      }

      const release = releaseRef.current
      const targetReleasedCount = Math.floor(particles.length * release)
      if (targetReleasedCount > lastReleasedCount) {
        for (let i = lastReleasedCount; i < targetReleasedCount; i++) {
          if (!particles[i].releasedAt) {
            particles[i].releasedAt = now + (i - lastReleasedCount) * RELEASE_STAGGER_MS
          }
        }
        lastReleasedCount = targetReleasedCount
      }

      const m = readMotion()
      motionForce.x = m.pan == null ? 0 : (m.pan - 0.5) * 2
      motionForce.y = m.filterNorm == null ? 0 : (m.filterNorm - 0.5) * 2

      for (let i = 0; i < particles.length; i++) {
        stepParticle(particles[i], dt, motionForce, now)
      }

      let fade = 0
      if (release > PARTICLE_FADE_START) {
        fade = Math.min(1, (release - PARTICLE_FADE_START) / (PARTICLE_FADE_END - PARTICLE_FADE_START))
      }
      const particleOpacity = PARTICLE_BASE_OPACITY * (1 - fade)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)

      const minDim = Math.min(w, h)
      const ps = (minDim * FLOWER_EXTENT_SCREEN_FRAC) / FLOWER_EXTENT_UNITS
      const cxp = w / 2
      const cyp = h / 2

      ctx.fillStyle = colorWithAlpha(inkColor, particleOpacity)
      for (const p of particles) {
        const x = cxp + p.x * ps
        const y = cyp + p.y * ps
        ctx.beginPath()
        ctx.arc(x, y, 1.0, 0, Math.PI * 2)
        ctx.fill()
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
        zIndex: 2,
      }}
    />
  )
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
