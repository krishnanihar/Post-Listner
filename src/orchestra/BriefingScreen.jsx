import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS } from '../score/tokens'

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

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Paper variant="cream">
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
              stroke={COLORS.inkCreamSecondary}
              strokeWidth="0.4"
              strokeDasharray="2 4"
              opacity="0.35"
            />

            {/* Animated baton group — pivot around the handle (bottom-center) */}
            <motion.g
              animate={{
                rotate: [-22, 22, -22],
              }}
              transition={{
                duration: 4,        // 4-second arc cycle ≈ 60 BPM gesture
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: '0px 50px' }}
            >
              {/* Baton shaft — thin tapered line, ~80px long */}
              <line
                x1="0" y1="50"
                x2="0" y2="-30"
                stroke={COLORS.inkCream}
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Tip — small dot at the lighter end */}
              <circle cx="0" cy="-30" r="2" fill={COLORS.inkCream} />
              {/* Handle — slightly thicker, suggests grip */}
              <line
                x1="0" y1="50"
                x2="0" y2="42"
                stroke={COLORS.inkCream}
                strokeWidth="4"
                strokeLinecap="round"
              />
            </motion.g>
          </svg>
        </div>
      </Paper>

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
