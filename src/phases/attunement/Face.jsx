// src/phases/attunement/Face.jsx
// The face beat — the finale and the song picker. Six worlds (the archetype
// centroids) sit on a frontal arc; the listener TURNS the phone (yaw) to face
// one — the nearest brightens — and STRIKES the phone down to choose it (the
// strike learned in rise is the universal "yes"; no blind hold). Whichever world
// is faced at the strike is committed (the score hard-snaps the AVD vector onto
// that world's centroid → that's the song). A generous safety net chooses the
// faced world if no strike comes. Teaches yaw.
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'
import { NOCTURNE_ENABLED } from '../../world/flags.js'
import { archetypeRing, nearestArchetypeToYaw } from '../../lib/archetypeRing.js'
// Nocturne (canon §2) — the one hardcoded secondary ink flips to light on the
// dark stage (matching phaseTheme's --ink); byte-identical when the flag is off.
const INK2 = NOCTURNE_ENABLED ? '#8A7556' : '#6B5840'

const SAFETY_MS = 15000

export default function Face({ live, onCommit, onAdvance, committed }) {
  const ring = useMemo(() => archetypeRing(), [])
  const [relYaw, setRelYaw] = useState(0)
  const [fired, setFired] = useState(false)
  const firedRef = useRef(false)
  const prevDownRef = useRef(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setRelYaw(live.current.relYaw)
      if (!firedRef.current) {
        const dc = live.current.downbeatCount ?? 0
        if (dc > prevDownRef.current) {   // a strike → choose the faced world
          firedRef.current = true
          setFired(true)
          onCommit()
        }
        prevDownRef.current = dc
      }
      if (!firedRef.current) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, onCommit])

  // Safety net — choose the faced world after a generous beat if no strike comes.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!firedRef.current) { firedRef.current = true; setFired(true); onCommit() }
    }, SAFETY_MS)
    return () => clearTimeout(t)
  }, [onCommit])

  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1400)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  const facedId = nearestArchetypeToYaw(relYaw, ring)
  const pointerPct = 50 + (Math.max(-75, Math.min(75, relYaw)) / 75) * 40

  return (
    <div style={overlay}>
      <div style={prompt}>which one feels like home?</div>

      {/* Arc of worlds */}
      <div style={arcWrap}>
        {ring.map((r) => {
          const isFaced = r.id === facedId
          const prox = Math.max(0, 1 - Math.abs(r.azimuthDeg - relYaw) / 50)
          return (
            <motion.div
              key={r.id}
              aria-hidden
              animate={{
                opacity: 0.3 + prox * 0.7,
                scale: isFaced && !fired ? 1.25 : 0.85 + prox * 0.3,
              }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'absolute', top: '50%',
                left: `${50 + (r.azimuthDeg / 75) * 40}%`,
                transform: 'translate(-50%,-50%)',
                width: 52, height: 52, borderRadius: '50%',
                background: `radial-gradient(circle, ${COLORS.scoreAmber}99, transparent 70%)`,
                boxShadow: isFaced ? `0 0 26px ${COLORS.scoreAmber}88` : 'none',
              }}
            >
              {isFaced && (
                <div style={{
                  position: 'absolute', inset: -8, borderRadius: '50%',
                  border: `1px solid ${COLORS.scoreAmber}`, opacity: 0.6,
                }} />
              )}
              {isFaced && fired && (
                <motion.div
                  aria-hidden
                  initial={{ opacity: 0.6, scale: 0.6 }}
                  animate={{ opacity: 0, scale: 2.8 }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${COLORS.scoreAmber}` }}
                />
              )}
            </motion.div>
          )
        })}

        {/* Facing pointer — where you're aimed. */}
        <div style={{
          position: 'absolute', top: 'calc(50% + 46px)',
          left: `${pointerPct}%`, transform: 'translateX(-50%)',
          fontSize: 16, color: 'var(--ink, currentColor)', opacity: 0.5,
          transition: 'left 0.06s linear',
        }}>▴</div>
      </div>

      {/* Strike cue + text affordance */}
      <div style={hintWrap}>
        <motion.div
          aria-hidden
          animate={fired ? { opacity: 0 } : { opacity: [0.35, 0.9, 0.35], y: [0, 4, 0] }}
          transition={fired ? { duration: 0.3 } : { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: 20, color: COLORS.scoreAmber, lineHeight: 1 }}
        >
          ▾
        </motion.div>
        <div style={{ ...affordance, opacity: fired ? 0 : 0.75 }}>
          turn to face it, then strike down to choose. later, turning steers which instrument leads.
        </div>
      </div>
    </div>
  )
}

const overlay = {
  position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: 40, padding: '0 28px',
}
const prompt = {
  fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 19,
  color: 'var(--ink, currentColor)', textAlign: 'center', opacity: 0.9,
}
const arcWrap = {
  position: 'relative', width: '100%', maxWidth: 360, height: 140,
}
const hintWrap = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
}
const affordance = {
  fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 14,
  color: INK2, textAlign: 'center', transition: 'opacity 0.5s',
}
