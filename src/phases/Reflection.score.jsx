import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { buildReflectionLines } from '../lib/reflectionLines'
import { useAdmirer } from '../hooks/useAdmirer'
import { ADMIRER_LINES } from '../lib/admirerScripts'

const LINE_FADE_MS = 1200
const LINE_HOLD_MS = 1700  // time between line appearances
const LINES_TOTAL = 5
const HOLD_AFTER_LAST_MS = 2200

export default function Reflection({ onNext, avd }) {
  const [lines] = useState(() => {
    const avdValues = avd.getAVD()
    const phaseData = avd.getPhaseData()
    const built = buildReflectionLines(avdValues, phaseData)
    return [
      built.spectrum,
      built.depth,
      built.gems,
      built.moment,
      built.autobio,
    ]
  })
  const [visibleCount, setVisibleCount] = useState(0)

  const admirer = useAdmirer()

  useEffect(() => {
    const timers = []
    for (let i = 0; i < LINES_TOTAL; i++) {
      timers.push(setTimeout(() => setVisibleCount(i + 1), i * LINE_HOLD_MS + 600))
    }
    timers.push(setTimeout(() => onNext(), LINES_TOTAL * LINE_HOLD_MS + HOLD_AFTER_LAST_MS))
    admirer.play(ADMIRER_LINES.reflection.open.text, ADMIRER_LINES.reflection.open.register)
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Paper variant="cream">
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 32px',
        gap: 28,
      }}>
        <motion.div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: COLORS.inkCreamSecondary,
            letterSpacing: '0.18em',
            marginBottom: 12,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 0.8 }}
        >
          vii. what i heard
        </motion.div>

        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{
              opacity: visibleCount > i ? 1 : 0,
              y: visibleCount > i ? 0 : 6,
            }}
            transition={{ duration: LINE_FADE_MS / 1000, ease: 'easeOut' }}
          >
            <div style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 16,
              color: COLORS.inkCream,
              lineHeight: 1.5,
            }}>
              {line.signal}
            </div>
            <div style={{
              fontFamily: FONTS.serif,
              fontSize: 13,
              color: COLORS.inkCreamSecondary,
              marginTop: 6,
              lineHeight: 1.6,
            }}>
              {line.interpretation}
            </div>
          </motion.div>
        ))}
      </div>
    </Paper>
  )
}
