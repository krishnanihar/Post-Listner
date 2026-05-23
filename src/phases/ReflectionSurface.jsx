import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { subscribeLiveSession, getLiveSession } from '../lib/liveSession.js'
import GlyphCanvas from './GlyphCanvas.jsx'

// A calm, peripheral surface, unbroken across the admirer and orchestra
// phases. Three quiet things: a glyph that forms from the phone's motion
// (GlyphCanvas), the words the user has given, and the Admirer's most recent
// lines. It must be ignorable — a user who never looks at it loses nothing.
// Theme-neutral so it reads on both the cream Admirer phase and the dark
// Orchestra phase.
export default function ReflectionSurface() {
  const { transcript, lexicon } = useSyncExternalStore(subscribeLiveSession, getLiveSession)

  // Pull the most recent 3 agent lines for the transcript tail. The user
  // can read what they may have missed (a head-turn, a moment of looking
  // at the room) without making the surface intrusive. Older lines fade.
  const recentAgentLines = transcript
    .filter(l => l.role === 'agent')
    .slice(-3)

  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
    >
      {/* the glyph — a faint ink trail drawn from phone motion */}
      <GlyphCanvas />

      {/* transcript + lexicon — a quiet strip along the bottom */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 14,
          padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 18px)',
        }}
      >
        {/* accumulating lexicon — the words the user gave */}
        {lexicon.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 10px',
            maxWidth: 460,
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
                  color: 'var(--ink, currentColor)',
                }}
              >
                {w}
              </motion.span>
            ))}
          </div>
        )}

        {/* Recent agent lines — 3-line tail with an opacity ramp so the
            newest line is legible and older lines fade out below it.
            Reverses the slice so newest is at the bottom (closest to the
            user's reading eye). */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 6, maxWidth: 460,
          }}
        >
          <AnimatePresence initial={false}>
            {recentAgentLines.map((line, idx) => {
              // idx 0 is oldest, idx (n-1) is newest. Newest = full opacity;
              // older fade.
              const ageFromNewest = recentAgentLines.length - 1 - idx
              const opacity = ageFromNewest === 0 ? 0.85
                            : ageFromNewest === 1 ? 0.5
                            : 0.28
              const fontSize = ageFromNewest === 0 ? 15 : 13
              return (
                <motion.div
                  key={`agent-${transcript.indexOf(line)}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  style={{
                    fontFamily: 'Iowan Old Style, Palatino, serif',
                    fontStyle: 'italic',
                    fontSize,
                    lineHeight: 1.45,
                    textAlign: 'center',
                    color: 'var(--ink, currentColor)',
                  }}
                >
                  {line.text}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
