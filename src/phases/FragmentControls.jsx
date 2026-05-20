// FragmentControls — presentational component for fragment playback feedback
// and Yes/No rating buttons. No SDK, audio, or state-machine logic lives
// here; Admirer.jsx owns all of that and passes down ready-to-render flags.
//
// Props:
//   fragmentPlaying  boolean — true while a fragment plays (shows the indicator)
//   showButtons      boolean — true when the Yes/No buttons should be on screen
//   onRate(answer)   function — called with "yes" or "no" when a button is tapped

import { motion, AnimatePresence } from 'framer-motion'
import { COLORS, FONTS } from '../score/tokens'

export default function FragmentControls({ fragmentPlaying, showButtons, onRate }) {
  return (
    <>
      {/* Playing indicator */}
      <AnimatePresence>
        {fragmentPlaying && (
          <motion.div
            key="playing-indicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {/* Three small dots that pulse in sequence — calm, not loud */}
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                aria-hidden
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: 'easeInOut',
                }}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: COLORS.scoreAmber,
                  display: 'inline-block',
                }}
              />
            ))}
            <span
              style={{
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: 13,
                color: COLORS.inkCreamSecondary,
                letterSpacing: 0.4,
                marginLeft: 4,
              }}
            >
              playing
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Yes / No buttons */}
      <AnimatePresence>
        {showButtons && (
          <motion.div
            key="rating-buttons"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{
              display: 'flex',
              gap: 20,
            }}
          >
            {['yes', 'no'].map((answer) => (
              <button
                key={answer}
                onClick={() => onRate(answer)}
                style={{
                  fontFamily: FONTS.serif,
                  fontStyle: 'italic',
                  fontSize: 15,
                  letterSpacing: 0.5,
                  color: COLORS.inkCream,
                  background: 'transparent',
                  border: `1px solid ${COLORS.inkCreamSecondary}`,
                  borderRadius: 2,
                  padding: '8px 28px',
                  cursor: 'pointer',
                  opacity: 0.85,
                  // No hover state in JSX — keep it calm and consistent
                }}
              >
                {answer}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
