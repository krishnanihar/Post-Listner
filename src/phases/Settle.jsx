import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ConversationProvider } from '@elevenlabs/react'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { useAdmirerAgent } from '../hooks/useAdmirerAgent.js'
import { getEntries } from '../lib/sessionStore.js'
import { daysOfPractice, nextMilestone } from '../lib/longitudinal.js'

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID
// First-session close = one observation + refusal-to-know list. ~14s.
// Ongoing close = one quiet line. ~6s.
const FIRST_SESSION_DURATION_MS = 14000
const ONGOING_DURATION_MS = 6000

function SettleInner({ onComplete }) {
  const [hasError, setHasError] = useState(false)

  // Settle runs AFTER the opening phase's commitEntry, so getEntries().length
  // is 1 (not 0) on the very first session. Use <= 1 as the first-session check.
  const entries = getEntries()
  const isFirst = entries.length <= 1
  const days = daysOfPractice(entries)
  const milestone = nextMilestone(entries.length)

  const { connect, disconnect, status } = useAdmirerAgent({
    sessionStage: 'closing',
    callbacks: {},  // closing phase has no tools — agent just speaks
  })

  useEffect(() => {
    connect().catch(() => setHasError(true))
  }, [connect])

  // Time-bounded close. The agent's brief constrains this to a short
  // block — we stop the session and advance after the budget.
  useEffect(() => {
    const ms = isFirst ? FIRST_SESSION_DURATION_MS : ONGOING_DURATION_MS
    const t = setTimeout(() => {
      disconnect().finally(() => onComplete())
    }, ms)
    return () => clearTimeout(t)
  }, [disconnect, isFirst, onComplete])

  return (
    <Paper variant="cream">
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 18, padding: '0 32px',
      }}>
        <AnimatePresence>
          {!hasError && (
            <motion.div
              key="settling"
              initial={{ opacity: 0 }}
              animate={{ opacity: status === 'connected' ? 0.6 : 0.2 }}
              exit={{ opacity: 0 }}
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
          )}
        </AnimatePresence>
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

// Fallback when no agent is configured — auto-routes home after a beat
// so the user isn't stuck. Lifted into its own component so the parent
// doesn't conditionally call a hook.
function SettleNoAgent({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2000)
    return () => clearTimeout(t)
  }, [onComplete])
  return (
    <Paper variant="cream">
      <div />
    </Paper>
  )
}

export default function Settle({ onComplete }) {
  if (!AGENT_ID) {
    return <SettleNoAgent onComplete={onComplete} />
  }
  return (
    <ConversationProvider agentId={AGENT_ID}>
      <SettleInner onComplete={onComplete} />
    </ConversationProvider>
  )
}
