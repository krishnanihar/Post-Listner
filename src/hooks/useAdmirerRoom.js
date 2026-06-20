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

  // Arrival footsteps — play once when the room is live, before (or
  // overlapping with) the agent's first word. Fire-and-forget: failure is
  // silent and the rite continues. The fetch + decode is small (~50KB);
  // we don't bother caching across mounts because the Admirer phase only
  // mounts once per rite.
  useEffect(() => {
    const room = roomRef.current
    const ctx = getAudioCtx?.()
    if (!room || !ctx) return undefined
    let cancelled = false
    fetch('/admirer/footsteps.mp3')
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(audioBuffer => {
        if (cancelled) return
        room.playFootsteps(audioBuffer)
      })
      .catch(e => console.warn('[admirer-room] footsteps load failed', e))
    return () => { cancelled = true }
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

  // Feed phone roll → room azimuth each frame. The phone's resting position
  // at the start of the phase is the neutral baseline; the voice swings
  // relative to it, so however the user happens to hold the phone, "centred"
  // is wherever they started.
  useEffect(() => {
    let raf = 0
    let mounted = true
    let baselineRoll = null
    const tick = () => {
      if (!mounted) return
      const room = roomRef.current
      if (room) {
        const m = readMotion()
        if (m.gamma != null && !Number.isNaN(m.gamma)) {
          if (baselineRoll === null) baselineRoll = m.gamma
          room.setAzimuthOffset(rollToAzimuthOffset(m.gamma - baselineRoll))
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { mounted = false; cancelAnimationFrame(raf) }
  }, [readMotion])

  // beginExpansion — the act-1 → act-2 handoff: animate the room open over
  // ~3.5s. setExpansion(t) lets the score drive the room open in discrete
  // steps per movement; getRoom() exposes the live AdmirerRoom so the host
  // can start the multi-source movement playback (texture pair / ring / rise
  // bed). All three are no-ops until the room is built.
  const beginExpansion = useCallback(() => {
    if (roomRef.current) roomRef.current.beginExpansion(3500)
  }, [])

  const setExpansion = useCallback((t) => {
    if (roomRef.current) roomRef.current.setExpansion(t)
  }, [])

  const getRoom = useCallback(() => roomRef.current, [])

  return { beginExpansion, setExpansion, getRoom }
}
