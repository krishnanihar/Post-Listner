import { useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { subscribeLiveSession, getLiveSession } from '../lib/liveSession.js'

// A calm, peripheral surface, unbroken across the admirer and orchestra
// phases. Renders only the accumulating lexicon — the visual glyph layer
// during the Admirer phase now lives inside Admirer.jsx (AdmirerScene3D),
// which mounts only for that phase. The lexicon strip stays here because
// it should persist across the admirer → orchestra act transition.
//
// The active question the Admirer is asking is handled by QuestionDisplay,
// which lives inside Admirer.jsx in the reading zone just below the state
// label. This surface stays peripheral and non-discursive.
export default function ReflectionSurface() {
  const { lexicon } = useSyncExternalStore(subscribeLiveSession, getLiveSession)

  if (lexicon.length === 0) return null

  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
    >
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: '6px 10px',
          padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 18px)',
          maxWidth: 460,
          margin: '0 auto',
        }}
      >
        {lexicon.map((w, i) => (
          <motion.span
            key={`${w}-${i}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 0.4, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              fontFamily: 'Iowan Old Style, Palatino, serif',
              fontStyle: 'italic', fontSize: 12, letterSpacing: 0.2,
              color: 'var(--ink, currentColor)',
            }}
          >
            {w}
          </motion.span>
        ))}
      </div>
    </div>
  )
}
