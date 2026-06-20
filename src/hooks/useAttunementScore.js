// src/hooks/useAttunementScore.js
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { initialState, reduce } from '../lib/attunementReducer.js'
import { getMovement } from '../lib/attunementMovements.js'
import { usePhoneMotion } from './usePhoneMotion.js'
import { getAvd, commitTurn, setAvd } from '../lib/avdStore.js'
import { leanLiftTarget, riseTarget, riseHedonic, dwellConfidence } from '../lib/attunementToAvd.js'
import { archetypeRing, nearestArchetypeToYaw, archetypeAnchorVector, preloadDecision } from '../lib/archetypeRing.js'

// Score-led: the client owns pacing. The hook reads the phone each frame for
// the active move-movement, writes taste on commit, advances the room
// expansion, and fires onBloom when Face commits. onExpansion(t) lets the host
// open the AdmirerRoom; onSpeculativePreload(archetypeId) starts the silent
// StemPlayer load during Rise; onReact(movementId, payload) feeds the
// companion voice a contextual update.
export function useAttunementScore({ onExpansion, onSpeculativePreload, onBloom, onReact } = {}) {
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
  const liveRef = useRef({ pan: 0.5, filterNorm: 0.5, relYaw: 0 })

  useEffect(() => {
    enteredAtRef.current = performance.now()
    baselineYawRef.current = null
    peakSwellRef.current = 0
    rodeClimaxRef.current = false
  }, [state.movementId])

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
        if (m.downbeat?.fired) {
          rodeClimaxRef.current = peakSwellRef.current > 0.5
          onReact?.('rise', { downbeat: true, intensity: m.downbeat.intensity })
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
  const commit = useCallback(() => {
    if (!movement || state.status !== 'active') return
    const cur = getAvd()
    const dwellMs = performance.now() - enteredAtRef.current
    if (movement.id === 'leanLift') {
      const target = leanLiftTarget(liveRef.current.pan, liveRef.current.filterNorm, cur)
      commitTurn(target, { gain: movement.gain, confidence: dwellConfidence(dwellMs) })
      onReact?.('leanLift', { valence: target.v, depth: target.d })
    } else if (movement.id === 'rise') {
      const target = riseTarget(peakSwellRef.current, rodeClimaxRef.current, cur)
      commitTurn(target, { gain: movement.gain })
      onReact?.('rise', { arousal: target.a, hedonic: riseHedonic(rodeClimaxRef.current) })
    } else if (movement.id === 'face') {
      const id = nearestArchetypeToYaw(liveRef.current.relYaw, ring)
      setAvd(archetypeAnchorVector(id)) // snap the vector onto the faced world
      onReact?.('face', { archetypeId: id })
    }
    dispatch({ type: 'COMMIT' })
    const m = getMovement(state.movementId)
    if (m) onExpansion?.(m.expansionTo)
  }, [movement, state.status, state.movementId, ring, onReact, onExpansion])

  const advance = useCallback(() => {
    dispatch({ type: 'ADVANCE' })
  }, [])

  // When Face has committed and we advance into Bloom, fire the handoff.
  useEffect(() => {
    if (state.movementId === 'bloom' && state.status === 'active') {
      onExpansion?.(1)
      onBloom?.()
    }
  }, [state.movementId, state.status, onExpansion, onBloom])

  return { state, movement, commit, advance, live: liveRef }
}
