// src/phases/attunement/Listen.jsx
// The listen beat — a tilt-driven slider on the PITCH axis (the vertical mirror
// of the lean). A fragment of a world plays; tilting the phone forward/back
// moves a cursor on a vertical track between "open · bright" (tilt BACK) and
// "inward · dark" (tilt FORWARD) and audibly opens/closes the sound — matching
// the Orchestra (beta → filter cutoff, forward tilt darkens), so the gesture
// transfers. It writes the Depth axis of taste. Lean past the brink to lock.
// Commit logic is the same reviewed brink-crossing path as LeanLift; only the
// axis (filterNorm) + visuals differ.
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'
import { isBrinkCrossing, LEAN_BRINK } from '../../lib/leanCommit.js'

const TRACK_HALF = 38                          // cursor travels ±this % of track height
const BRINK_PCT = 50 + LEAN_BRINK * TRACK_HALF // where the "lock" ticks sit

// `live` is the score hook's liveRef (live.current.filterNorm ∈ [0,1] from pitch).
// onCommit(capturedFilterNorm) writes Depth; onAdvance moves on once committed.
export default function Listen({ live, onCommit, onAdvance, committed }) {
  const [rb, setRb] = useState(0)     // rendered balance ∈ [-1,1] → cursor pos
  const [fired, setFired] = useState(false)
  const [side, setSide] = useState(0) // committed side: -1 open / +1 inward
  const initRef = useRef(false)
  const prevBRef = useRef(0)
  const firedRef = useRef(false)
  const rbRef = useRef(0)
  const sideRef = useRef(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const fn = live.current.filterNorm
      const b = (fn - 0.5) * 2
      if (!firedRef.current) {
        if (!initRef.current) {
          // First frame: seed prevB with the resting pitch WITHOUT testing, so
          // an already-tilted phone never auto-commits on entry.
          initRef.current = true
        } else if (isBrinkCrossing({ b, prevB: prevBRef.current })) {
          firedRef.current = true
          sideRef.current = Math.sign(b)
          setFired(true)
          setSide(Math.sign(b))
          onCommit(fn)
        }
        prevBRef.current = b
        rbRef.current = b
        setRb(b)
      } else {
        const target = sideRef.current || 0
        rbRef.current += (target - rbRef.current) * 0.14
        setRb(rbRef.current)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, onCommit])

  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1100)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  const b = Math.max(-1, Math.min(1, rb))
  const openHeat = b > 0 ? Math.min(1, b / LEAN_BRINK) : 0     // tilt back → open/bright (top)
  const inwardHeat = b < 0 ? Math.min(1, -b / LEAN_BRINK) : 0  // tilt forward → inward/dark (bottom)
  const cursorTopPct = 50 - b * TRACK_HALF                     // forward (b<0) → down/inward

  return (
    <div style={overlay}>
      <div style={prompt}>open it up, or draw it close?</div>

      <div style={sliderWrap}>
        <PoleLabel text="open · bright" place="top" heat={openHeat} />

        <div style={trackWrap}>
          <div style={track} />
          <div style={{ ...tick, top: `${100 - BRINK_PCT}%` }} />
          <div style={{ ...tick, top: `${BRINK_PCT}%` }} />
          <div
            style={{
              ...cursor,
              top: `${cursorTopPct}%`,
              transition: fired ? 'top 0.5s cubic-bezier(0.22,1,0.36,1)' : 'none',
              boxShadow: `0 0 ${8 + Math.max(openHeat, inwardHeat) * 16}px ${COLORS.scoreAmber}`,
            }}
          />
          {fired && (
            <motion.div
              aria-hidden
              initial={{ opacity: 0.6, scale: 0.5 }}
              animate={{ opacity: 0, scale: 2.2 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              style={{
                position: 'absolute', left: '50%',
                top: `${50 - side * TRACK_HALF}%`,
                width: 24, height: 24, marginLeft: -12, marginTop: -12,
                borderRadius: '50%', border: `1px solid ${COLORS.scoreAmber}`,
              }}
            />
          )}
        </div>

        <PoleLabel text="inward · dark" place="bottom" heat={inwardHeat} />
      </div>

      <div style={hintWrap}>
        <PhoneNodHint dimmed={fired} />
        <div style={{ ...affordance, opacity: fired ? 0 : 0.75 }}>
          tilt back to open it, forward to draw it close
        </div>
      </div>
    </div>
  )
}

function PoleLabel({ text, place, heat }) {
  return (
    <div style={{
      fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 15,
      color: heat > 0.15 ? COLORS.inkCream : COLORS.inkCreamSecondary,
      opacity: 0.5 + heat * 0.5,
      transition: 'opacity 0.25s, color 0.25s',
      textAlign: 'center',
      marginTop: place === 'bottom' ? 10 : 0,
      marginBottom: place === 'top' ? 10 : 0,
    }}>
      {text}
    </div>
  )
}

// A phone that nods forward↔back to demonstrate the pitch tilt.
function PhoneNodHint({ dimmed }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      opacity: dimmed ? 0 : 0.55, transition: 'opacity 0.5s',
    }}>
      <span style={arrow}>‹</span>
      <motion.div
        aria-hidden
        animate={{ rotate: [-12, 12, -12], y: [-2, 2, -2] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 50, height: 30, borderRadius: 7,
          border: `1.5px solid var(--ink, ${COLORS.inkCream})`,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          paddingRight: 5,
        }}
      >
        <div style={{ width: 1.5, height: 9, borderRadius: 1, background: 'var(--ink, currentColor)', opacity: 0.6 }} />
      </motion.div>
      <span style={arrow}>›</span>
    </div>
  )
}

const overlay = {
  position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: 36, padding: '0 28px',
}
const prompt = {
  fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 19,
  color: 'var(--ink, currentColor)', textAlign: 'center', opacity: 0.9,
}
const sliderWrap = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
}
const trackWrap = {
  position: 'relative', width: 12, height: 200,
}
const track = {
  position: 'absolute', top: '10%', bottom: '10%', left: '50%', width: 1,
  background: 'var(--ink, currentColor)', opacity: 0.2,
}
const tick = {
  position: 'absolute', left: '50%', height: 1, width: 9, marginLeft: -4.5,
  background: 'var(--ink, currentColor)', opacity: 0.22,
}
const cursor = {
  position: 'absolute', left: '50%', width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5,
  borderRadius: '50%', background: COLORS.scoreAmber,
}
const hintWrap = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
}
const arrow = {
  fontFamily: FONTS.serif, fontSize: 20, color: 'var(--ink, currentColor)',
  opacity: 0.5, transform: 'rotate(90deg)',
}
const affordance = {
  fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 14,
  color: COLORS.inkCreamSecondary, textAlign: 'center', transition: 'opacity 0.5s',
}
