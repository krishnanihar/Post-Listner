import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, NOCTURNE } from '../score/tokens'
import { NOCTURNE_ENABLED } from '../world/flags.js'

// Nocturne (canon §6) — on the dark stage the baton becomes the Trace damping to
// a still cursor over the same silent 12s (a settling sweep, not a scale — the
// SVG <g> scale trap is avoided by damping the rotation amplitude toward 0).
const N = NOCTURNE_ENABLED
const INK = N ? NOCTURNE.candle : COLORS.inkCream
const ARC_INK = N ? NOCTURNE.candle : COLORS.inkCreamSecondary
const ARC_OPACITY = N ? 0.22 : 0.35
// Damping keyframes settle the sweep to a held point; shipped path is the
// original infinite ±22° arc.
const BATON_ROTATE = N ? [-22, 22, -18, 18, -13, 13, -7, 7, -3, 3, 0] : [-22, 22, -22]

/**
 * Orchestra v3 BriefingScreen — silent threshold rite.
 *
 * 12 s total. Cream paper with an animated baton silhouette in slow
 * conductor's-arc motion. Around 8 s in the screen begins darkening; by
 * 12 s it's fully dark and the song begins materializing through Bloom.
 *
 * No text, no voice. Per the brief, the gesture vocabulary is discovered
 * proprioceptively — the baton just suggests "this is what you're holding."
 */
export default function BriefingScreen({ onComplete, durationMs = 12000 }) {
  const [blackOverlay, setBlackOverlay] = useState(0)
  const completedRef = useRef(false)

  useEffect(() => {
    const timers = []
    const t = (ms, fn) => timers.push(setTimeout(fn, ms))

    // Two-stage darkening so the threshold feels deliberate, not abrupt.
    // ~67% of the way → soft dim; final 17% → full black.
    t(Math.round(durationMs * 0.67), () => setBlackOverlay(0.55))
    t(Math.round(durationMs * 0.83), () => setBlackOverlay(1.0))
    t(durationMs, () => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    })

    return () => timers.forEach(clearTimeout)
  }, [onComplete, durationMs])

  const batonTransition = N
    ? { duration: durationMs / 1000, ease: 'easeInOut' } // one settling sweep
    : { duration: 4, repeat: Infinity, ease: 'easeInOut' } // 4s arc ≈ 60 BPM

  const inner = (
    <>
      {/* Centered baton in slow conductor's-arc motion */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg
          viewBox="-100 -100 200 200"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: 240, height: 240 }}
        >
          {/* Faint arc-path hint — suggests the gesture envelope */}
          <ellipse
            cx="0" cy="0" rx="60" ry="36"
            fill="none"
            stroke={ARC_INK}
            strokeWidth="0.4"
            strokeDasharray="2 4"
            opacity={ARC_OPACITY}
          />

          {/* Animated baton group — pivot around the handle (bottom-center) */}
          <motion.g
            animate={{ rotate: BATON_ROTATE }}
            transition={batonTransition}
            style={{ transformOrigin: '0px 50px' }}
          >
            {/* Baton shaft — thin tapered line, ~80px long */}
            <line
              x1="0" y1="50"
              x2="0" y2="-30"
              stroke={INK}
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Tip — small dot at the lighter end */}
            <circle cx="0" cy="-30" r="2" fill={INK} />
            {/* Handle — slightly thicker, suggests grip */}
            <line
              x1="0" y1="50"
              x2="0" y2="42"
              stroke={INK}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </motion.g>
        </svg>
      </div>
    </>
  )

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Nocturne — the baton sits on the dark stage (the WorldStage colour), so
          Briefing is continuous with the world; shipped path keeps cream paper. */}
      {N ? (
        <div style={{ position: 'absolute', inset: 0, background: NOCTURNE.stageBlack }}>{inner}</div>
      ) : (
        <Paper variant="cream">{inner}</Paper>
      )}

      {/* Dim-to-black overlay — final threshold into the spatial bed */}
      <motion.div
        style={{
          position: 'absolute', inset: 0,
          background: COLORS.paperPureBlack,
          pointerEvents: 'none',
        }}
        animate={{ opacity: blackOverlay }}
        transition={{
          duration: blackOverlay <= 0.55 ? 2 : 1.2,
          ease: 'easeIn',
        }}
      />
    </div>
  )
}
