import { useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { subscribeLiveSession, getLiveSession } from '../lib/liveSession.js'
import GlyphCanvas from './GlyphCanvas.jsx'

// A calm, peripheral surface, unbroken across the admirer and orchestra
// phases. Two quiet things: a glyph that forms from the phone's motion
// (GlyphCanvas), and the words the user has given. It must be ignorable —
// a user who never looks at it loses nothing. Theme-neutral so it reads
// on both the cream Admirer phase and the dark Orchestra phase.
//
// The active question the Admirer is asking is handled by QuestionDisplay,
// which lives inside Admirer.jsx in the reading zone just below the state
// label. This surface stays peripheral and non-discursive.
export default function ReflectionSurface() {
  const { lexicon } = useSyncExternalStore(subscribeLiveSession, getLiveSession)

  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
    >
      {/* the glyph — a faint ink trail drawn from phone motion */}
      <GlyphCanvas />

      {/* accumulating lexicon — the words the user gave (peripheral by design) */}
      {lexicon.length > 0 && (
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
      )}
    </div>
  )
}
