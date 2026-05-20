import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { subscribeLiveSession, getLiveSession } from '../lib/liveSession.js'

// A calm, peripheral surface. Two quiet things: the Admirer's most recent
// line, and the words the user has given, accumulating. It must be
// ignorable — a user who never looks at it loses nothing. Theme-neutral so
// it reads on both the cream Admirer phase and the dark Orchestra phase.
// A glyph layer is added in Phase 3 (it needs phone motion from Build A).
export default function ReflectionSurface() {
  const { transcript, lexicon } = useSyncExternalStore(subscribeLiveSession, getLiveSession)

  const lastAgentLine = [...transcript].reverse().find(l => l.role === 'agent')?.text || ''

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 10,
        padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 14px)',
        zIndex: 5,
      }}
    >
      {/* accumulating lexicon — the words the user gave */}
      {lexicon.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 10px',
          maxWidth: 420,
        }}>
          {lexicon.map((w, i) => (
            <motion.span
              key={`${w}-${i}`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 0.4, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                fontFamily: 'Iowan Old Style, Palatino, serif',
                fontStyle: 'italic', fontSize: 12, letterSpacing: 0.2,
                color: 'currentColor',
              }}
            >
              {w}
            </motion.span>
          ))}
        </div>
      )}

      {/* the Admirer's current line — faint, slow */}
      <AnimatePresence mode="wait">
        {lastAgentLine && (
          <motion.div
            key={lastAgentLine}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            style={{
              fontFamily: 'Iowan Old Style, Palatino, serif',
              fontStyle: 'italic', fontSize: 13, lineHeight: 1.5,
              textAlign: 'center', maxWidth: 420, color: 'currentColor',
            }}
          >
            {lastAgentLine}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
