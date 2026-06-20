// src/phases/attunement/Face.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'
import { archetypeRing } from '../../lib/archetypeRing.js'

// Six worlds ringed in front; turn to face one (relYaw, read in the hook).
// Hold facing past HOLD_MS to commit. The faced world brightens.
const HOLD_MS = 1100

export default function Face({ live, onCommit, onAdvance, committed }) {
  // useMemo (not a ref) — ring is read during render (ring.map below), and the
  // react-hooks compiler rule forbids reading ref.current in render. It's a
  // stable pure computation, so memoizing it once is the correct tool.
  const ring = useMemo(() => archetypeRing(), [])
  const [relYaw, setRelYaw] = useState(0)
  const holdRef = useRef(null)
  const firedRef = useRef(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const y = live.current.relYaw
      setRelYaw(y)
      if (!firedRef.current) {
        if (holdRef.current === null) holdRef.current = performance.now()
        else if (performance.now() - holdRef.current > HOLD_MS) { firedRef.current = true; onCommit() }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, onCommit])

  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1600)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  return (
    <div style={overlay}>
      <div style={cue}>turn to face the one that feels like home.</div>
      {ring.map((r) => {
        const prox = Math.max(0, 1 - Math.abs(r.azimuthDeg - relYaw) / 60)
        return (
          <motion.div
            key={r.id}
            animate={{ opacity: 0.3 + prox * 0.7, scale: 0.85 + prox * 0.3 }}
            style={{
              position: 'absolute', top: '46%',
              left: `${50 + (r.azimuthDeg / 75) * 40}%`, transform: 'translate(-50%,-50%)',
              width: 56, height: 56, borderRadius: '50%',
              background: `radial-gradient(circle, ${COLORS.scoreAmber}99, transparent 70%)`,
            }}
          />
        )
      })}
    </div>
  )
}

const overlay = { position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none' }
const cue = { position: 'absolute', top: '14%', left: 0, right: 0, textAlign: 'center', fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 14, color: COLORS.inkCreamSecondary }
