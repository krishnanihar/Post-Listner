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
  BLOOM_DURATION,
} from '../orchestra/constants.js'
import { scoreArchetype } from '../lib/scoreArchetype.js'
import { distillGlyph } from '../lib/glyph.js'
import { useVisibilityAudioPause } from '../hooks/useVisibilityAudioPause.js'
import TraceGlyph from '../world/TraceGlyph.jsx'
import { drawTraceGlyph } from '../world/traceModel.js'
import { NOCTURNE_ENABLED, THRONE_INTRO_RAMP_ENABLED, FALTER_ENABLED } from '../world/flags.js'
import {
  pushConducting,
  setBloom,
  setFalter,
  activateConducting,
  deactivateConducting,
} from '../world/conductingBridge.js'
import { createFalterState, stepFalter, reverbSendFactor } from '../lib/falter.js'

// Nocturne Act-II legibility (canon §7). The "instrument introduces itself":
// the first INTRO_RAMP_SEC of Throne runs conducting-response gains hotter so
// the first gestures unmistakably answer. FALTER_OPTS keys the diegetic falter
// off sustained high ARTICULATION (0..1 normalized), device-tunable.
const INTRO_RAMP_SEC = 20
const FALTER_OPTS = { jerkThreshold: 0.5, sustainMs: 4000 }

// Nocturne — WorldStage paints continuous hall light behind these screens now
// (canon §7: roll→pool, pitch→warmth, downbeat→strike rings, yaw→beam, bloom→
// widening). The previously opaque black/cream fills must let it show through.
// Off = byte-identical to the shipped fills.
const STAGE_FILL = NOCTURNE_ENABLED ? 'transparent' : '#000000'
const AWAITING_FILL = NOCTURNE_ENABLED ? 'transparent' : '#F2EBD8'
const AWAITING_INK = NOCTURNE_ENABLED ? '#E8E4DD' : '#1C1814' // matches phaseTheme's INK_LIGHT

