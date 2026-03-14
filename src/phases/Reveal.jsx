import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateMusic, generateMusicWithPlan } from '../engine/elevenlabs'

const REVEAL_LINES = [
  'this music was composed by an algorithm',
  'it translated your choices into sound',
  'tempo, mood, texture, complexity',
  'no human wrote it',
  'the only human in this composition was you',
]

// Evolving loading messages during generation wait
const LOADING_MESSAGES = [
  { at: 0,  text: 'finding you...' },
  { at: 8,  text: 'translating your choices...' },
  { at: 18, text: 'composing...' },
  { at: 32, text: 'almost there...' },
  { at: 50, text: 'crafting the final notes...' },
]

export default function Reveal({ onNext, avd, sessionData, goToPhase }) {
  const [stage, setStage] = useState('computing')
  // stages: computing | error | playing | reveal | choices

  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0].text)
  const [visibleLines, setVisibleLines] = useState(0)
  const [avdValues] = useState(() => avd.getAVD())
  const [errorMessage, setErrorMessage] = useState('')
  const [isRetrying, setIsRetrying] = useState(false)

  const audioRef = useRef(null)    // HTMLAudioElement for ElevenLabs track
  const audioUrlRef = useRef(null) // object URL to revoke on unmount
  const loadingTimerRef = useRef(null)
  const computeStartRef = useRef(Date.now())

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(loadingTimerRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
      }
    }
  }, [])

  // Evolving loading messages based on elapsed time
  useEffect(() => {
    if (stage !== 'computing') return

    loadingTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - computeStartRef.current) / 1000
      // Find the most recent message whose `at` time has passed
      const current = [...LOADING_MESSAGES]
        .reverse()
        .find(m => elapsed >= m.at)
      if (current) setLoadingMessage(current.text)
    }, 500)

    return () => clearInterval(loadingTimerRef.current)
  }, [stage])

  // Await the music promise passed from Moment
  const awaitAndPlay = useCallback(async (promise) => {
    try {
      const audioUrl = await promise
      clearInterval(loadingTimerRef.current)
      audioUrlRef.current = audioUrl

      // Create audio element and play
      const audio = new Audio(audioUrl)
      audio.volume = 0.8
      audioRef.current = audio

      await audio.play()
      setStage('playing')

      // After track ends (or after 65s ceiling), begin reveal
      const beginReveal = () => {
        setStage('reveal')
        REVEAL_LINES.forEach((_, i) => {
          setTimeout(() => setVisibleLines(i + 1), i * 1500)
        })
        setTimeout(() => setStage('choices'), REVEAL_LINES.length * 1500 + 3000)
      }

      audio.addEventListener('ended', beginReveal)
      // Safety ceiling: if track doesn't fire 'ended' after 65s, advance anyway
      setTimeout(beginReveal, 65000)

    } catch (err) {
      clearInterval(loadingTimerRef.current)
      console.error('Music generation failed:', err)
      setErrorMessage(err.message || 'The composition failed to arrive.')
      setStage('error')
      setIsRetrying(false)
    }
  }, [])

  // Initial: await the promise from sessionData
  useEffect(() => {
    const promise = sessionData?.musicPromise
    if (!promise) {
      // No promise (shouldn't happen) — show error
      setErrorMessage('No music generation was initiated.')
      setStage('error')
      return
    }
    awaitAndPlay(promise)
  }, []) // run once on mount

  // Retry: re-call ElevenLabs
  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    setStage('computing')
    setLoadingMessage(LOADING_MESSAGES[0].text)
    computeStartRef.current = Date.now()

    const newPromise = generateMusicWithPlan(avd.getCompositionPlan())
      .catch(() => generateMusic(avd.getPrompt()))
    awaitAndPlay(newPromise)
  }, [avd, awaitAndPlay])

  const handleReplay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
      setStage('playing')
    }
  }, [])

  const handleShowMe = useCallback(() => {
    if (audioRef.current) audioRef.current.pause()
    onNext({ revealChoice: 'show_me' })
  }, [onNext])

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center select-none px-8"
      style={{ touchAction: 'manipulation' }}
    >
      {/* COMPUTING stage */}
      <AnimatePresence mode="wait">
        {stage === 'computing' && (
          <motion.div
            key="computing"
            className="absolute inset-0 flex flex-col items-center justify-center gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.span
              className="font-serif text-center"
              style={{ fontSize: 'clamp(20px, 5vw, 28px)', color: 'var(--text)' }}
              key={loadingMessage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {loadingMessage}
            </motion.span>

            {/* Subtle amber pulse dot */}
            <motion.div
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                background: 'var(--accent)',
              }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}

        {/* ERROR stage */}
        {stage === 'error' && (
          <motion.div
            key="error"
            className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p
              className="font-serif text-center"
              style={{
                fontSize: 'clamp(16px, 4vw, 22px)',
                color: 'var(--text-dim)',
                maxWidth: '320px',
                lineHeight: 1.6,
              }}
            >
              {errorMessage}
            </p>

            <motion.button
              className="font-serif"
              style={{
                fontSize: '16px',
                color: 'var(--accent)',
                background: 'none',
                border: 'none',
                cursor: isRetrying ? 'not-allowed' : 'pointer',
                padding: '12px 24px',
                opacity: isRetrying ? 0.5 : 1,
              }}
              whileTap={{ scale: 0.97 }}
              onClick={isRetrying ? undefined : handleRetry}
            >
              {isRetrying ? 'retrying...' : 'try again'}
            </motion.button>

            <p
              className="font-mono text-center"
              style={{ fontSize: '9px', color: 'var(--text-dim)' }}
            >
              check your connection and api key
            </p>
          </motion.div>
        )}

        {/* PLAYING stage */}
        {stage === 'playing' && (
          <motion.div
            key="playing"
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <p
              className="font-serif"
              style={{ fontSize: 'clamp(20px, 5vw, 28px)', color: 'var(--text)' }}
            >
              this is yours
            </p>

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

        {/* REVEAL + CHOICES stages */}
        {(stage === 'reveal' || stage === 'choices') && (
          <motion.div
            key="reveal"
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
      </AnimatePresence>

      {/* CHOICES — bottom buttons */}
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
