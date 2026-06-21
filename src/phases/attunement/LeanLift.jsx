// src/phases/attunement/LeanLift.jsx
// The first-lean beat — a tilt-driven slider, now with a FEW sub-rounds: the
// listener leans across 2 pole-pairs in a row (warm/cold, then shadowed/sunlit),
// each a roll-slide that commits on the same brink-crossing and then "re-poles
// in place" — the cursor slides home, locks, returns to center, and the next
// pair's words fade in. Both rounds move ONLY Valence (a 2nd read makes the axis
// reliable); only the LAST round advances the beat. Roll-only; Depth held.
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'
import { isBrinkCrossing, LEAN_BRINK } from '../../lib/leanCommit.js'

const TRACK_HALF = 38
const BRINK_PCT = 50 + LEAN_BRINK * TRACK_HALF
const LOCK_MS = 520 // how long the cursor holds at the pole before re-poling

const DEFAULT_ROUNDS = [
  { prompt: 'is it warmth, or a colder light?', leftLabel: 'a colder light', rightLabel: 'warmth' },
]

// `live` = the score hook's liveRef (live.current.pan). onCommit(pan, subIndex)
// writes that sub-round's read; onAdvance fires once `committed` flips (last
// round only). `subfaces` is the beat's sub-round list (prompt + pole labels).
export default function LeanLift({ live, onCommit, onAdvance, committed, subfaces }) {
  const rounds = subfaces && subfaces.length ? subfaces : DEFAULT_ROUNDS

  const [subIndex, setSubIndex] = useState(0)
  const [rb, setRb] = useState(0)
  const [fired, setFired] = useState(false)   // lock flash for the current round
  const [side, setSide] = useState(0)

  const subIndexRef = useRef(0)
  const phaseRef = useRef('leaning')          // 'leaning' | 'locking' | 'done'
  const initRef = useRef(false)
  const prevBRef = useRef(0)
  const sideRef = useRef(0)
  const rbRef = useRef(0)
  const lockStartRef = useRef(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const pan = live.current.pan
      const b = (pan - 0.5) * 2
      if (phaseRef.current === 'leaning') {
        if (!initRef.current) {
          // First frame of this round: seed prevB without testing (a resting
          // tilt — or the lock position carried in — can't auto-commit).
          initRef.current = true
        } else if (isBrinkCrossing({ b, prevB: prevBRef.current })) {
          sideRef.current = Math.sign(b)
          setSide(Math.sign(b))
          setFired(true)
          onCommit(pan, subIndexRef.current)
          phaseRef.current = 'locking'
          lockStartRef.current = performance.now()
        }
        prevBRef.current = b
        rbRef.current = b
        setRb(b)
      } else if (phaseRef.current === 'locking') {
        // Slide the cursor home to the chosen pole and hold.
        const target = sideRef.current || 0
        rbRef.current += (target - rbRef.current) * 0.18
        setRb(rbRef.current)
        if (performance.now() - lockStartRef.current > LOCK_MS) {
          if (subIndexRef.current >= rounds.length - 1) {
            phaseRef.current = 'done' // last round — committed prop drives advance
          } else {
            // Re-pole: next sub-round, cursor back to center, detector re-armed.
            subIndexRef.current += 1
            setSubIndex(subIndexRef.current)
            initRef.current = false
            prevBRef.current = 0
            rbRef.current = 0
            sideRef.current = 0
            setRb(0)
            setSide(0)
            setFired(false)
            phaseRef.current = 'leaning'
          }
        }
      }
      if (phaseRef.current !== 'done') raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, onCommit, rounds.length])

  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1100)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  const round = rounds[subIndex] || DEFAULT_ROUNDS[0]
  const b = Math.max(-1, Math.min(1, rb))
  const leftHeat = b < 0 ? Math.min(1, -b / LEAN_BRINK) : 0
  const rightHeat = b > 0 ? Math.min(1, b / LEAN_BRINK) : 0
  const cursorPct = 50 + b * TRACK_HALF

  return (
    <div style={overlay}>
      <div style={prompt}>{round.prompt}</div>

      <div style={sliderWrap}>
        <PoleLabel text={round.leftLabel} align="left" heat={leftHeat} />
        <PoleLabel text={round.rightLabel} align="right" heat={rightHeat} />

        <div style={trackWrap}>
          <div style={track} />
          <div style={{ ...tick, left: `${100 - BRINK_PCT}%` }} />
          <div style={{ ...tick, left: `${BRINK_PCT}%` }} />
          <div
            style={{
              ...cursor,
              left: `${cursorPct}%`,
              transition: fired ? 'left 0.5s cubic-bezier(0.22,1,0.36,1)' : 'none',
              boxShadow: `0 0 ${8 + Math.max(leftHeat, rightHeat) * 16}px ${COLORS.scoreAmber}`,
            }}
          />
          {fired && (
            <motion.div
              key={subIndex}
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

        {/* Round progress dots — only shown when there's more than one round. */}
        {rounds.length > 1 && (
          <div style={dotsWrap}>
            {rounds.map((_, i) => (
              <span key={i} style={{ ...dot, opacity: i <= subIndex ? 0.7 : 0.22 }} />
            ))}
          </div>
        )}
      </div>

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
  position: 'relative', width: '100%', maxWidth: 360, height: 80,
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
const dotsWrap = {
  position: 'absolute', left: 0, right: 0, top: 62,
  display: 'flex', justifyContent: 'center', gap: 7,
}
const dot = {
  width: 4, height: 4, borderRadius: '50%', background: COLORS.scoreAmber,
  transition: 'opacity 0.3s',
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
