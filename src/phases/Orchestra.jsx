import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import OrchestraEngine from '../orchestra/OrchestraEngine.js'
import ConductingEngine from '../orchestra/ConductingEngine.js'
import BriefingScreen from '../orchestra/BriefingScreen.jsx'
import ClosingCard from '../orchestra/ClosingCard.jsx'
import { startOrchestraPreload, isPreloadComplete } from '../orchestra/preloader.js'
import {
  PHASES,
  BRIEFING_DURATION,
  END_FADE_DURATION,
  CLOSING_CARD_DURATION,
} from '../orchestra/constants.js'
import StemPlayer from '../lib/stemPlayer.js'
import { scoreArchetype } from '../lib/scoreArchetype.js'

export default function Orchestra({ avd, revealAudioRef, goToPhase, getAudioCtx, relayRef }) {
  const [phase, setPhase] = useState(() => isPreloadComplete() ? 'awaiting-tap' : 'loading') // loading | awaiting-tap | briefing | experience | closing
  const [loadProgress, setLoadProgress] = useState(0)

  const engineRef = useRef(null)
  const conductingRef = useRef(null)
  const audioCtxRef = useRef(null)
  const songDurationRef = useRef(0)
  const archetypeIdRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const lastRef = useRef(null)
  const fadeStartedRef = useRef(false)
  const wakeLockRef = useRef(null)

  // Score the archetype now so we know which Forer line to show on the
  // closing card. This is purely a read — scoreArchetype is deterministic
  // given current AVD + phase data.
  useEffect(() => {
    try {
      const scored = scoreArchetype(avd.getAVD(), avd.getPhaseData())
      archetypeIdRef.current = scored?.archetypeId || null
    } catch { /* leave null — ClosingCard handles missing */ }
  }, [avd])

  // ─── Initialize on mount ──────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!revealAudioRef?.current) {
        console.error('Orchestra: no audio handoff from Reveal')
        return
      }

      const audioCtx = getAudioCtx()
      if (!audioCtx) {
        console.error('Orchestra: no AudioContext available')
        return
      }
      audioCtxRef.current = audioCtx

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }

      const conducting = new ConductingEngine()
      conductingRef.current = conducting

      const engine = new OrchestraEngine(audioCtx)
      engineRef.current = engine

      const preloaded = await startOrchestraPreload(audioCtx)
      if (cancelled) return
      for (const [path, buf] of preloaded) {
        engine.buffers.set(path, buf)
      }
      setLoadProgress(1)

      engine.init()

      // Connect audio sources from Reveal handoff. Capture song duration
      // so the engine knows when to fade out.
      try {
        const handoff = revealAudioRef.current
        if (handoff instanceof StemPlayer) {
          // 4-stem path: detach the running BufferSources from Reveal's
          // sum bus and route them through the spatial graph.
          const sources = handoff.detachAndGetSources()
          if (sources) {
            engine.connectStems({
              vocals: sources.vocals,
              drums:  sources.drums,
              bass:   sources.bass,
              other:  sources.other,
            })
          }
          // Pull the longest stem buffer's duration as the song length.
          const dur = Math.max(
            handoff.buffers?.vocals?.duration || 0,
            handoff.buffers?.drums?.duration  || 0,
            handoff.buffers?.bass?.duration   || 0,
            handoff.buffers?.other?.duration  || 0,
          )
          songDurationRef.current = dur
        } else if (handoff && handoff.tagName === 'AUDIO') {
          // Single-master fallback — fan one MediaElementSource into all
          // 4 stem entry nodes. Spatial layout works; per-stem differentiation
          // is unavailable until Demucs stems land.
          const src = audioCtx.createMediaElementSource(handoff)
          engine.connectStems({ vocals: src, drums: src, bass: src, other: src })
          songDurationRef.current = handoff.duration || 0
        }
      } catch (e) {
        console.error('Orchestra: connectStems failed', e)
      }

      // Tell the engine how long the song is so its envelopes know when
      // the end-fade window opens.
      engine.setSongDuration(songDurationRef.current)

      if (!cancelled) setPhase('awaiting-tap')
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

  // ─── Tap-to-begin — iOS motion permission MUST be requested from a
  //     synchronous user-gesture handler, not from a useEffect. ───────────
  const handleTapToBegin = useCallback(() => {
    const conducting = conductingRef.current
    if (!conducting) return
    // Call requestPermission synchronously — its promise resolves after
    // iOS shows (and the user dismisses) the permission dialog. Don't await
    // here; React state transition handles the wait.
    conducting.requestPermission().then(() => {
      setPhase('briefing')
    })
  }, [])

  // ─── Briefing complete → start Bloom + Throne ────────────────────────────

  const handleBriefingComplete = useCallback(() => {
    const engine = engineRef.current
    const conducting = conductingRef.current
    const audioCtx = audioCtxRef.current

    if (!engine || !audioCtx) return

    if (conducting) conducting.start()

    // Set up an AnalyserNode tap for sharing audio with desktop viewers via WS.
    const analyserNode = audioCtxRef.current.createAnalyser()
    analyserNode.fftSize = 256  // → 128 frequency bins
    analyserNode.smoothingTimeConstant = 0.8
    let lastGestureSent = 0
    // Tap the directBus (the engine's pre-compressor sum). Connecting an analyser
    // doesn't affect the audio path — analyser is a passthrough on its output side.
    if (engine.directBus) engine.directBus.connect(analyserNode)
    const freqBuf = new Uint8Array(analyserNode.frequencyBinCount)
    let lastFftSent = 0

    engine.startAudience()

    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock })
        .catch(() => {})
    }

    setPhase('experience')

    // rAF loop — t is seconds since briefing-onset (NOT absolute audio
    // context time). Bloom fades in from t=BRIEFING_DURATION; song body
    // runs from t=PHASES.THRONE_START until t=songDuration; closing card
    // fires once the fade-out completes.
    const songDuration = songDurationRef.current

    const tick = (timestamp) => {
      if (!startRef.current) {
        startRef.current = timestamp
        lastRef.current = timestamp
      }

      const elapsed = (timestamp - startRef.current) / 1000
      lastRef.current = timestamp

      // Engine sees absolute briefing-relative time (we add BRIEFING_DURATION
      // because briefing already happened in the prior phase — but here the
      // briefing screen already ran, so elapsed=0 corresponds to BLOOM_START).
      const t = elapsed + PHASES.BLOOM_START

      engine.tick(t, songDuration)

      // Stream FFT samples to viewers at ~30 fps (33ms cadence)
      if (relayRef?.current && timestamp - lastFftSent > 33) {
        analyserNode.getByteFrequencyData(freqBuf)
        relayRef.current.send({
          type: 'audio',
          freq: Array.from(freqBuf),  // 128 numbers, 0..255
        })
        lastFftSent = timestamp
      }

      if (conducting) {
        const gesture = conducting.getData()
        engine.applyConducting(gesture)
        if (gesture.downbeat.fired && navigator.vibrate) {
          navigator.vibrate(15)
        }
        // Stream gesture snapshot to viewers at ~60 fps. Shape matches what
        // src/conductor-codex/motion.js::mapRelayMessage expects: raw α/β/γ
        // for the desktop-side calibration deltas (q omitted — viewer falls
        // back to raw deltas when q is absent). calibrated:false so the
        // desktop's mapRelayMessage doesn't keep resetting rawZero.
        if (relayRef?.current && timestamp - lastGestureSent > 16) {
          relayRef.current.send({
            type: 'gesture',
            raw: { alpha: gesture.yaw, beta: gesture.beta, gamma: gesture.gamma },
            gestureGain: gesture.gestureGain,
            articulation: gesture.articulation,
            downbeat: gesture.downbeat,
            rotationRate: gesture.rotationRate,
            accel: gesture.accel,
            calibrated: false,
            t: timestamp,
          })
          lastGestureSent = timestamp
        }
      }

      // Trigger master fade once we hit the end-fade window
      if (!fadeStartedRef.current && t >= songDuration - END_FADE_DURATION) {
        fadeStartedRef.current = true
        engine.fadeOut(END_FADE_DURATION)
      }

      // Transition to closing card after the song completes
      if (t >= songDuration) {
        engine.stopAll()
        const ref = revealAudioRef.current
        if (ref) {
          if (ref instanceof StemPlayer) ref.stop()
          else if (typeof ref.pause === 'function') ref.pause()
        }
        setPhase('closing')
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [revealAudioRef])

  // ─── Closing card complete → return to entry ─────────────────────────────

  const handleClosingComplete = useCallback(() => {
    goToPhase('entry')
  }, [goToPhase])

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

        {phase === 'awaiting-tap' && (
          <motion.div
            key="awaiting-tap"
            className="h-full w-full flex flex-col items-center justify-center cursor-pointer"
            style={{ background: '#F2EBD8', touchAction: 'none' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={handleTapToBegin}
            onTouchStart={handleTapToBegin}
          >
            <p
              className="font-serif italic"
              style={{
                fontSize: '20px',
                color: '#1C1814',
                opacity: 0.8,
                letterSpacing: '0.02em',
              }}
            >
              tap to begin
            </p>
          </motion.div>
        )}

        {phase === 'briefing' && (
          <motion.div key="briefing" className="h-full w-full"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <BriefingScreen
              durationMs={BRIEFING_DURATION * 1000}
              onComplete={handleBriefingComplete}
            />
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

        {phase === 'closing' && (
          <motion.div key="closing" className="h-full w-full"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            <ClosingCard
              archetypeId={archetypeIdRef.current}
              durationMs={CLOSING_CARD_DURATION * 1000}
              onComplete={handleClosingComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
