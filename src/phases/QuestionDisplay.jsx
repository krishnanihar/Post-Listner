import { useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { subscribeLiveSession, getLiveSession } from '../lib/liveSession.js'
import { extractQuestion } from '../lib/extractQuestion.js'
import { FONTS } from '../score/tokens'

// The single active question the Admirer is asking. Reads liveSession's
// transcript, walks backwards to find the most recent agent utterance
// containing '?', extracts just the question sentence, and renders it as
// a single italic line. Persists through the user's response — it's only
// replaced when the next question lands. Non-question agent utterances
// (acknowledgments like "mm", framing lines, closing lines) leave the
// previously-shown question on screen.
export default function QuestionDisplay() {
  const { transcript } = useSyncExternalStore(subscribeLiveSession, getLiveSession)

  let activeQuestion = null
  for (let i = transcript.length - 1; i >= 0; i--) {
    const line = transcript[i]
    if (line.role !== 'agent') continue
    const q = extractQuestion(line.text)
    if (q) { activeQuestion = q; break }
  }

  return (
    <AnimatePresence mode="wait">
      {activeQuestion && (
        <motion.div
          key={activeQuestion}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 0.9, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 18,
            lineHeight: 1.45,
            textAlign: 'center',
            color: 'var(--ink, currentColor)',
            maxWidth: 320,
            padding: '0 16px',
          }}
        >
          {activeQuestion}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
