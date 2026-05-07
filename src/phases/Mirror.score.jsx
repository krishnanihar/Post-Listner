import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { scoreArchetype } from '../lib/scoreArchetype'
import { getArchetype, getVariation } from '../lib/archetypes'
import {
  buildBecauseLine,
  buildMemoryCallback,
  buildTimeOfDayLine,
  buildLatencyLine,
  buildTemporalFrame,
} from '../lib/forerLines'

// Stage timing (ms from Mirror mount):
//   t=0      : archetype name fades in
//   t=3000   : variation/microgenre line fades in
//   t=4500   : because-you band fades in (3 fragments)
//   t=8000   : Forer paragraph begins (3 sentences fading in over ~10s)
//   t=8000   : trigger sub-audible track fade-up
//   t=18000  : memory callback fades in
//   t=20500  : time-of-day OR latency line fades in
//   t=22500  : temporal frame fades in (small, mono)
//   t=25000  : onComplete()
const T = {
  variation: 3000,
  because: 4500,
  forer: 8000,
  forerSentences: [8000, 11200, 14400],
  subAudibleStart: 8000,
  memory: 18000,
  passive: 20500,
  temporal: 22500,
  complete: 25000,
}

export default function Mirror({ avd, onComplete, onSubAudibleStart }) {
  const result = useMemo(() => {
    const avdValues = avd.getAVD()
    const phaseData = avd.getPhaseData()
    const scored = scoreArchetype(avdValues, phaseData)
    const archetype = getArchetype(scored.archetypeId)
    const variation = getVariation(scored.archetypeId, scored.variationId)
    const becauseFragments = buildBecauseLine(phaseData)
    const memoryLine = buildMemoryCallback(phaseData)
    const latencyLine = buildLatencyLine(phaseData)
    const timeOfDayLine = buildTimeOfDayLine(new Date())
    // Prefer latency line if available (more uncannily specific); else time-of-day.
    const passiveLine = latencyLine || timeOfDayLine
    const temporalFrame = buildTemporalFrame(new Date())
    return {
      archetype,
      variation,
      becauseFragments,
      memoryLine,
      passiveLine,
      temporalFrame,
    }
  }, [avd])

  const [visible, setVisible] = useState({
    archetype: false,
    variation: false,
    because: false,
    forerSentences: [false, false, false],
    memory: false,
    passive: false,
    temporal: false,
  })

  useEffect(() => {
    const timers = []
    const at = (ms, fn) => timers.push(setTimeout(fn, ms))

    at(200, () => setVisible(v => ({ ...v, archetype: true })))
    at(T.variation, () => setVisible(v => ({ ...v, variation: true })))
    at(T.because, () => setVisible(v => ({ ...v, because: true })))
    T.forerSentences.forEach((t, i) => at(t, () => setVisible(v => {
      const next = [...v.forerSentences]
      next[i] = true
      return { ...v, forerSentences: next }
    })))
    at(T.subAudibleStart, () => onSubAudibleStart && onSubAudibleStart())
    at(T.memory, () => setVisible(v => ({ ...v, memory: true })))
    at(T.passive, () => setVisible(v => ({ ...v, passive: true })))
    at(T.temporal, () => setVisible(v => ({ ...v, temporal: true })))
    at(T.complete, () => onComplete && onComplete())

    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!result.archetype) return null
  const { archetype, variation, becauseFragments, memoryLine, passiveLine, temporalFrame } = result
  const forerSentences = archetype.forerTemplate

  return (
    <Paper variant="cream">
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '40px 28px',
        gap: 18,
      }}>
        {/* Archetype name */}
        <motion.h2
          style={{
            fontFamily: FONTS.serif,
            fontSize: 30,
            color: COLORS.inkCream,
            lineHeight: 1.1,
            margin: 0,
            letterSpacing: '0.01em',
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: visible.archetype ? 1 : 0, y: visible.archetype ? 0 : 8 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        >
          {archetype.displayName}
        </motion.h2>

        {/* Variation microgenre label */}
        <motion.div
          style={{
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 14,
            color: COLORS.inkCreamSecondary,
            marginTop: -8,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: visible.variation ? 0.85 : 0 }}
          transition={{ duration: 1.2 }}
        >
          {variation.microgenreLabel}
        </motion.div>

        {/* Because-you band */}
        <motion.div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 12,
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: COLORS.scoreAmber,
            letterSpacing: '0.08em',
            textTransform: 'lowercase',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: visible.because ? 0.9 : 0 }}
          transition={{ duration: 1.0 }}
        >
          {becauseFragments.map((f, i) => (
            <span key={i}>{f}{i < becauseFragments.length - 1 ? ' · ' : ''}</span>
          ))}
        </motion.div>

        {/* Forer paragraph — 3 sentences staggered */}
        <div style={{ marginTop: 20 }}>
          {forerSentences.map((s, i) => (
            <motion.p
              key={i}
              style={{
                fontFamily: FONTS.serif,
                fontSize: 17,
                fontStyle: 'italic',
                color: COLORS.inkCream,
                lineHeight: 1.5,
                marginBottom: 14,
              }}
              initial={{ opacity: 0, y: 4 }}
              animate={{
                opacity: visible.forerSentences[i] ? 1 : 0,
                y: visible.forerSentences[i] ? 0 : 4,
              }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
            >
              {s}
            </motion.p>
          ))}
        </div>

        {/* Memory callback */}
        {memoryLine && (
          <motion.p
            style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 14,
              color: COLORS.inkCreamSecondary,
              lineHeight: 1.5,
              marginTop: 8,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: visible.memory ? 0.85 : 0 }}
            transition={{ duration: 1.2 }}
          >
            {memoryLine}
          </motion.p>
        )}

        {/* Passive line (latency or time-of-day) */}
        {passiveLine && (
          <motion.p
            style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 13,
              color: COLORS.inkCreamSecondary,
              lineHeight: 1.5,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: visible.passive ? 0.7 : 0 }}
            transition={{ duration: 1.0 }}
          >
            {passiveLine}
          </motion.p>
        )}

        {/* Temporal-uniqueness frame */}
        <motion.p
          style={{
            position: 'absolute',
            bottom: 28,
            left: 28,
            right: 28,
            textAlign: 'center',
            fontFamily: FONTS.mono,
            fontSize: 9,
            color: COLORS.inkCreamSecondary,
            letterSpacing: '0.08em',
            margin: 0,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: visible.temporal ? 0.55 : 0 }}
          transition={{ duration: 1.2 }}
        >
          {temporalFrame}
        </motion.p>
      </div>
    </Paper>
  )
}
