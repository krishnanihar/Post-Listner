import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import OrchestraEngine from '../orchestra/OrchestraEngine.js'
import ConductingEngine from '../orchestra/ConductingEngine.js'
import VoiceScheduler from '../orchestra/VoiceScheduler.js'
import BriefingScreen from '../orchestra/BriefingScreen.jsx'
import ReturnScreen from '../orchestra/ReturnScreen.jsx'
import { getAllPaths } from '../orchestra/scripts.js'
import { STARTS, TOTAL_DURATION } from '../orchestra/constants.js'

export default function Orchestra({ avd, revealAudioRef, goToPhase, getAudioCtx }) {
  const [phase, setPhase] = useState('loading') // loading | briefing | experience | return
  const [loadProgress, setLoadProgress] = useState(0)

  const engineRef = useRef(null)
  const conductingRef = useRef(null)
  const schedulerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const lastRef = useRef(null)
  const returnTonePlayed = useRef(false)
  const returnToneFaded = useRef(false)
  const wakeLockRef = useRef(null)

  // ─── Initialize on mount ──────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!revealAudioRef?.current) {
        console.error('Orchestra: no audio element from Reveal')
        return
      }

      // Reuse the AudioContext created during Entry phase tap — already resumed
      const audioCtx = getAudioCtx()
      if (!audioCtx) {
        console.error('Orchestra: no AudioContext available')
        return
      }
      audioCtxRef.current = audioCtx

      // Ensure it's running (it should be from the Entry tap)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }

      // ConductingEngine
      const conducting = new ConductingEngine()
      conductingRef.current = conducting
      await conducting.requestPermission()

      // OrchestraEngine — preload and init
      const engine = new OrchestraEngine(audioCtx)
      engineRef.current = engine

      await engine.preloadAll(getAllPaths(), (progress) => {
        if (!cancelled) setLoadProgress(progress)
      })

      engine.init()

      // Connect song immediately — AudioContext is already running from Entry tap
      try {
        engine.connectSong(revealAudioRef.current)
      } catch (e) {
        console.error('Orchestra: connectSong failed', e)
      }

      // VoiceScheduler
      schedulerRef.current = new VoiceScheduler(engine)

      if (!cancelled) setPhase('briefing')
    }

    init()
    return () => { cancelled = true }
  }, [revealAudioRef, getAudioCtx])

  // ─── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (engineRef.current) engineRef.current.stopAll()
      if (conductingRef.current) conductingRef.current.stop()
      if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {})
    }
  }, [])

  // ─── Briefing complete → start experience (auto, no button) ───────────────

  const handleBriefingComplete = useCallback(() => {
    const engine = engineRef.current
    const conducting = conductingRef.current
    const scheduler = schedulerRef.current
    const audioCtx = audioCtxRef.current

    if (!engine || !audioCtx) return

    // Start conducting
    if (conducting) conducting.start()

    // Start audience ambient
    engine.startAudience()

    // Schedule all voices (pass AVD for dynamic line selection)
    scheduler.scheduleAll(audioCtx.currentTime, avd.getAVD())

    // Wake lock
    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock })
        .catch(() => {})
    }

    setPhase('experience')

    // rAF loop
    const tick = (timestamp) => {
      if (!startRef.current) {
        startRef.current = timestamp
        lastRef.current = timestamp
      }

      const elapsed = (timestamp - startRef.current) / 1000
      const dt = (timestamp - lastRef.current) / 1000
      lastRef.current = timestamp

      const t = elapsed + STARTS.BLOOM // absolute time (briefing already happened)

      engine.tick(t, dt)

      if (conducting) {
        const gesture = conducting.getData()
        engine.applyConducting(gesture)
        if (gesture.downbeat.fired && navigator.vibrate) {
          navigator.vibrate(15)
        }
      }

      // Return tone at 14:20 (860s) — sine wave from depth value, fades in over 8s
      if (t >= STARTS.RETURN + 5 && !returnTonePlayed.current) {
        engine.playReturnTone(avd.getAVD().d)
        returnTonePlayed.current = true
      }

      // Fade return tone before stopAll
      if (t >= STARTS.END - 5 && !returnToneFaded.current) {
        engine.fadeReturnTone(3)
        returnToneFaded.current = true
      }

      // Transition to return at 960s (16:00)
      if (t >= STARTS.END) {
        engine.stopAll()
        if (revealAudioRef.current) revealAudioRef.current.pause()
        setPhase('return')
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [avd, revealAudioRef])

  // ─── Touch handlers (fallback conducting) ─────────────────────────────────

  const handleTouchMove = useCallback((e) => {
    if (!conductingRef.current) return
    const touch = e.touches[0]
    conductingRef.current.updateTouch(touch.clientX / window.innerWidth, 1 - touch.clientY / window.innerHeight, true)
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
        {phase === 'loading' && (
          <motion.div
            key="loading"
            className="h-full w-full flex flex-col items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="font-serif" style={{ fontSize: '16px', color: 'var(--text-dim)', marginBottom: 24 }}>
              preparing...
            </p>
            <div style={{ width: 120, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
              <motion.div
                style={{ height: '100%', background: 'var(--accent)', borderRadius: 1 }}
                animate={{ width: `${loadProgress * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}

        {phase === 'briefing' && (
          <motion.div key="briefing" className="h-full w-full"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <BriefingScreen onComplete={handleBriefingComplete} />
          </motion.div>
        )}

        {phase === 'experience' && (
          <motion.div key="experience" className="h-full w-full"
            style={{ background: '#000000', touchAction: 'none' }}
            initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        )}

        {phase === 'return' && (
          <motion.div key="return" className="h-full w-full"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 3 }}
          >
            <ReturnScreen avd={avd} onReturn={() => goToPhase('reveal')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
