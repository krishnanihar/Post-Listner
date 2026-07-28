import { useEffect, useRef, useState } from 'react'
import { getAllSessions } from '../lib/archive.js'
import { buildOwnConstellation, buildMockCollective } from '../lib/constellationLayout.js'
import { lampColor } from '../world/lightField.js'
import { breath } from '../lib/motionGrammar.js'
import { prefersReducedMotion } from '../lib/reducedMotion.js'
import { NOCTURNE, FONTS } from '../score/tokens.js'
import { playSfx } from '../world/worldSound.js'

// Nocturne — the constellation (canon §6). The Coda's optional third surface:
// the dark stage fills with anonymized taste-lights. The listener's own sessions
// glow warm-amber (from the LOCAL archive — nothing leaves the device); a mock
// collective is a dim, scattered haze. VIEW-ONLY, opt-in, exits on touch. No
// names, no numbers (Invariant 3); no streaks or return mechanics (Invariant 4).
//
// Own stars carry a gentle breath (reduced-motion → still). The collective is
// painted once (static). The room's copy is a witness line, not a disclosure —
// it names the haze as imagined without claiming reality; the fuller "what's
// real" honesty lives in the portfolio + docs (src/statement/Statement.jsx).
// Perf: DPR cap 2, own-star gradients are cached; the haze is flat dots.

const MAX_DPR = 2

// How long after the field opens the Prompter's line lands, so the night-air
// cue and the voice read as a sequence rather than a stack.
const CONSTELLATION_LINE_DELAY_MS = 1200

export default function Constellation({ onExit }) {
  const canvasRef = useRef(null)
  const [own, setOwn] = useState([])
  const [visible, setVisible] = useState(false) // drives a CSS opacity fade-in
  const collectiveRef = useRef(buildMockCollective(140))

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    playSfx('constellation-open', { volume: 0.4 }) // night air opening (canon §5)
    // …and the Prompter's one honest line over it (canon §8): "others are
    // practicing too. none of them are named." Delayed so it lands after the
    // night air has opened rather than under it. Plain HTMLAudioElement — the
    // Coda has no HRTF room, and the session has had audio + user gesture
    // throughout, so autoplay is permitted. Fail-silent, like every other line.
    let voice = null
    const t = setTimeout(() => {
      try {
        voice = new Audio('/admirer/voice/constellation-line.mp3')
        voice.volume = 0.85
        voice.play().catch(() => { /* autoplay blocked or clip absent */ })
      } catch { /* no Audio */ }
    }, CONSTELLATION_LINE_DELAY_MS)
    return () => {
      cancelAnimationFrame(id)
      clearTimeout(t)
      try { voice?.pause() } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getAllSessions()
      .then((sessions) => { if (!cancelled) setOwn(buildOwnConstellation(sessions || [])) })
      .catch(() => { /* no archive → own sky is empty, the field still shows */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const reduced = prefersReducedMotion()
    let w = 0
    let h = 0
    let starGrads = null // per-star cached gradients; rebuilt on resize or when the star list changes
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      starGrads = null
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let raf = 0
    let mounted = true
    const frame = (now) => {
      if (!mounted) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = NOCTURNE.stageBlack
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'screen'

      // Collective haze — flat, dim, cool dots (static; cheap).
      const haze = collectiveRef.current
      const cool = lampColor(0.35)
      for (let i = 0; i < haze.length; i++) {
        const p = haze[i]
        ctx.fillStyle = `rgba(${cool.r},${cool.g},${cool.b},${p.brightness})`
        ctx.beginPath()
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 1.4 * dpr, 0, Math.PI * 2)
        ctx.fill()
      }

      // Own stars — warmer, breathing glows. Gradient objects are cached per star
      // (rebuilt only on resize / when the star list changes); the frame-to-frame
      // breath modulates via globalAlpha instead of rebuilding the gradient.
      const stars = own
      if (!starGrads || starGrads.length !== stars.length) {
        starGrads = stars.map((s) => {
          const col = lampColor(s.warmth)
          const x = s.x * canvas.width
          const y = s.y * canvas.height
          const r = (5 + s.brightness * 8) * dpr
          const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6)
          grad.addColorStop(0, `rgba(${col.r},${col.g},${col.b},1)`)
          grad.addColorStop(1, `rgba(${col.r},${col.g},${col.b},0)`)
          return { grad, x, y, r, col }
        })
      }
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]
        const { grad, x, y, r, col } = starGrads[i]
        const b = reduced ? 1 : 1 + 0.25 * breath(now, { hz: 0.08, amp: 1, phase: i, reduced })
        const bright = Math.min(1, s.brightness * b)
        ctx.globalAlpha = bright
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
        ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${Math.min(1, bright + 0.2)})`
        ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, r * 0.35), 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { mounted = false; cancelAnimationFrame(raf); ro.disconnect() }
  }, [own])

  return (
    <div
      onClick={onExit}
      onTouchStart={onExit}
      style={{
        position: 'absolute', inset: 0, background: NOCTURNE.stageBlack,
        cursor: 'pointer', zIndex: 30,
        opacity: visible ? 1 : 0, transition: 'opacity 1.2s ease',
      }}
    >
      <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 'max(40px, env(safe-area-inset-bottom))',
        textAlign: 'center', padding: '0 32px', pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 13, letterSpacing: 0.4,
          color: 'rgba(232, 228, 221, 0.7)',
        }}>
          a rehearsal of the others — for now, imagined.
        </div>
        <div style={{
          fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
          color: 'rgba(232, 228, 221, 0.3)', marginTop: 14,
        }}>
          touch to return
        </div>
      </div>
    </div>
  )
}
