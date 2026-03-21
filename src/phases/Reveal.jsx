import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import RevealVisualizer from '../components/RevealVisualizer'

const REVEAL_LINES = [
  'this music was composed by an algorithm',
  'it translated your choices into sound',
  'tempo, mood, texture, complexity',
  'no human wrote it',
  'the only human in this composition was you',
]

const LOADING_MESSAGES = [
  { at: 0,  text: 'finding you...' },
  { at: 8,  text: 'translating your choices...' },
  { at: 18, text: 'composing...' },
  { at: 32, text: 'almost there...' },
  { at: 50, text: 'crafting the final notes...' },
]

export default function Reveal({ onNext, avd, sessionData, revealAudioRef }) {
  const [stage, setStage] = useState('computing')
  // stages: computing | error | playing | reveal

  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0].text)
  const [visibleLines, setVisibleLines] = useState(0)
  const [avdValues] = useState(() => avd.getAVD())
  const [errorMessage, setErrorMessage] = useState('')
  const [isRetrying, setIsRetrying] = useState(false)

  const audioRef = useRef(null)
  const audioUrlRef = useRef(null)
  const loadingTimerRef = useRef(null)
  const computeStartRef = useRef(Date.now())
  const advancedRef = useRef(false)

  // Cleanup on unmount — audio persists into Orchestra via revealAudioRef
  useEffect(() => {
    return () => {
      clearInterval(loadingTimerRef.current)
    }
  }, [])

  // Evolving loading messages
  useEffect(() => {
    if (stage !== 'computing') return
    loadingTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - computeStartRef.current) / 1000
      const current = [...LOADING_MESSAGES].reverse().find(m => elapsed >= m.at)
      if (current) setLoadingMessage(current.text)
    }, 500)
    return () => clearInterval(loadingTimerRef.current)
  }, [stage])

  // Auto-advance to Orchestra after reveal lines finish
  const autoAdvance = useCallback(() => {
    if (advancedRef.current) return
    advancedRef.current = true

    // Save session data to localStorage (moved from Result.jsx)
    const currentAVD = avd.getAVD()
    const session = {
      sessionId: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      avd: currentAVD,
      phases: avd.getPhaseData(),
      selectedTrack: 'procedural',
      sunoPrompt: avd.getPrompt(),
    }
    try {
      localStorage.setItem('postlistener_session', JSON.stringify(session))
      const sessions = JSON.parse(localStorage.getItem('postlistener_sessions') || '[]')
      sessions.push(session)
      localStorage.setItem('postlistener_sessions', JSON.stringify(sessions))
    } catch (e) { /* localStorage full or unavailable */ }

    onNext()
  }, [onNext, avd])

  // Await music promise and play
  const awaitAndPlay = useCallback(async (promise) => {
    try {
      const audioUrl = await promise
      clearInterval(loadingTimerRef.current)
      audioUrlRef.current = audioUrl

      const audio = new Audio(audioUrl)
      audio.volume = 0.8
      audio.loop = true
      audioRef.current = audio
      if (revealAudioRef) revealAudioRef.current = audio

      await audio.play()
      setStage('playing')

      // Begin reveal when track reaches its natural end (first play-through)
      const beginReveal = () => {
        setStage('reveal')
        REVEAL_LINES.forEach((_, i) => {
          setTimeout(() => setVisibleLines(i + 1), i * 1500)
        })
        // After all lines shown + 3s hold → auto-advance to Orchestra
        const totalRevealTime = REVEAL_LINES.length * 1500 + 3000
        setTimeout(autoAdvance, totalRevealTime)
      }

      // Detect first play-through completion (loop=true means 'ended' never fires)
      let revealTriggered = false
      let maxTimeReached = 0
      const checkLoop = () => {
        if (revealTriggered) return
        // Track the highest currentTime we've seen
        if (audio.currentTime > maxTimeReached) {
          maxTimeReached = audio.currentTime
        }
        // Trigger when approaching track end (first play-through complete)
        if (audio.duration && audio.currentTime >= audio.duration - 0.5) {
          revealTriggered = true
          beginReveal()
          return
        }
        // Trigger if currentTime wraps back (looped), proving first pass finished
        if (maxTimeReached > 5 && audio.currentTime < maxTimeReached - 2) {
          revealTriggered = true
          beginReveal()
          return
        }
        requestAnimationFrame(checkLoop)
      }
      setTimeout(() => requestAnimationFrame(checkLoop), 1000)
      // Safety ceiling
      setTimeout(() => { if (!revealTriggered) { revealTriggered = true; beginReveal() } }, 65000)

    } catch (err) {
      clearInterval(loadingTimerRef.current)
      console.error('Music generation failed:', err)
      setErrorMessage(err.message || 'The composition failed to arrive.')
      setStage('error')
      setIsRetrying(false)
    }
  }, [autoAdvance, revealAudioRef])

  useEffect(() => {
    const promise = sessionData?.musicPromise
    if (!promise) {
      setErrorMessage('No music generation was initiated.')
      setStage('error')
      return
    }
    awaitAndPlay(promise)
  }, [])

  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    setStage('computing')
    setLoadingMessage(LOADING_MESSAGES[0].text)
    computeStartRef.current = Date.now()
    const newPromise = Promise.resolve('/chamber/tracks/track-a.mp3')
    awaitAndPlay(newPromise)
  }, [avd, awaitAndPlay])

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center select-none px-8"
      style={{ touchAction: 'manipulation', position: 'relative' }}
    >
      {/* Visualizer */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <RevealVisualizer avd={avd} stage={stage} audioElement={audioRef.current} />
      </div>

      <AnimatePresence mode="wait">
        {/* COMPUTING */}
        {stage === 'computing' && (
          <motion.div
            key="computing"
            className="absolute inset-0 flex flex-col items-center justify-center gap-8"
            style={{ zIndex: 1 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.span
              className="font-serif text-center"
              style={{ fontSize: 'clamp(20px, 5vw, 28px)', color: 'var(--text)', opacity: 0.8 }}
              key={loadingMessage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {loadingMessage}
            </motion.span>
            <motion.div
              className="rounded-full"
              style={{ width: 6, height: 6, background: 'var(--accent)' }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}

        {/* ERROR */}
        {stage === 'error' && (
          <motion.div
            key="error"
            className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-8"
            style={{ zIndex: 1 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="font-serif text-center" style={{ fontSize: 'clamp(16px, 4vw, 22px)', color: 'var(--text-dim)', maxWidth: '320px', lineHeight: 1.6 }}>
              {errorMessage}
            </p>
            <motion.button
              className="font-serif"
              style={{ fontSize: '16px', color: 'var(--accent)', background: 'none', border: 'none', cursor: isRetrying ? 'not-allowed' : 'pointer', padding: '12px 24px', opacity: isRetrying ? 0.5 : 1 }}
              whileTap={{ scale: 0.97 }}
              onClick={isRetrying ? undefined : handleRetry}
            >
              {isRetrying ? 'retrying...' : 'try again'}
            </motion.button>
          </motion.div>
        )}

        {/* PLAYING */}
        {stage === 'playing' && (
          <motion.div
            key="playing"
            className="absolute inset-x-0 text-center px-8"
            style={{ zIndex: 1, bottom: '22%' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <p className="font-serif" style={{ fontSize: 'clamp(20px, 5vw, 28px)', color: 'var(--text)' }}>
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

        {/* REVEAL — lines appear, then auto-advance */}
        {stage === 'reveal' && (
          <motion.div
            key="reveal"
            className="absolute inset-x-0 text-center px-8 max-w-sm mx-auto"
            style={{ zIndex: 1, bottom: '18%' }}
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
    </div>
  )
}
