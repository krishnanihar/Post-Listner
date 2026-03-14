import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'

const REVEAL_LINES = [
  'this music was composed by an algorithm',
  'it translated your choices into sound',
  'tempo, mood, texture, complexity',
  'no human wrote it',
  'the only human in this composition was you',
]

export default function Reveal({ onNext, avd, goToPhase }) {
  const [stage, setStage] = useState('computing') // computing, playing, reveal, choices
  const [visibleLines, setVisibleLines] = useState(0)
  const [avdValues, setAvdValues] = useState(avd.getAVD())
  const trackRef = useRef(null)

  useEffect(() => {
    const currentAVD = avd.getAVD()
    setAvdValues(currentAVD)

    // Stage 1: Computing (5 seconds)
    const computeTimer = setTimeout(() => {
      setStage('playing')

      // Generate and play procedural track
      trackRef.current = audioEngine.generateProceduralTrack(currentAVD, 60)

      // After track ends, begin reveal
      setTimeout(() => {
        setStage('reveal')
        // Stagger reveal lines
        REVEAL_LINES.forEach((_, i) => {
          setTimeout(() => setVisibleLines(i + 1), i * 1500)
        })
        // After all lines shown, show choices
        setTimeout(() => setStage('choices'), REVEAL_LINES.length * 1500 + 3000)
      }, 63000) // 60s track + 3s silence
    }, 5000)

    return () => {
      clearTimeout(computeTimer)
      if (trackRef.current) trackRef.current.stop()
    }
  }, [])

  const handleReplay = useCallback(() => {
    if (trackRef.current) trackRef.current.stop()
    setStage('playing')
    trackRef.current = audioEngine.generateProceduralTrack(avdValues, 60)
    setTimeout(() => {
      onNext({ revealChoice: 'hear_again' })
    }, 60000)
  }, [avdValues, onNext])

  const handleShowMe = useCallback(() => {
    if (trackRef.current) trackRef.current.stop()
    audioEngine.stopAll()
    onNext({ revealChoice: 'show_me' })
  }, [onNext])

  return (
    <div className="h-full w-full flex flex-col items-center justify-center select-none px-8"
         style={{ touchAction: 'manipulation' }}>

      {/* Computing stage */}
      <AnimatePresence>
        {stage === 'computing' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.span
              className="font-serif"
              style={{ fontSize: 'clamp(20px, 5vw, 28px)', color: 'var(--text)' }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              finding you...
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playing stage */}
      {stage === 'playing' && (
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <p className="font-serif" style={{ fontSize: 'clamp(20px, 5vw, 28px)', color: 'var(--text)' }}>
            this is yours
          </p>

          {/* AVD values */}
          <motion.div
            className="flex gap-8 justify-center mt-12 font-mono"
            style={{ fontSize: '12px', color: 'var(--accent)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            <span>A {avdValues.a.toFixed(2)}</span>
            <span>V {avdValues.v.toFixed(2)}</span>
            <span>D {avdValues.d.toFixed(2)}</span>
          </motion.div>
        </motion.div>
      )}

      {/* Reveal stage */}
      {(stage === 'reveal' || stage === 'choices') && (
        <motion.div
          className="text-center max-w-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {REVEAL_LINES.map((line, i) => (
            <motion.p
              key={i}
              className="font-serif mb-4"
              style={{ fontSize: 'clamp(16px, 4vw, 22px)', color: 'var(--text)' }}
              initial={{ opacity: 0, y: 10 }}
              animate={i < visibleLines ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              {line}
            </motion.p>
          ))}
        </motion.div>
      )}

      {/* Choices */}
      {stage === 'choices' && (
        <motion.div
          className="absolute bottom-16 left-0 right-0 flex justify-between px-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <button
            className="font-serif"
            style={{
              fontSize: '16px',
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '12px',
            }}
            onClick={handleReplay}
          >
            hear it again
          </button>
          <button
            className="font-serif"
            style={{
              fontSize: '16px',
              color: 'var(--text)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '12px',
            }}
            onClick={handleShowMe}
          >
            show me who I am
          </button>
        </motion.div>
      )}
    </div>
  )
}
