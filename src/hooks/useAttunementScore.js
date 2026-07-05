// src/hooks/useAttunementScore.js
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { initialState, reduce } from '../lib/attunementReducer.js'
import { getMovement } from '../lib/attunementMovements.js'
import { usePhoneMotion } from './usePhoneMotion.js'
import { getAvd, commitTurn, setAvd } from '../lib/avdStore.js'
import { leanLiftTarget, listenTarget, riseTarget, riseHedonic } from '../lib/attunementToAvd.js'
import { archetypeRing, nearestArchetypeToYaw, archetypeAnchorVector, preloadDecision } from '../lib/archetypeRing.js'
import { setWarmth, setDepth, setEnergy, setWorld, warmthBucket, depthBucket, energyBucket } from '../lib/reflectionState.js'

// Score-led: the client owns pacing. The hook reads the phone each frame for
// the active move-movement, writes taste on commit, advances the room
// expansion, and fires onBloom when Face commits. onExpansion(t) lets the host
// open the AdmirerRoom; onSpeculativePreload(archetypeId) starts the silent
// StemPlayer load during Rise; onReact(movementId, payload) feeds the
// companion voice a contextual update; onAsk(movementId, askText) fires once on
// movement entry so the companion can voice that movement's question aloud.
export function useAttunementScore({ onExpansion, onSpeculativePreload, onBloom, onReact, onAsk } = {}) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState)
  const { read: readMotion, calibrate } = usePhoneMotion()
  const ring = useRef(archetypeRing()).current

  // One-time calibration to the user's resting hold, ~1.5s after mount — the
  // user is holding the phone still through arrival/welcome, which makes a
  // good neutral. Mirrors Act 2's ConductingEngine.startCalibration (which
  // calibrates once, 2s into Throne); Act 1 never calibrated at all before
  // this, so leanLift/listen read gesture offsets against a hardcoded
  // baseline instead of this user's actual hold. calibrate is stable
  // (usePhoneMotion memoizes it), so this effect only ever schedules once.
  useEffect(() => {
    const timer = setTimeout(() => { calibrate() }, 1500)
    return () => clearTimeout(timer)
  }, [calibrate])

  const movement = getMovement(state.movementId)

  // Per-movement transient accumulators (reset on movement entry).
  const enteredAtRef = useRef(0)
  const baselineYawRef = useRef(null)
  const peakSwellRef = useRef(0)
  const rodeClimaxRef = useRef(false)
  const lastPreloadRef = useRef(null)
  const liveRef = useRef({ pan: 0.5, filterNorm: 0.5, relYaw: 0, swell: 0, downbeatCount: 0, committedBalance: null, committedBrightness: null })

  // FIX 5 — tiny haptic helper; no-ops where vibration is unsupported.
  const vibrate = (ms) => { try { navigator.vibrate?.(ms) } catch { /* unsupported */ } }

  useEffect(() => {
    enteredAtRef.current = performance.now()
    baselineYawRef.current = null
    peakSwellRef.current = 0
    rodeClimaxRef.current = false
    liveRef.current = { pan: 0.5, filterNorm: 0.5, relYaw: 0, swell: 0, downbeatCount: 0, committedBalance: null, committedBrightness: null }
    // On movement entry, ask the companion to voice this movement's question.
    // Fires exactly once per movement: this effect is keyed on state.movementId,
    // and onAsk is a stable host useCallback so its identity never changes
    // mid-movement (no spurious re-runs). Movements with ask:null (arrival,
    // bloom) say nothing on entry.
    const m = getMovement(state.movementId)
    if (m?.ask) onAsk?.(state.movementId, m.ask)
  }, [state.movementId, onAsk])

  // Sample gestures each frame for the active move-movement.
  useEffect(() => {
    if (!movement || movement.kind !== 'move' || state.status !== 'active') return undefined
    let raf = 0
    let mounted = true
    const tick = () => {
      if (!mounted) return
      const m = readMotion()
      if (movement.id === 'leanLift') {
        liveRef.current.pan = m.pan
        liveRef.current.filterNorm = m.filterNorm
      } else if (movement.id === 'listen') {
        liveRef.current.filterNorm = m.filterNorm
      } else if (movement.id === 'rise') {
        if (m.gestureGain > peakSwellRef.current) peakSwellRef.current = m.gestureGain
        // FIX 3 — expose live swell so the host can drive setSwell each frame.
        liveRef.current.swell = m.gestureGain
        if (m.downbeat?.fired) {
          rodeClimaxRef.current = peakSwellRef.current > 0.5
          // Publish a monotonic strike counter the Rise overlay polls to commit
          // (the down-stroke seals the build — no timer).
          liveRef.current.downbeatCount += 1
          onReact?.('rise', { downbeat: true, intensity: m.downbeat.intensity })
          // FIX 5 — tactile tick on the down-stroke.
          vibrate(12)
        }
        // Speculative pre-load on the in-progress vector, once Rise is underway.
        const dec = preloadDecision(lastPreloadRef.current, getAvd())
        if (dec.changed) {
          lastPreloadRef.current = dec.archetypeId
          onSpeculativePreload?.(dec.archetypeId)
        }
      } else if (movement.id === 'face') {
        // A down-stroke is the "choose this world" confirm (reuses the strike
        // taught in rise); publish it for the Face overlay to poll.
        if (m.downbeat?.fired) liveRef.current.downbeatCount += 1
        if (baselineYawRef.current === null) baselineYawRef.current = m.yaw
        let rel = m.yaw - baselineYawRef.current
        rel = ((rel + 540) % 360) - 180 // wrap to [-180,180]
        liveRef.current.relYaw = rel
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { mounted = false; cancelAnimationFrame(raf) }
  }, [movement, state.status, readMotion, onReact, onSpeculativePreload])

  // Commit the active movement: write taste, advance expansion, react, advance.
  // `captured` is the axis value at the brink-crossing frame — pan for leanLift,
  // filterNorm for listen. `subIndex` is the sub-round (0-based) for beats with
  // a `subfaces` array; each sub-round writes the axis (gain from that subface),
  // but only the LAST sub-round dispatches COMMIT — so the reducer still sees
  // exactly one commit→advance per beat. Beats without subfaces pass subIndex 0.
  const commit = useCallback((captured, subIndex = 0) => {
    if (!movement || state.status !== 'active') return
    const cur = getAvd()
    const subfaces = movement.subfaces
    const isLast = !subfaces || subIndex >= subfaces.length - 1
    if (movement.id === 'leanLift') {
      // Roll → Valence. The pan captured at the crossing carries the intensity.
      // Sub-round gain: SR1 full, SR2 ~half (refines, doesn't overwrite); the
      // EWMA converges across the two reads. The reflection bucket reads the
      // CONVERGED valence after the commit, so the last sub-round sets it.
      const pan = captured ?? liveRef.current.pan
      const target = leanLiftTarget(pan, 0.5, cur)
      const gain = subfaces?.[subIndex]?.gain ?? movement.gain
      commitTurn(target, { gain, confidence: 1 })
      liveRef.current.committedBalance = (pan - 0.5) * 2 // hold the audio to the chosen side
      setWarmth(warmthBucket(getAvd().v)) // converged — capture for the reflection
      vibrate(15) // FIX 5
      onReact?.('leanLift', { valence: target.v, depth: target.d })
    } else if (movement.id === 'listen') {
      // Pitch → Depth. Two sub-rounds (gain split SR1/SR2) converge the axis;
      // the reflection depth bucket reads the CONVERGED value after the commit.
      const fn = captured ?? liveRef.current.filterNorm
      const target = listenTarget(fn, cur)
      const gain = subfaces?.[subIndex]?.gain ?? movement.gain
      commitTurn(target, { gain, confidence: 1 })
      // Hold the bed at the chosen extreme: forward (fn<0.5) = fully dark/inward
      // (brightness 0), matching the Orchestra.
      liveRef.current.committedBrightness = (fn - 0.5) < 0 ? 0 : 1
      setDepth(depthBucket(getAvd().d)) // converged — capture for the reflection
      vibrate(15) // FIX 5
      onReact?.('listen', { depth: target.d })
    } else if (movement.id === 'rise') {
      const target = riseTarget(peakSwellRef.current, rodeClimaxRef.current, cur)
      commitTurn(target, { gain: movement.gain })
      setEnergy(energyBucket(peakSwellRef.current)) // capture for the reflection
      vibrate(25) // FIX 5
      onReact?.('rise', { arousal: target.a, hedonic: riseHedonic(rodeClimaxRef.current) })
    } else if (movement.id === 'face') {
      const id = nearestArchetypeToYaw(liveRef.current.relYaw, ring)
      // Hard-snap onto the faced world's centroid so routing — nearest-centroid
      // over the committed vector at bloom — deterministically returns the world
      // the listener faced ("the six face-worlds ARE the archetype centroids").
      // A commitTurn blend lands an EWMA step short of the centroid and
      // misroutes ~2/3 of the time; the lean's taste still shapes the Rise-time
      // speculative preload, so nothing is lost by hard-setting here.
      setAvd(archetypeAnchorVector(id))
      setWorld(id) // capture the faced world for the reflection
      vibrate(20) // FIX 5
      onReact?.('face', { archetypeId: id })
    }
    // Intermediate sub-rounds write taste but DON'T advance — only the last one
    // commits the beat (the overlay loops its own sub-rounds; the reducer sees
    // one commit per beat).
    if (isLast) dispatch({ type: 'COMMIT' })
  }, [movement, state.status, ring, onReact])

  const advance = useCallback(() => {
    // COMMIT first so arrival (talk) — which never goes through commit() —
    // becomes 'committed' and the status-guarded reducer will ADVANCE. The
    // move beats already COMMIT on their gesture, so this is a no-op for them;
    // React batches both
    // dispatches into one render, so there's no intermediate flash. Calling
    // advance() twice stays safe (both dispatches are idempotent guards).
    dispatch({ type: 'COMMIT' })
    dispatch({ type: 'ADVANCE' })
    if (movement) onExpansion?.(movement.expansionTo)
  }, [movement, onExpansion])

  // When Face has committed and we advance into Bloom, fire the handoff.
  useEffect(() => {
    if (state.movementId === 'bloom' && state.status === 'active') {
      onBloom?.()
    }
  }, [state.movementId, state.status, onBloom])

  return { state, movement, commit, advance, live: liveRef }
}
