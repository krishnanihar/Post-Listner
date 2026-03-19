import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const BRIEFING_LINES = [
  "You're about to step inside your music.",
  "Hold your phone up. Move it. The sound follows.",
  "Close your eyes.",
]

const LINE_DURATION = 3 // seconds per line
const HOLD_AFTER_LAST = 3 // seconds to hold after last line
const DIM_DURATION = 4 // seconds for screen to dim

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
      <circle cx="100" cy="48" r="14" stroke="#D4A053" strokeWidth="2" />
      <path
        d="M72 80 Q80 68 100 66 Q120 68 128 80 L124 130 Q112 134 100 135 Q88 134 76 130 Z"
        stroke="#D4A053" strokeWidth="2" strokeLinejoin="round"
      />
      <path d="M72 82 Q58 96 54 120 Q52 130 56 134" stroke="#D4A053" strokeWidth="2" strokeLinecap="round" />
      <path d="M128 82 Q142 70 148 44 Q150 38 154 32" stroke="#D4A053" strokeWidth="2" strokeLinecap="round" />
      <line x1="154" y1="32" x2="166" y2="14" stroke="#D4A053" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M40 160 Q70 148 100 150 Q130 148 160 160" stroke="#D4A053" strokeWidth="1" strokeOpacity="0.4" fill="none" />
      <path d="M30 174 Q65 158 100 162 Q135 158 170 174" stroke="#D4A053" strokeWidth="1" strokeOpacity="0.25" fill="none" />
      <path d="M20 188 Q60 170 100 174 Q140 170 180 188" stroke="#D4A053" strokeWidth="1" strokeOpacity="0.15" fill="none" />
    </svg>
  )
}

export default function BriefingScreen({ onComplete }) {
  const [visibleLines, setVisibleLines] = useState(0)
  const [dimming, setDimming] = useState(false)
  const completedRef = useRef(false)

  useEffect(() => {
    const timers = []

    // Show lines one at a time
    for (let i = 0; i < BRIEFING_LINES.length; i++) {
      timers.push(setTimeout(() => setVisibleLines(i + 1), i * LINE_DURATION * 1000))
    }

    // Start dimming after last line + hold
    const dimStart = BRIEFING_LINES.length * LINE_DURATION + HOLD_AFTER_LAST
    timers.push(setTimeout(() => setDimming(true), dimStart * 1000))

    // Complete after dim finishes
    const totalTime = dimStart + DIM_DURATION
    timers.push(setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, totalTime * 1000))

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center select-none"
      style={{ position: 'relative', background: 'var(--bg)' }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        style={{ marginBottom: 48 }}
      >
        <ConductorSVG />
      </motion.div>

      <div className="text-center px-8" style={{ maxWidth: 360, minHeight: 120 }}>
        {BRIEFING_LINES.map((line, i) => (
          <motion.p
            key={i}
            className="font-serif mb-4"
            style={{ fontSize: 'clamp(16px, 4vw, 22px)', color: 'var(--text)', lineHeight: 1.6 }}
            initial={{ opacity: 0, y: 8 }}
            animate={i < visibleLines ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, ease: 'easeOut' }}
          >
            {line}
          </motion.p>
        ))}
      </div>

      {/* Dim overlay — auto-advances, no button */}
      <motion.div
        style={{ position: 'absolute', inset: 0, background: '#000000', pointerEvents: 'none' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: dimming ? 1 : 0 }}
        transition={{ duration: DIM_DURATION, ease: 'easeIn' }}
      />
    </div>
  )
}
