// src/hooks/useAttunementScore.js
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { initialState, reduce } from '../lib/attunementReducer.js'
import { getMovement } from '../lib/attunementMovements.js'
import { usePhoneMotion } from './usePhoneMotion.js'
import { getAvd, commitTurn } from '../lib/avdStore.js'
import { leanLiftTarget, riseTarget, riseHedonic, dwellConfidence } from '../lib/attunementToAvd.js'
import { archetypeRing, nearestArchetypeToYaw, archetypeAnchorVector, preloadDecision } from '../lib/archetypeRing.js'

// Score-led: the client owns pacing. The hook reads the phone each frame for
// the active move-movement, writes taste on commit, advances the room
// expansion, and fires onBloom when Face commits. onExpansion(t) lets the host
// open the AdmirerRoom; onSpeculativePreload(archetypeId) starts the silent
// StemPlayer load during Rise; onReact(movementId, payload) feeds the
// companion voice a contextual update; onAsk(movementId, askText) fires once on
// movement entry so the companion can voice that movement's question aloud.
export function useAttunementScore({ onExpansion, onSpeculativePreload, onBloom, onReact, onAsk } = {}) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState)
  const readMotion = usePhoneMotion()
  const ring = useRef(archetypeRing()).current

  const movement = getMovement(state.movementId)

  // Per-movement transient accumulators (reset on movement entry).
  const enteredAtRef = useRef(0)
  const baselineYawRef = useRef(null)
  const peakSwellRef = useRef(0)
  const rodeClimaxRef = useRef(false)
  const lastPreloadRef = useRef(null)
  const liveRef = useRef({ pan: 0.5, filterNorm: 0.5, relYaw: 0, swell: 0, committedBalance: null })

  // FIX 5 — tiny haptic helper; no-ops where vibration is unsupported.
  const vibrate = (ms) => { try { navigator.vibrate?.(ms) } catch { /* unsupported */ } }

  useEffect(() => {
    enteredAtRef.current = performance.now()
    baselineYawRef.current = null
    peakSwellRef.current = 0
    rodeClimaxRef.current = false
    liveRef.current = { pan: 0.5, filterNorm: 0.5, relYaw: 0, swell: 0, committedBalance: null }
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
      } else if (movement.id === 'rise') {
        if (m.gestureGain > peakSwellRef.current) peakSwellRef.current = m.gestureGain
        // FIX 3 — expose live swell so the host can drive setSwell each frame.
        liveRef.current.swell = m.gestureGain
        if (m.downbeat?.fired) {
          rodeClimaxRef.current = peakSwellRef.current > 0.5
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
  const commit = useCallback((committedPan, approachMs) => {
    if (!movement || state.status !== 'active') return
    const cur = getAvd()
    const dwellMs = performance.now() - enteredAtRef.current
    if (movement.id === 'leanLift') {
      // Roll-only. Use the pan captured at the brink-crossing frame (a hard
      // slam writes more extreme Valence than a gentle tip — earned intensity);
      // filterNorm 0.5 holds Depth. Confidence rides the approach time.
      const pan = committedPan ?? liveRef.current.pan
      const target = leanLiftTarget(pan, 0.5, cur)
      commitTurn(target, { gain: movement.gain, confidence: dwellConfidence(approachMs ?? dwellMs) })
      liveRef.current.committedBalance = (pan - 0.5) * 2 // hold the audio to the chosen side
      vibrate(15) // FIX 5
      onReact?.('leanLift', { valence: target.v, depth: target.d })
    } else if (movement.id === 'rise') {
      const target = riseTarget(peakSwellRef.current, rodeClimaxRef.current, cur)
      commitTurn(target, { gain: movement.gain })
      vibrate(25) // FIX 5
      onReact?.('rise', { arousal: target.a, hedonic: riseHedonic(rodeClimaxRef.current) })
    } else if (movement.id === 'face') {
      const id = nearestArchetypeToYaw(liveRef.current.relYaw, ring)
      // Blend (not hard-snap) so earlier turns — e.g. leanLift's Valence —
      // EWMA-survive into the routed vector. gain 1.0 lets the faced world's
      // centroid dominate while still honouring the accumulated taste.
      commitTurn(archetypeAnchorVector(id), { gain: 1.0 })
      vibrate(20) // FIX 5
      onReact?.('face', { archetypeId: id })
    }
    dispatch({ type: 'COMMIT' })
  }, [movement, state.status, ring, onReact])

  const advance = useCallback(() => {
    // COMMIT first so talk/tap movements (arrival, listen) — which never go
    // through commit() — become 'committed' and the status-guarded reducer
    // will ADVANCE. COMMIT no-ops if already committed; React batches both
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
