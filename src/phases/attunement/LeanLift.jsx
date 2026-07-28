// src/phases/attunement/LeanLift.jsx
// The first-lean beat — a tilt-driven slider, now with a FEW sub-rounds: the
// listener leans across 2 pole-pairs in a row (warm/cold, then shadowed/sunlit),
// each a roll-slide that commits on the same brink-crossing and then "re-poles
// in place" — the cursor slides home, locks, returns to center, and the next
// pair's words fade in. Both rounds move ONLY Valence (a 2nd read makes the axis
// reliable); only the LAST round advances the beat. Roll-only; Depth held.
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS, EASE } from '../../score/tokens'
import { LEAN_BRINK } from '../../lib/leanCommit.js'
import { useBrinkSlider } from '../../hooks/useBrinkSlider.js'
import { NOCTURNE_ENABLED } from '../../world/flags.js'
import { tipPool } from '../../world/worldStore.js'

// Nocturne (canon §6) — how much of the brink-slider's -1..1 read reaches the
// live pool nudge. Kept small: a sway, not a full-range pan.
const POOL_TIP_SCALE = 0.12

// Nocturne (canon §2) — on the dark stage the few hardcoded cream inks flip to
// light (matching phaseTheme's --ink); byte-identical when the flag is off. The
// var(--ink) structural colours are flipped centrally by phaseTheme.
const INK = NOCTURNE_ENABLED ? '#E8E4DD' : '#1C1814'
const INK2 = NOCTURNE_ENABLED ? '#8A7556' : '#6B5840'

const TRACK_HALF = 38
const BRINK_PCT = 50 + LEAN_BRINK * TRACK_HALF

const DEFAULT_ROUNDS = [
  { prompt: 'is it warmth, or a colder light?', leftLabel: 'a colder light', rightLabel: 'warmth' },
]

// `live` = the score hook's liveRef (live.current.pan). onCommit(pan, subIndex)
// writes that sub-round's read; onAdvance fires once `committed` flips (last
// round only). `subfaces` is the beat's sub-round list (prompt + pole labels).
// The brink-slider state machine (shared with Listen) lives in useBrinkSlider;
// this component is just the horizontal rendering.
// `cueDimmed` — the Prompter has finished speaking this beat's invitation, so
// the WRITTEN instruction can recede and leave the listener with the light, the
// bed, and their hands. It is only ever true when a voice clip actually
// sounded (see Admirer.onScoreAsk), so a missing mp3 keeps the full cue on
// screen. Presentation only — it touches no gesture, commit, or advance path.
export default function LeanLift({ live, onCommit, onAdvance, committed, subfaces, cueDimmed }) {
  const rounds = subfaces && subfaces.length ? subfaces : DEFAULT_ROUNDS

  const { subIndex, rb, fired, side } = useBrinkSlider({
    live,
    axisKey: 'pan',
    onCommit,
    onAdvance,
    committed,
    roundsLength: rounds.length,
  })

  // Nocturne (canon §6) — additively couple the lean read into WorldStage's
  // live pool nudge. Purely a read of `rb` (the slider's own render state,
  // already computed above for the cursor) — never touches the brink-crossing
  // detector or the commit/advance machinery in useBrinkSlider. Fail-safe: a
  // throw here must never interrupt the choreography.
  useEffect(() => {
    if (!NOCTURNE_ENABLED) return
    try { tipPool(rb * POOL_TIP_SCALE) } catch { /* never break the beat */ }
  }, [rb])

  // Release the pool nudge when this beat ends (unmount = beat exit in the
  // score's overlay-swap flow).
  useEffect(() => {
    if (!NOCTURNE_ENABLED) return undefined
    return () => {
      try { tipPool(0) } catch { /* never break the beat */ }
    }
  }, [])

  const round = rounds[subIndex] || DEFAULT_ROUNDS[0]
  // Once the spoken cue has landed (or the lean is sealed) the written
  // instruction and the track chrome recede; the amber cursor and the pole
  // words stay, because those are the choice itself, not the manual.
  const receded = fired || cueDimmed
  const chrome = receded ? 0.06 : 0.22
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
          <div style={{ ...track, opacity: receded ? 0.08 : 0.2 }} />
          <div style={{ ...tick, left: `${100 - BRINK_PCT}%`, opacity: chrome }} />
          <div style={{ ...tick, left: `${BRINK_PCT}%`, opacity: chrome }} />
          <div
            style={{
              ...cursor,
              left: `${cursorPct}%`,
              transition: fired ? `left 0.5s ${EASE.settleCss}` : 'none',
              boxShadow: `0 0 ${8 + Math.max(leftHeat, rightHeat) * 16}px ${COLORS.scoreAmber}`,
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
        <PhoneTiltHint dimmed={receded} />
        <div style={{ ...affordance, opacity: receded ? 0 : 0.75 }}>
          tilt your phone toward the one that pulls — a lean like this will place the sound around you, later.
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
      color: heat > 0.15 ? INK : INK2,
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
          border: `1.5px solid var(--ink, ${INK})`,
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
  transition: 'opacity 0.9s',
}
const tick = {
  position: 'absolute', top: '50%', width: 1, height: 9, marginTop: -4.5,
  background: 'var(--ink, currentColor)', opacity: 0.22,
  transition: 'opacity 0.9s',
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
  color: INK2, textAlign: 'center', transition: 'opacity 0.5s',
}
