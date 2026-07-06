// src/phases/attunement/Rise.jsx
// The rise beat — energy + accent (gesture-size + downbeat). A meter climbs with
// how big the listener's movements are (an envelope: fast attack, slow release,
// so bigger gestures lift it and it holds). When it's high, a strike cue invites
// the down-stroke; striking the phone down LOCKS it — the strike is the commit,
// not a timer. How high the meter got = Arousal; striking while big = rode the
// peak (hedonic). This teaches the last two conducting moves. The score owns the
// taste math (riseTarget) + the downbeat counter; this overlay reads swell for
// the meter and the strike counter to commit.
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'
import { NOCTURNE_ENABLED } from '../../world/flags.js'
import { setLiveBreadth } from '../../world/worldStore.js'
// Nocturne (canon §2) — hardcoded cream inks flip to light on the dark stage
// (matching phaseTheme's --ink); byte-identical when the flag is off.
const INK = NOCTURNE_ENABLED ? '#E8E4DD' : '#1C1814'
const INK2 = NOCTURNE_ENABLED ? '#8A7556' : '#6B5840'

// Nocturne (canon §6) — how much of the rise meter (0..1) reaches the live
// breadth override. Kept modest: a widening cue, not the bloom itself.
const LIVE_BREADTH_SCALE = 0.35

// Must build at least this much before a down-stroke counts (a stray early
// strike with no build is ignored).
const COMMIT_MIN_METER = 0.14
// Generous fallback so the beat can't stall if the listener never strikes.
const SAFETY_MS = 20000
// Meter value that reads as "full" in the visual.
const FULL_AT = 0.7

// `live` is the score hook's liveRef: live.current.swell (gesture size 0..1) and
// live.current.downbeatCount (monotonic strike counter). onCommit() seals the
// build (the score reads its own peak-swell + rode-the-peak); onAdvance moves on.
export default function Rise({ live, onCommit, onAdvance, committed }) {
  const [meter, setMeter] = useState(0)
  const [fired, setFired] = useState(false)
  // The sharpness (jerk) of the sealing strike — a sharp strike cuts a bigger
  // flash, a soft one a gentler swell. This is the first place articulation
  // (Act-2's filter Q-spike) is taught.
  const [strikeArt, setStrikeArt] = useState(0)
  const meterRef = useRef(0)
  const firedRef = useRef(false)
  const prevDownRef = useRef(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const swell = live.current.swell ?? 0
      // Envelope: fast attack (big gestures lift it), slow release (it holds).
      const m = meterRef.current
      meterRef.current = swell > m ? m + (swell - m) * 0.25 : m + (swell - m) * 0.03
      setMeter(meterRef.current)

      if (!firedRef.current) {
        const dc = live.current.downbeatCount ?? 0
        // A new down-stroke, with enough build behind it, seals the rise.
        if (dc > prevDownRef.current && meterRef.current >= COMMIT_MIN_METER) {
          firedRef.current = true
          setStrikeArt(live.current.strikeArticulation ?? 0)
          setFired(true)
          onCommit()
        }
        prevDownRef.current = dc
      }
      // Stop rescheduling once sealed so the meter holds at its peak through the
      // committed→advance window (instead of easing off it).
      if (!firedRef.current) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, onCommit])

  // Nocturne (canon §6) — additively couple the energy meter into WorldStage's
  // live breadth override. Purely a read of `meter` (already-committed render
  // state from the tick above); never touches the swell/downbeat gesture math
  // or the commit machinery. Fail-safe: a throw here must never interrupt the
  // choreography.
  useEffect(() => {
    if (!NOCTURNE_ENABLED) return
    try { setLiveBreadth(meter * LIVE_BREADTH_SCALE) } catch { /* never break the beat */ }
  }, [meter])

  // Release the breadth override when this beat ends (unmount = beat exit).
  useEffect(() => {
    if (!NOCTURNE_ENABLED) return undefined
    return () => {
      try { setLiveBreadth(null) } catch { /* never break the beat */ }
    }
  }, [])

  // Safety net — commit anyway after a generous beat if no qualifying strike.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!firedRef.current) { firedRef.current = true; setFired(true); onCommit() }
    }, SAFETY_MS)
    return () => clearTimeout(t)
  }, [onCommit])

  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1100)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  const fill = Math.min(1, meter / FULL_AT)
  const high = fill > 0.5

  return (
    <div style={overlay}>
      <div style={prompt}>lift the energy.</div>

      {/* Vertical energy meter */}
      <div style={meterWrap}>
        <div style={meterTrack}>
          <motion.div
            aria-hidden
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              borderRadius: 6,
              background: COLORS.scoreAmber,
              boxShadow: `0 0 ${10 + fill * 30}px ${COLORS.scoreAmber}`,
            }}
            animate={{ height: `${fill * 100}%`, opacity: 0.55 + fill * 0.45 }}
            transition={{ duration: 0.08, ease: 'linear' }}
          />
        </div>

        {/* Strike cue — pulses at the foot of the meter once it's high. */}
        <motion.div
          aria-hidden
          animate={high && !fired ? { opacity: [0.3, 0.9, 0.3], y: [0, 4, 0] } : { opacity: 0 }}
          transition={high && !fired ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          style={{ fontSize: 22, color: COLORS.scoreAmber, lineHeight: 1 }}
        >
          ▾
        </motion.div>

        {/* Impact flash on the strike — a sharp strike (high articulation) cuts a
            bigger, brighter ring; a soft one a gentler swell. Teaches articulation. */}
        {fired && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0.5 + strikeArt * 0.4, scale: 0.5 }}
            animate={{ opacity: 0, scale: 1.8 + strikeArt * 1.8 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            style={{
              position: 'absolute', left: '50%', bottom: -6,
              width: 40, height: 40, marginLeft: -20,
              borderRadius: '50%',
              border: `${1 + strikeArt * 1.5}px solid ${COLORS.scoreAmber}`,
            }}
          />
        )}
      </div>

      <div style={hintWrap}>
        <PhoneRiseHint dimmed={fired} />
        <div style={{ ...affordance, opacity: fired ? 0 : 0.75 }}>
          lift the energy with bigger moves — then strike down to seal it. a sharp strike cuts, a soft one swells — later, that's how you shape each accent.
        </div>
      </div>
    </div>
  )
}

// A phone that shakes (build) then drops (strike), looping.
function PhoneRiseHint({ dimmed }) {
  return (
    <div style={{ opacity: dimmed ? 0 : 0.55, transition: 'opacity 0.5s' }}>
      <motion.div
        aria-hidden
        animate={{ rotate: [-7, 7, -7, 7, 0], y: [0, 0, 0, 0, 16] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', times: [0, 0.2, 0.4, 0.6, 1] }}
        style={{
          width: 30, height: 50, borderRadius: 7,
          border: `1.5px solid var(--ink, ${INK})`,
          margin: '0 auto',
        }}
      />
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
const meterWrap = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  position: 'relative',
}
const meterTrack = {
  // A faint trough on cream (the rise beat is cream-only); the amber fill child
  // rises inside it.
  position: 'relative', width: 10, height: 200, borderRadius: 5,
  background: 'rgba(28,24,20,0.06)',
  border: '1px solid rgba(28,24,20,0.12)',
  overflow: 'hidden',
}
const hintWrap = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
}
const affordance = {
  fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 14,
  color: INK2, textAlign: 'center', transition: 'opacity 0.5s',
  maxWidth: 280,
}
