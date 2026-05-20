import { useEffect, useRef, useCallback } from 'react'
import AdmirerRoom, { captureAdmirerVoice, rollToAzimuthOffset } from '../orchestra/AdmirerRoom.js'
import { usePhoneMotion } from './usePhoneMotion.js'

// Owns the AdmirerRoom audio graph for the Admirer phase. Builds the room on
// mount, captures the agent's voice once the session connects, feeds phone
// roll → room azimuth every frame, and returns beginExpansion() for the
// phase-1 → phase-2 handoff. Degrades gracefully: if voice capture fails the
// conversation still plays (just not spatialised) — the room is an
// enhancement, never a gate.
export function useAdmirerRoom({ getAudioCtx, status }) {
  const roomRef = useRef(null)
  const capturedRef = useRef(false)
  const readMotion = usePhoneMotion()

  // Build the room once, on mount. The graph is live synchronously; the hall
  // IR loads in the background.
  useEffect(() => {
    const ctx = getAudioCtx?.()
    if (!ctx) {
      console.warn('[admirer-room] no audio context — voice stays unspatialised')
      return undefined
    }
    const room = new AdmirerRoom(ctx)
    roomRef.current = room
    room.loadReverb().catch((e) => console.warn('[admirer-room] reverb load failed', e))
    return () => {
      roomRef.current = null
      capturedRef.current = false
      room.dispose()
    }
  }, [getAudioCtx])

  // Capture the agent's voice once the session connects. The SDK appends its
  // hidden <audio> element around onConnect time — retry briefly if it is not
  // there on the first attempt. captureAdmirerVoice throws (before muting
  // anything) when the element is absent, so a failed attempt is harmless.
  useEffect(() => {
    if (status !== 'connected' || capturedRef.current) return undefined
    let tries = 0
    let timer = null
    const attempt = () => {
      const room = roomRef.current
      const ctx = getAudioCtx?.()
      if (!room || !ctx) return
      try {
        room.connectVoice(captureAdmirerVoice(ctx))
        capturedRef.current = true
      } catch {
        // ~6 s of retries (40 × 150 ms) — generous enough for a slow first
        // connection on mobile, where the SDK's <audio> element can be late.
        if (tries++ < 40) {
          timer = setTimeout(attempt, 150)
        } else {
          console.warn('[admirer-room] voice capture gave up — voice stays unspatialised')
        }
      }
    }
    attempt()
    return () => { if (timer) clearTimeout(timer) }
  }, [status, getAudioCtx])

  // Feed phone roll → room azimuth each frame.
  useEffect(() => {
    let raf = 0
    let mounted = true
    const tick = () => {
      if (!mounted) return
      const room = roomRef.current
      if (room) {
        const m = readMotion()
        room.setAzimuthOffset(rollToAzimuthOffset(m.gamma))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { mounted = false; cancelAnimationFrame(raf) }
  }, [readMotion])

  return useCallback(() => {
    if (roomRef.current) roomRef.current.beginExpansion(3500)
  }, [])
}
