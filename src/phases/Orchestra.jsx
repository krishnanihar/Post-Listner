import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import OrchestraEngine from '../orchestra/OrchestraEngine.js'
import ConductingEngine from '../orchestra/ConductingEngine.js'
import VoiceScheduler from '../orchestra/VoiceScheduler.js'
import BriefingScreen from '../orchestra/BriefingScreen.jsx'
import ReturnScreen from '../orchestra/ReturnScreen.jsx'
import { getAllPaths } from '../orchestra/scripts.js'
import { STARTS } from '../orchestra/constants.js'

export default function Orchestra({ avd, revealAudioRef, goToPhase }) {
  const [phase, setPhase] = useState('loading') // loading | briefing | experience | return
  const [loadProgress, setLoadProgress] = useState(0)
  const [experiencePhase, setExperiencePhase] = useState('bloom')

  const engineRef = useRef(null)
  const conductingRef = useRef(null)
  const schedulerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const lastRef = useRef(null)
  const returnTonePlayed = useRef(false)
  const wakeLockRef = useRef(null)

  // ─── Initialize on mount ──────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function init() {
      // Verify audio element exists
      if (!revealAudioRef?.current) {
        console.error('Orchestra: no audio element from Reveal')
        return
      }

      // Create AudioContext
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = audioCtx

      // Resume if suspended (iOS)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }

      // Create and initialize ConductingEngine
      const conducting = new ConductingEngine()
      conductingRef.current = conducting
      await conducting.requestPermission()

      // Create OrchestraEngine and preload
      const engine = new OrchestraEngine(audioCtx)
      engineRef.current = engine

      const paths = getAllPaths()
      await engine.preloadAll(paths, (progress) => {
        if (!cancelled) setLoadProgress(progress)
      })

      // Initialize audio graph
      engine.init()

      // Create VoiceScheduler
      const scheduler = new VoiceScheduler(engine)
      schedulerRef.current = scheduler

      if (!cancelled) {
        setPhase('briefing')
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [revealAudioRef])

  // ─── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (engineRef.current) engineRef.current.stopAll()
      if (conductingRef.current) conductingRef.current.stop()
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
      }
      // Don't close AudioContext here — audio element may still be needed
    }
  }, [])

  // ─── Briefing complete → start experience ─────────────────────────────────

  const handleBriefingComplete = useCallback(() => {
    const engine = engineRef.current
    const conducting = conductingRef.current
    const scheduler = schedulerRef.current
    const audioCtx = audioCtxRef.current

    if (!engine || !audioCtx) return

    // Resume AudioContext if needed
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }

    // Connect the song (creates MediaElementSource)
    engine.connectSong(revealAudioRef.current)

    // Start conducting (motion listeners + calibration)
    if (conducting) conducting.start()

    // Start audience ambient
    engine.startAudience()

    // Schedule all voices and ovation
    const experienceStart = audioCtx.currentTime
    scheduler.scheduleAll(experienceStart)

    // Request wake lock
    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock })
        .catch(() => {})
    }

    // Set phase and start rAF loop
    setPhase('experience')

    const tick = (timestamp) => {
      if (!startRef.current) {
        startRef.current = timestamp
        lastRef.current = timestamp
      }

      const elapsed = (timestamp - startRef.current) / 1000
      const dt = (timestamp - lastRef.current) / 1000
      lastRef.current = timestamp

      // Absolute time from button press (30s briefing already happened)
      const t = elapsed + 30

      // Update engine
      engine.tick(t, dt)

      // Get conducting data and apply
      if (conducting) {
        const gesture = conducting.getData()
        engine.applyConducting(gesture)

        // Haptic on downbeat
        if (gesture.downbeat.fired && navigator.vibrate) {
          navigator.vibrate(15)
        }
      }

      // Update experience phase for React state
      if (t >= STARTS.SILENCE && experiencePhase !== 'silence') {
        setExperiencePhase('silence')
      } else if (t >= STARTS.DISSOLUTION && experiencePhase !== 'dissolution') {
        setExperiencePhase('dissolution')
      } else if (t >= STARTS.ASCENT && experiencePhase !== 'ascent') {
        setExperiencePhase('ascent')
      } else if (t >= STARTS.THRONE && experiencePhase !== 'throne') {
        setExperiencePhase('throne')
      }

      // Return tone at ~9:55 (595s absolute)
      if (t >= 595 && !returnTonePlayed.current) {
        engine.playReturnTone(avd.getAVD().d)
        returnTonePlayed.current = true
      }

      // Transition to return at 600s
      if (t >= 600) {
        engine.stopAll()
        // Stop the user's song
        if (revealAudioRef.current) {
          revealAudioRef.current.pause()
        }
        setPhase('return')
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [avd, revealAudioRef, experiencePhase])

  // ─── Return handler ───────────────────────────────────────────────────────

  const handleReturn = useCallback(() => {
    goToPhase('result')
  }, [goToPhase])

  // ─── Touch handlers (fallback conducting) ─────────────────────────────────

  const handleTouchMove = useCallback((e) => {
    if (!conductingRef.current) return
    const touch = e.touches[0]
    const nx = touch.clientX / window.innerWidth
    const ny = 1 - (touch.clientY / window.innerHeight)
    conductingRef.current.updateTouch(nx, ny, true)
  }, [])

  const handleTouchStart = useCallback(() => {
    if (conductingRef.current) conductingRef.current.updateTouch(0.5, 0.5, true)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (conductingRef.current) conductingRef.current.updateTouch(0.5, 0.5, false)
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full w-full" style={{ background: '#000000' }}>
      <AnimatePresence mode="wait">
        {/* LOADING */}
        {phase === 'loading' && (
          <motion.div
            key="loading"
            className="h-full w-full flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p
              className="font-serif"
              style={{ fontSize: '16px', color: 'var(--text-dim)', marginBottom: 24 }}
            >
              preparing...
            </p>
            <div
              style={{
                width: 120,
                height: 2,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 1,
              }}
            >
              <motion.div
                style={{
                  height: '100%',
                  background: 'var(--accent)',
                  borderRadius: 1,
                }}
                animate={{ width: `${loadProgress * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}

        {/* BRIEFING */}
        {phase === 'briefing' && (
          <motion.div
            key="briefing"
            className="h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <BriefingScreen onComplete={handleBriefingComplete} avd={avd} />
          </motion.div>
        )}

        {/* EXPERIENCE — pure black screen */}
        {phase === 'experience' && (
          <motion.div
            key="experience"
            className="h-full w-full"
            style={{
              background: '#000000',
              touchAction: 'none',
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        )}

        {/* RETURN */}
        {phase === 'return' && (
          <motion.div
            key="return"
            className="h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 3 }}
          >
            <ReturnScreen avd={avd} onReturn={handleReturn} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
