import { useEffect } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { getEntries } from '../lib/sessionStore.js'
import { daysOfPractice, nextMilestone } from '../lib/longitudinal.js'

// The brief closing card after the song ends. The live ElevenLabs agent has
// been removed (the Admirer is pre-baked TTS now); Settle is currently a
// silent card that lingers briefly, then routes home. A closing voice line
// can be added later as another pre-baked clip.
const FIRST_SESSION_DURATION_MS = 9000
const ONGOING_DURATION_MS = 6000

export default function Settle({ onComplete }) {
  // Settle runs AFTER the opening phase's commitEntry, so getEntries().length
  // is 1 (not 0) on the very first session. Use <= 1 as the first-session check.
  const entries = getEntries()
  const isFirst = entries.length <= 1
  const days = daysOfPractice(entries)
  const milestone = nextMilestone(entries.length)

  useEffect(() => {
    const ms = isFirst ? FIRST_SESSION_DURATION_MS : ONGOING_DURATION_MS
    const t = setTimeout(onComplete, ms)
    return () => clearTimeout(t)
  }, [isFirst, onComplete])

  return (
    <Paper variant="cream">
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 18, padding: '0 32px',
      }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 1.2 }}
          style={{
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 12,
            letterSpacing: 0.3,
            color: COLORS.inkCreamSecondary,
          }}
        >
          settling
        </motion.div>
        <div style={{
          fontFamily: FONTS.serif,
          fontStyle: 'italic',
          fontSize: 11,
          letterSpacing: 0.3,
          color: COLORS.inkCreamSecondary,
          opacity: 0.45,
          textAlign: 'center',
        }}>
          {days <= 1 ? 'your first day of practice' : `${days} days of practice`}
        </div>
        {milestone && (
          <div style={{
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 12,
            letterSpacing: 0.3,
            color: COLORS.inkCreamSecondary,
            opacity: 0.55,
            textAlign: 'center',
            maxWidth: 280,
          }}>
            Next time, if you choose, the room opens.
          </div>
        )}
      </div>
    </Paper>
  )
}
