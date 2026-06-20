// src/phases/attunement/LeanLift.jsx
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'

// Two presences L/R; the live balance (from the score hook's live ref) tints
// the field. Hold past the dwell threshold to commit. `live` is the hook's
// liveRef; `onCommit` writes taste + advances expansion; `onAdvance` moves on.
const HOLD_MS = 900

export default function LeanLift({ live, onCommit, onAdvance, committed }) {
  const [balance, setBalance] = useState(0)
  const holdStartRef = useRef(null)
  const firedRef = useRef(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const pan = live.current.pan
      const b = (pan - 0.5) * 2
      setBalance(b)
      // Auto-commit when the user holds a clear lean steady.
      if (!firedRef.current && Math.abs(b) > 0.55) {
        if (holdStartRef.current === null) holdStartRef.current = performance.now()
        else if (performance.now() - holdStartRef.current > HOLD_MS) {
          firedRef.current = true
          onCommit()
        }
      } else if (Math.abs(b) <= 0.45) {
        holdStartRef.current = null
      }
      if (!firedRef.current) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, onCommit])

  // After commit, give the room a beat then advance.
  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1400)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  const warmth = (balance + 1) / 2
  return (
    <div style={overlay}>
      <Presence side="left" active={balance < -0.2} label="austere · cold light" hue="#3fd5f0" />
      <Presence side="right" active={balance > 0.2} label="warm · hearth" hue={COLORS.scoreAmber} />
      <div style={{ ...cue, opacity: committed ? 0 : 0.7 }}>
        tilt toward the one that pulls — tilt forward for light, back for shadow
      </div>
      <motion.div aria-hidden style={tintBase} animate={{ opacity: 0.06 + warmth * 0.10 }} />
    </div>
  )
}

function Presence({ side, active, label, hue }) {
  return (
    <motion.div
      animate={{ scale: active ? 1.12 : 0.92, opacity: active ? 0.95 : 0.6 }}
      transition={{ duration: 0.4 }}
      style={{
        position: 'absolute', top: '50%', [side]: '8%', transform: 'translateY(-50%)',
        textAlign: 'center',
      }}
    >
      <div style={{
        width: 84, height: 84, borderRadius: '50%', margin: '0 auto',
        background: `radial-gradient(circle, ${hue}88, ${hue}11 70%)`,
        boxShadow: `0 0 40px ${hue}55`,
      }} />
      <div style={{ marginTop: 10, fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 12, color: COLORS.inkCreamSecondary }}>{label}</div>
    </motion.div>
  )
}

const overlay = { position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none' }
const cue = { position: 'absolute', top: '14%', left: 0, right: 0, textAlign: 'center', fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 14, color: COLORS.inkCreamSecondary, transition: 'opacity 0.6s' }
const tintBase = { position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 55%, ${COLORS.scoreAmber}, transparent 60%)` }
