// src/phases/attunement/Rise.jsx
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'

// A build climbs over RISE_MS. The user swells (gesture size, read in the hook)
// and marks the peak down-stroke; the hook captures peak swell + ride/pull-back
// and writes Arousal on commit. We commit at the end of the build window.
const RISE_MS = 11000

export default function Rise({ onCommit, onAdvance, committed }) {
  const [progress, setProgress] = useState(0)
  const startRef = useRef(performance.now())
  const firedRef = useRef(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const p = Math.min(1, (performance.now() - startRef.current) / RISE_MS)
      setProgress(p)
      if (p >= 1 && !firedRef.current) { firedRef.current = true; onCommit() }
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onCommit])

  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1400)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  return (
    <div style={overlay}>
      <div style={cue}>it&rsquo;s building — give it room. mark the peak when it comes.</div>
      <motion.div
        aria-hidden
        style={{
          position: 'absolute', left: '50%', bottom: '22%', transform: 'translateX(-50%)',
          width: 10, borderRadius: 6, background: COLORS.scoreAmber,
        }}
        animate={{ height: 40 + progress * 220, opacity: 0.5 + progress * 0.5 }}
      />
    </div>
  )
}

const overlay = { position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none' }
const cue = { position: 'absolute', top: '14%', left: 0, right: 0, textAlign: 'center', fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 14, color: COLORS.inkCreamSecondary }
