// src/phases/attunement/LeanLift.jsx
// The first-lean beat — "the tipping world". The room sits on a fulcrum: phone
// roll tilts a beam (and crossfades the warm/cold audio) continuously, every
// frame, fully reversible. This IS the roll lesson, learned by play. When the
// lean carries the balance past the brink WHILE still moving outward, the world
// "tips over" — it settles the rest of the way on its own, the chosen side
// blooms, one haptic. No timer, no hold: the commit is something you DID, at the
// instant you did it. Roll-only (Valence); Depth is held (see leanLiftTarget).
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'
import { isBrinkCrossing, LEAN_BRINK, LEAN_DEADZONE } from '../../lib/leanCommit.js'

// Cool/austere on the left, warm/hearth on the right. Restrained ink-on-cream,
// not neon — the warm side borrows the score amber, the cool side a muted slate.
const COOL = '#7C8A94'
const WARM = COLORS.scoreAmber

// `live` is the score hook's liveRef (live.current.pan ∈ [0,1] from roll).
// onCommit(capturedPan, approachMs) writes taste + advances expansion; onAdvance
// moves on once `committed` flips true.
export default function LeanLift({ live, onCommit, onAdvance, committed }) {
  const [rb, setRb] = useState(0)     // rendered balance (drives the seesaw)
  const [fired, setFired] = useState(false)
  const [side, setSide] = useState(0) // committed side: -1 cold / +1 warm
  const prevBRef = useRef(0)
  const firedRef = useRef(false)
  const approachStartRef = useRef(null)
  const rbRef = useRef(0)
  const sideRef = useRef(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const pan = live.current.pan
      const b = (pan - 0.5) * 2
      if (!firedRef.current) {
        // Time the approach (for commit confidence) from when the lean first
        // leaves the deadzone; reset if it falls back to neutral.
        if (Math.abs(b) >= LEAN_DEADZONE) {
          if (approachStartRef.current === null) approachStartRef.current = performance.now()
        } else {
          approachStartRef.current = null
        }
        if (isBrinkCrossing({ b, prevB: prevBRef.current })) {
          firedRef.current = true
          sideRef.current = Math.sign(b)
          setFired(true)
          setSide(Math.sign(b))
          const approachMs = approachStartRef.current !== null
            ? performance.now() - approachStartRef.current
            : null
          onCommit(pan, approachMs)
        }
        prevBRef.current = b
        rbRef.current = b
        setRb(b)
      } else {
        // Go-over: settle the rest of the way to the chosen side on its own.
        const target = sideRef.current || 0
        rbRef.current += (target - rbRef.current) * 0.14
        setRb(rbRef.current)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, onCommit])

  // After the world tips, give it a beat to read, then advance.
  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1100)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  const b = rb
  // Heat saturates at the brink (not the ±1 rail) so the visual "fullness" and
  // the commit land together — no "am I there yet?" gap past the brink.
  const leftHeat = b < 0 ? Math.min(1, -b / LEAN_BRINK) : 0
  const rightHeat = b > 0 ? Math.min(1, b / LEAN_BRINK) : 0
  const heat = Math.max(leftHeat, rightHeat)
  const downHue = b < 0 ? COOL : WARM
  const rotation = b * 8

  return (
    <div style={overlay}>
      {/* Wash pools toward the leaned-to side. */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at ${50 + b * 22}% 52%, ${downHue}22, transparent 62%)`,
          opacity: 0.4 + heat * 0.5,
          transition: 'opacity 0.3s ease-out',
        }}
      />

      {/* The serif cue — carries the (already-spoken) invitation; fades on tip. */}
      <div style={{ ...cue, opacity: fired ? 0 : 0.7 }}>
        lean into the one that pulls.
      </div>

      {/* The seesaw: beam + two presences, rotating about center with the lean.
          A plain div (not an SVG <g>) so rotate is safe; a slow transition only
          after the tip gives the "go-over" its settle. */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: '78%', maxWidth: 360, height: 96,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        transition: fired ? 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Presence hue={COOL} heat={leftHeat} />
        <div style={{
          flex: 1, height: 1, margin: '0 10px',
          background: 'var(--ink, currentColor)', opacity: 0.18,
        }} />
        <Presence hue={WARM} heat={rightHeat} />
      </div>

      {/* One quiet expanding ring at the moment of the catch. */}
      {fired && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0.5, scale: 0.4 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{
            position: 'absolute', top: '50%',
            left: `${50 + side * 30}%`,
            width: 120, height: 120, marginLeft: -60, marginTop: -60,
            borderRadius: '50%',
            border: `1px solid ${side < 0 ? COOL : WARM}`,
          }}
        />
      )}
    </div>
  )
}

function Presence({ hue, heat }) {
  const scale = 0.9 + heat * 0.24
  const opacity = 0.45 + heat * 0.5
  return (
    <div style={{
      width: 78, height: 78, flex: '0 0 auto', borderRadius: '50%',
      background: `radial-gradient(circle, ${hue}AA, ${hue}11 70%)`,
      boxShadow: `0 0 ${20 + heat * 32}px ${hue}55`,
      transform: `scale(${scale})`,
      opacity,
      transition: 'transform 0.25s ease-out, opacity 0.25s ease-out',
    }} />
  )
}

const overlay = { position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none' }
const cue = {
  position: 'absolute', top: '14%', left: 0, right: 0, textAlign: 'center',
  fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 14,
  color: COLORS.inkCreamSecondary, transition: 'opacity 0.6s',
}
