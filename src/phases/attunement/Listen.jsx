// src/phases/attunement/Listen.jsx
// The listen beat — a tilt-driven slider on the PITCH axis (the vertical mirror
// of the lean), now with a FEW sub-rounds: the listener tilts across 2 pairs in
// a row (open/inward, then dense/spare), each a pitch-slide that commits on the
// brink-crossing and re-poles in place. A fragment plays and audibly opens/
// closes with the tilt — matching the Orchestra (forward = dark/inward). Both
// rounds move ONLY Depth; only the last advances the beat. Commit logic mirrors
// LeanLift's re-pole state machine.
import { motion } from 'framer-motion'
import { COLORS, FONTS, EASE } from '../../score/tokens'
import { NOCTURNE_ENABLED } from '../../world/flags.js'
import { LEAN_BRINK } from '../../lib/leanCommit.js'
// Nocturne (canon §2) — hardcoded cream inks flip to light on the dark stage
// (matching phaseTheme's --ink); byte-identical when the flag is off.
const INK = NOCTURNE_ENABLED ? '#E8E4DD' : '#1C1814'
const INK2 = NOCTURNE_ENABLED ? '#8A7556' : '#6B5840'
import { useBrinkSlider } from '../../hooks/useBrinkSlider.js'

const TRACK_HALF = 38
const BRINK_PCT = 50 + LEAN_BRINK * TRACK_HALF

const DEFAULT_ROUNDS = [
  { prompt: 'open it up, or draw it close?', topLabel: 'open · bright', bottomLabel: 'inward · dark' },
]

// `live` = liveRef (live.current.filterNorm from pitch). onCommit(fn, subIndex)
// writes Depth; onAdvance fires once `committed` flips (last round only). The
// brink-slider state machine (shared with LeanLift) lives in useBrinkSlider;
// this component is just the vertical rendering.
export default function Listen({ live, onCommit, onAdvance, committed, subfaces }) {
  const rounds = subfaces && subfaces.length ? subfaces : DEFAULT_ROUNDS

  const { subIndex, rb, fired, side } = useBrinkSlider({
    live,
    axisKey: 'filterNorm',
    onCommit,
    onAdvance,
    committed,
    roundsLength: rounds.length,
  })

  const round = rounds[subIndex] || DEFAULT_ROUNDS[0]
  const b = Math.max(-1, Math.min(1, rb))
  const openHeat = b > 0 ? Math.min(1, b / LEAN_BRINK) : 0     // tilt back → open (top)
  const inwardHeat = b < 0 ? Math.min(1, -b / LEAN_BRINK) : 0  // tilt forward → inward (bottom)
  const cursorTopPct = 50 - b * TRACK_HALF                     // forward (b<0) → down/inward

  return (
    <div style={overlay}>
      <div style={prompt}>{round.prompt}</div>

      <div style={sliderWrap}>
        <PoleLabel text={round.topLabel} place="top" heat={openHeat} />

        <div style={trackWrap}>
          <div style={track} />
          <div style={{ ...tick, top: `${100 - BRINK_PCT}%` }} />
          <div style={{ ...tick, top: `${BRINK_PCT}%` }} />
          <div
            style={{
              ...cursor,
              top: `${cursorTopPct}%`,
              transition: fired ? `top 0.5s ${EASE.settleCss}` : 'none',
              boxShadow: `0 0 ${8 + Math.max(openHeat, inwardHeat) * 16}px ${COLORS.scoreAmber}`,
            }}
          />
          {fired && (
            <motion.div
              key={subIndex}
              aria-hidden
              initial={{ opacity: 0.6, scale: 0.5 }}
              animate={{ opacity: 0, scale: 2.2 }}
              transition={{ duration: 0.9, ease: EASE.reveal }}
              style={{
                position: 'absolute', left: '50%',
                top: `${50 - side * TRACK_HALF}%`,
                width: 24, height: 24, marginLeft: -12, marginTop: -12,
                borderRadius: '50%', border: `1px solid ${COLORS.scoreAmber}`,
              }}
            />
          )}
        </div>

        <PoleLabel text={round.bottomLabel} place="bottom" heat={inwardHeat} />

        {rounds.length > 1 && (
          <div style={dotsWrap}>
            {rounds.map((_, i) => (
              <span key={i} style={{ ...dot, opacity: i <= subIndex ? 0.7 : 0.22 }} />
            ))}
          </div>
        )}
      </div>

      <div style={hintWrap}>
        <PhoneNodHint dimmed={fired} />
        <div style={{ ...affordance, opacity: fired ? 0 : 0.75 }}>
          tilt back to open it, forward to draw it close. the same tilt brightens or dims the sound later.
        </div>
      </div>
    </div>
  )
}

function PoleLabel({ text, place, heat }) {
  return (
    <div style={{
      fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 15,
      color: heat > 0.15 ? INK : INK2,
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
          border: `1.5px solid var(--ink, ${INK})`,
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
  display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative',
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
const dotsWrap = {
  display: 'flex', justifyContent: 'center', gap: 7, marginTop: 14,
}
const dot = {
  width: 4, height: 4, borderRadius: '50%', background: COLORS.scoreAmber,
  transition: 'opacity 0.3s',
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
  color: INK2, textAlign: 'center', transition: 'opacity 0.5s',
}
