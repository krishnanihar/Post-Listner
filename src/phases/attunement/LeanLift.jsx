// src/phases/attunement/LeanLift.jsx
// The first-lean beat — a tilt-driven slider in the Spectrum visual language.
// A cursor rides a horizontal track between two poles (a colder light ↔ warmth);
// phone ROLL moves it, continuously and reversibly — that IS the roll lesson.
// Lean past the brink WHILE moving outward and it "locks": the cursor slides
// home to that pole, one haptic. No timer, no hold — the commit is the act of
// tipping it past. A phone-tilt indicator + text teach the gesture.
// Roll-only (Valence); Depth is held (see leanLiftTarget). Commit logic is the
// reviewed brink-crossing path; only the visuals are the slider.
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'
import { isBrinkCrossing, LEAN_BRINK } from '../../lib/leanCommit.js'

// Track geometry: the cursor travels ±TRACK_HALF% of the width from center.
const TRACK_HALF = 38
const BRINK_PCT = 50 + LEAN_BRINK * TRACK_HALF // where the "lock" ticks sit

// `live` is the score hook's liveRef (live.current.pan ∈ [0,1] from roll).
// onCommit(capturedPan) writes taste (intensity carried by the lean angle);
// onAdvance moves on once `committed` flips true.
export default function LeanLift({ live, onCommit, onAdvance, committed }) {
  const [rb, setRb] = useState(0)     // rendered balance ∈ [-1,1] → cursor pos
  const [fired, setFired] = useState(false)
  const [side, setSide] = useState(0) // committed side: -1 cold / +1 warm
  const initRef = useRef(false)
  const prevBRef = useRef(0)
  const firedRef = useRef(false)
  const rbRef = useRef(0)
  const sideRef = useRef(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const pan = live.current.pan
      const b = (pan - 0.5) * 2
      if (!firedRef.current) {
        if (!initRef.current) {
          // First frame: seed prevB with the real resting roll WITHOUT testing,
          // so an already-tilted phone never auto-commits on entry.
          initRef.current = true
        } else if (isBrinkCrossing({ b, prevB: prevBRef.current })) {
          firedRef.current = true
          sideRef.current = Math.sign(b)
          setFired(true)
          setSide(Math.sign(b))
          onCommit(pan)
        }
        prevBRef.current = b
        rbRef.current = b
        setRb(b)
      } else {
        // Lock: the cursor slides home to the chosen pole on its own.
        const target = sideRef.current || 0
        rbRef.current += (target - rbRef.current) * 0.14
        setRb(rbRef.current)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, onCommit])

  // After it locks, give it a beat to read, then advance.
  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1100)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  const b = Math.max(-1, Math.min(1, rb))
  const leftHeat = b < 0 ? Math.min(1, -b / LEAN_BRINK) : 0
  const rightHeat = b > 0 ? Math.min(1, b / LEAN_BRINK) : 0
  const cursorPct = 50 + b * TRACK_HALF

  return (
    <div style={overlay}>
      {/* Prompt */}
      <div style={prompt}>is it warmth, or a colder light?</div>

      {/* The slider */}
      <div style={sliderWrap}>
        <PoleLabel text="a colder light" align="left" heat={leftHeat} />
        <PoleLabel text="warmth" align="right" heat={rightHeat} />

        {/* Track */}
        <div style={trackWrap}>
          <div style={track} />
          {/* the two "lock" ticks */}
          <div style={{ ...tick, left: `${100 - BRINK_PCT}%` }} />
          <div style={{ ...tick, left: `${BRINK_PCT}%` }} />
          {/* cursor */}
          <div
            style={{
              ...cursor,
              left: `${cursorPct}%`,
              transition: fired ? 'left 0.5s cubic-bezier(0.22,1,0.36,1)' : 'none',
              boxShadow: `0 0 ${8 + Math.max(leftHeat, rightHeat) * 16}px ${COLORS.scoreAmber}`,
            }}
          />
          {/* lock flash at the chosen pole */}
          {fired && (
            <motion.div
              aria-hidden
              initial={{ opacity: 0.6, scale: 0.5 }}
              animate={{ opacity: 0, scale: 2.2 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              style={{
                position: 'absolute', top: '50%',
                left: `${50 + side * TRACK_HALF}%`,
                width: 24, height: 24, marginLeft: -12, marginTop: -12,
                borderRadius: '50%', border: `1px solid ${COLORS.scoreAmber}`,
              }}
            />
          )}
        </div>
      </div>

      {/* Gesture indicator + text affordance */}
      <div style={hintWrap}>
        <PhoneTiltHint dimmed={fired} />
        <div style={{ ...affordance, opacity: fired ? 0 : 0.75 }}>
          tilt your phone toward the one that pulls
        </div>
      </div>
    </div>
  )
}

function PoleLabel({ text, align, heat }) {
  return (
    <div style={{
      position: 'absolute', top: 0, [align]: 0,
      fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 16,
      color: heat > 0.15 ? COLORS.inkCream : COLORS.inkCreamSecondary,
      opacity: 0.5 + heat * 0.5,
      transition: 'opacity 0.25s, color 0.25s',
      maxWidth: 120,
      textAlign: align,
    }}>
      {text}
    </div>
  )
}

// A small phone that rocks left↔right to demonstrate the tilt.
function PhoneTiltHint({ dimmed }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      opacity: dimmed ? 0 : 0.55, transition: 'opacity 0.5s',
    }}>
      <span style={arrow}>‹</span>
      <motion.div
        aria-hidden
        animate={{ rotate: [-13, 13, -13] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 30, height: 50, borderRadius: 7,
          border: `1.5px solid var(--ink, ${COLORS.inkCream})`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: 5,
        }}
      >
        <div style={{ width: 9, height: 1.5, borderRadius: 1, background: 'var(--ink, currentColor)', opacity: 0.6 }} />
      </motion.div>
      <span style={arrow}>›</span>
    </div>
  )
}

const overlay = {
  position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: 44, padding: '0 28px',
}
const prompt = {
  fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 19,
  color: 'var(--ink, currentColor)', textAlign: 'center', opacity: 0.9,
}
const sliderWrap = {
  position: 'relative', width: '100%', maxWidth: 360, height: 64,
}
const trackWrap = {
  position: 'absolute', left: 0, right: 0, top: 38, height: 12,
}
const track = {
  position: 'absolute', left: '10%', right: '10%', top: '50%', height: 1,
  background: 'var(--ink, currentColor)', opacity: 0.2,
}
const tick = {
  position: 'absolute', top: '50%', width: 1, height: 9, marginTop: -4.5,
  background: 'var(--ink, currentColor)', opacity: 0.22,
}
const cursor = {
  position: 'absolute', top: '50%', width: 9, height: 9, marginTop: -4.5, marginLeft: -4.5,
  borderRadius: '50%', background: COLORS.scoreAmber,
}
const hintWrap = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
}
const arrow = {
  fontFamily: FONTS.serif, fontSize: 22, color: 'var(--ink, currentColor)', opacity: 0.5,
}
const affordance = {
  fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 14,
  color: COLORS.inkCreamSecondary, textAlign: 'center', transition: 'opacity 0.5s',
}