export default function Orchestra({ avd, revealAudioRef, goToPhase, getAudioCtx, relayRef, glyphRef }) {
  const [phase, setPhase] = useState(() => isPreloadComplete() ? 'awaiting-tap' : 'loading') // loading | awaiting-tap | briefing | experience | closing
  const [loadProgress, setLoadProgress] = useState(0)

  const engineRef = useRef(null)
  const conductingRef = useRef(null)
  const audioCtxRef = useRef(null)
  const songDurationRef = useRef(0)
  const archetypeIdRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const startCtxRef = useRef(null)
  const lastRef = useRef(null)
  const fadeStartedRef = useRef(false)
  const wakeLockRef = useRef(null)
  // Slice 3 — raw conducting path [[pan, filterNorm, t], ...] accumulated
  // during the experience phase, distilled into the journal glyph at song end.
  const glyphBufRef = useRef([])

  // Throne feedback glyph — a faint amber gesture correlate drawn on a canvas
  // over the (previously bare black) Throne, so an audio change can be
  // attributed to your own motion. Driven by the same gesture the engine gets.
  const glyphCanvasRef = useRef(null)
  const glyphFxRef = useRef({ rings: [], reduced: false })

  // Nocturne — the diegetic falter detector state + a dt clock for it (kept
  // separate from the master timeline refs so the light never perturbs the
  // sacred loop). Only used behind flags.
  const falterStateRef = useRef(createFalterState())
  const falterPrevTsRef = useRef(0)

  // Battery: suspend stem playback while the app is backgrounded. Safe here —
  // the live Admirer conversation is already over by the Orchestra phase.
  useVisibilityAudioPause(useCallback(() => audioCtxRef.current, []), true)

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
        // Duck-typed handoff: both StemPlayer (4 Demucs stems) and
        // GenerativePlayer (4 frequency bands of one generated mix) expose the
        // same detachAndGetSources() contract. The engine's per-slot gain table
        // is selected from the player's sourceMode ('stems' default / 'bands').
        if (handoff && typeof handoff.detachAndGetSources === 'function') {
          engine.setSourceMode(handoff.sourceMode === 'bands' ? 'bands' : 'stems')
          // Detach the running sources from the preview sum bus and route them
          // through the spatial graph.
          const sources = handoff.detachAndGetSources()
          if (sources) {
            engine.connectStems({
              vocals: sources.vocals,
              drums:  sources.drums,
              bass:   sources.bass,
              other:  sources.other,
            })
          }
          // Song length: GenerativePlayer exposes .duration directly; StemPlayer
          // falls back to the longest of its 4 stem buffers.
          const dur = handoff.duration ?? Math.max(
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
      if (NOCTURNE_ENABLED) deactivateConducting()
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

    // Honor prefers-reduced-motion for the feedback glyph (essential conducting
    // motion itself is exempt per WCAG 2.5.4, but we soften the correlate).
    try {
      glyphFxRef.current.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false
      glyphFxRef.current.rings = []
    } catch { /* no matchMedia */ }

    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock })
        .catch(() => {})
    }

    setPhase('experience')

    // Nocturne — arm the light's Act-II channel (no-op when the flag is off).
    if (NOCTURNE_ENABLED) {
      falterStateRef.current = createFalterState()
      falterPrevTsRef.current = 0
      activateConducting()
    }

    // rAF loop — t is seconds since briefing-onset (NOT absolute audio
    // context time). Bloom fades in from t=BRIEFING_DURATION; song body
    // runs from t=PHASES.THRONE_START until t=songDuration; closing card
    // fires once the fade-out completes.
    const songDuration = songDurationRef.current

    // Nocturne intro-ramp scratch — reused across frames so the ramp branch
    // below doesn't `{...gesture, gestureGain}` a fresh object every frame.
    // Only the 7 fields OrchestraEngine.applyConducting actually destructures.
    const rampGesture = {
      pan: 0, filterNorm: 0, gestureGain: 0, articulation: 0,
      downbeat: null, yaw: 0, rotationRate: null,
    }

    const tick = (timestamp) => {
      const ctx = audioCtxRef.current
      if (!startRef.current) {
        startRef.current = timestamp
        lastRef.current = timestamp
        // Anchor the master timeline to the AUDIO clock, not wall-clock:
        // useVisibilityAudioPause suspends ctx (freezing ctx.currentTime AND
        // playback) while the tab is hidden, but performance.now() keeps
        // advancing — so a wall-clock `t` overshoots songDuration on return and
        // prematurely fades/stops a song that has barely played. ctx.currentTime
        // freezes with the audio, keeping `t` aligned with actual playback.
        startCtxRef.current = ctx ? ctx.currentTime : null
      }

      lastRef.current = timestamp

      // Seconds of ACTUAL playback since the experience loop began (audio clock),
      // falling back to wall-clock only if no ctx is available. elapsed=0 maps to
      // BLOOM_START (the briefing already ran in the prior screen).
      const elapsed = (ctx && startCtxRef.current != null)
        ? (ctx.currentTime - startCtxRef.current)
        : (timestamp - startRef.current) / 1000
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
        // Nocturne intro-ramp AUDIO arm (canon §7): the first INTRO_RAMP_SEC of
        // Throne runs the dynamics hotter (+30%→nominal) so the first gestures
        // unmistakably answer. Behind VITE_ENABLE_THRONE_INTRO_RAMP — the else
        // branch is the byte-identical shipped call. `elapsed - BLOOM_DURATION`
        // is seconds into Throne (negative during bloom → no boost).
        if (THRONE_INTRO_RAMP_ENABLED) {
          const throneElapsed = elapsed - BLOOM_DURATION
          if (throneElapsed >= 0 && throneElapsed < INTRO_RAMP_SEC) {
            const boost = 1 + 0.3 * (1 - throneElapsed / INTRO_RAMP_SEC)
            rampGesture.pan = gesture.pan
            rampGesture.filterNorm = gesture.filterNorm
            rampGesture.gestureGain = (gesture.gestureGain || 0) * boost
            rampGesture.articulation = gesture.articulation
            rampGesture.downbeat = gesture.downbeat
            rampGesture.yaw = gesture.yaw
            rampGesture.rotationRate = gesture.rotationRate
            engine.applyConducting(rampGesture)
          } else {
            engine.applyConducting(gesture)
          }
        } else {
          engine.applyConducting(gesture)
        }
        // Slice 3 — record the conducting path for the journal glyph.
        // roll→x (pan), pitch→y (filterNorm), both calibrated 0..1; t is ms
        // since the experience-phase rAF loop started.
        glyphBufRef.current.push([
          gesture.pan,
          gesture.filterNorm,
          elapsed * 1000, // audio-clock ms so the journal glyph tracks playback
        ])
        if (gesture.downbeat.fired && navigator.vibrate) {
          navigator.vibrate(15)
        }
        // Feed the feedback glyph: spawn a ring on the downbeat (unless reduced).
        if (gesture.downbeat.fired && !glyphFxRef.current.reduced) {
          const rings = glyphFxRef.current.rings
          rings.push({ start: timestamp, intensity: gesture.downbeat.intensity || 0.5 })
          if (rings.length > 6) rings.shift()
        }
        // The feedback glyph is decoration — isolate it so it can NEVER take
        // down the sacred conducting loop (which also drives the song-end fade/stop).
        const gc = glyphCanvasRef.current
        if (gc) { try { drawTraceGlyph(gc, gesture, glyphFxRef.current, timestamp) } catch { /* non-essential */ } }
        // Stream gesture snapshot to viewers at ~60 fps. Shape matches what
        // src/conductor-codex/motion.js::mapRelayMessage expects: raw α/β/γ
        // for the desktop-side calibration deltas (q omitted — viewer falls
        // back to raw deltas when q is absent).
        //
        // calibrated:true is required even though we don't run a tap-to-calibrate
        // flow — the desktop's ConductorCelestialField gates pitch/roll behind
        // state.calibrated, forcing them to 0 if false (cursor stays at center
        // → falls through to autonomous Lissajous). Setting true here is safe
        // because mapRelayMessage's rawZero-reset path requires both
        // calibrated AND isNearRest(q), and q is null in this code path so
        // isNearRest returns false. rawZero is captured once on the first
        // message and never updated, which is what we want.
        if (relayRef?.current && timestamp - lastGestureSent > 16) {
          relayRef.current.send({
            type: 'gesture',
            raw: { alpha: gesture.yaw, beta: gesture.beta, gamma: gesture.gamma },
            gestureGain: gesture.gestureGain,
            articulation: gesture.articulation,
            downbeat: gesture.downbeat,
            rotationRate: gesture.rotationRate,
            accel: gesture.accel,
            calibrated: true,
            t: timestamp,
          })
          lastGestureSent = timestamp
        }

        // Nocturne — hand the light its Act-II values. All decoration: a single
        // try/catch, zero-alloc field writes to the bridge (WorldStage does the
        // compositing on its OWN loop), so this can NEVER perturb the sacred
        // conducting loop. Bloom breadth couples the light to the reverb (both
        // widen together). The falter arm (behind its own flag) eases the hall
        // wet down under sustained chaos and tells the light to lean away.
        try {
          if (FALTER_ENABLED) {
            const dtMs = falterPrevTsRef.current ? (timestamp - falterPrevTsRef.current) : 16
            stepFalter(falterStateRef.current, gesture.articulation, dtMs, FALTER_OPTS)
            engine.setFalterReverbScale(reverbSendFactor(falterStateRef.current))
            falterPrevTsRef.current = timestamp
          }
          if (NOCTURNE_ENABLED) {
            pushConducting(gesture)
            setBloom((t - PHASES.BLOOM_START) / BLOOM_DURATION)
            setFalter(FALTER_ENABLED ? falterStateRef.current.reduction : 0)
          }
        } catch { /* non-essential — the light must never break conducting */ }
      }

      // Trigger master fade once we hit the end-fade window
      if (!fadeStartedRef.current && t >= songDuration - END_FADE_DURATION) {
        fadeStartedRef.current = true
        engine.fadeOut(END_FADE_DURATION)
      }

      // Transition to closing card after the song completes
      if (t >= songDuration) {
        engine.stopAll()
        if (NOCTURNE_ENABLED) deactivateConducting()
        // Slice 3 — distil the recorded conducting path into the glyph and
        // hand it to App (via the shared ref) for the entry relayed at settle.
        if (glyphRef) glyphRef.current = distillGlyph(glyphBufRef.current)
        const ref = revealAudioRef.current
        if (ref) {
          // StemPlayer / GenerativePlayer both expose stop(); the AUDIO-element
          // fallback only has pause().
          if (typeof ref.detachAndGetSources === 'function') ref.stop()
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
    goToPhase('settle')
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
    <div className="h-full w-full" style={{ background: STAGE_FILL }}>
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
            style={{ background: AWAITING_FILL, touchAction: 'none' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={handleTapToBegin}
            onTouchStart={handleTapToBegin}
          >
            <p
              className="font-serif italic"
              style={{
                fontSize: '20px',
                color: AWAITING_INK,
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
            style={{ background: STAGE_FILL, touchAction: 'none', position: 'relative' }}
            initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* The Trace — peripheral amber correlate of your gesture (extracted
                to src/world; behavior-identical to the shipped Throne glyph). */}
            <TraceGlyph ref={glyphCanvasRef} />
          </motion.div>
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

