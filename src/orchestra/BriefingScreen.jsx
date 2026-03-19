import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const BRIEFING_LINES = [
  "You're about to step inside your music.",
  "Hold your phone up. Move it. The sound follows.",
  "Close your eyes.",
]

const LINE_DURATION = 3 // seconds per line

// Conductor silhouette SVG — minimal amber-stroke figure from behind, arm raised
function ConductorSVG() {
  return (
    <svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: 0.8 }}
    >
      {/* Head */}
      <circle cx="100" cy="48" r="14" stroke="#D4A053" strokeWidth="2" />
      {/* Shoulders and torso */}
      <path
        d="M72 80 Q80 68 100 66 Q120 68 128 80 L124 130 Q112 134 100 135 Q88 134 76 130 Z"
        stroke="#D4A053"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Left arm (resting) */}
      <path
        d="M72 82 Q58 96 54 120 Q52 130 56 134"
        stroke="#D4A053"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Right arm (raised with baton) */}
      <path
        d="M128 82 Q142 70 148 44 Q150 38 154 32"
        stroke="#D4A053"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Baton */}
      <line x1="154" y1="32" x2="166" y2="14" stroke="#D4A053" strokeWidth="1.5" strokeLinecap="round" />
      {/* Sound waves / orchestra suggestion */}
      <path
        d="M40 160 Q70 148 100 150 Q130 148 160 160"
        stroke="#D4A053"
        strokeWidth="1"
        strokeOpacity="0.4"
        fill="none"
      />
      <path
        d="M30 174 Q65 158 100 162 Q135 158 170 174"
        stroke="#D4A053"
        strokeWidth="1"
        strokeOpacity="0.25"
        fill="none"
      />
      <path
        d="M20 188 Q60 170 100 174 Q140 170 180 188"
        stroke="#D4A053"
        strokeWidth="1"
        strokeOpacity="0.15"
        fill="none"
      />
    </svg>
  )
}

export default function BriefingScreen({ onComplete }) {
  const [visibleLines, setVisibleLines] = useState(0)
  const [showBegin, setShowBegin] = useState(false)
  const [dimming, setDimming] = useState(false)
  const completedRef = useRef(false)

  // Show lines one at a time, then show "begin" button
  useEffect(() => {
    const timers = []
    for (let i = 0; i < BRIEFING_LINES.length; i++) {
      timers.push(setTimeout(() => setVisibleLines(i + 1), i * LINE_DURATION * 1000))
    }
    // Show begin button after all lines
    const showAt = BRIEFING_LINES.length * LINE_DURATION + 2
    timers.push(setTimeout(() => setShowBegin(true), showAt * 1000))
    return () => timers.forEach(clearTimeout)
  }, [])

  // User taps "begin" — this is the critical user gesture for AudioContext
  const handleBegin = () => {
    if (completedRef.current) return
    setShowBegin(false)
    setDimming(true)

    // Dim to black over 3s, then complete
    setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 3000)
  }

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center select-none"
      style={{ position: 'relative', background: 'var(--bg)' }}
    >
      {/* Conductor illustration */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        style={{ marginBottom: 48 }}
      >
        <ConductorSVG />
      </motion.div>

      {/* Text lines */}
      <div className="text-center px-8" style={{ maxWidth: 360, minHeight: 120 }}>
        {BRIEFING_LINES.map((line, i) => (
          <motion.p
            key={i}
            className="font-serif mb-4"
            style={{
              fontSize: 'clamp(16px, 4vw, 22px)',
              color: 'var(--text)',
              lineHeight: 1.6,
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={i < visibleLines ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, ease: 'easeOut' }}
          >
            {line}
          </motion.p>
        ))}
      </div>

      {/* Begin button — user tap activates AudioContext on Android */}
      {showBegin && !dimming && (
        <motion.button
          className="font-serif"
          style={{
            position: 'absolute',
            bottom: 'max(80px, calc(24px + env(safe-area-inset-bottom, 0px)))',
            fontSize: '16px',
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '16px 32px',
            minHeight: '44px',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleBegin}
        >
          begin
        </motion.button>
      )}

      {/* Dim overlay */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#000000',
          pointerEvents: 'none',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: dimming ? 1 : 0 }}
        transition={{ duration: 3, ease: 'easeIn' }}
      />
    </div>
  )
}
