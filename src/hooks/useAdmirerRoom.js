import { useEffect, useRef, useCallback } from 'react'
import AdmirerRoom, { rollToAzimuthOffset } from '../orchestra/AdmirerRoom.js'
import { usePhoneMotion } from './usePhoneMotion.js'

// Owns the AdmirerRoom audio graph for the Admirer phase. Builds the room on
// mount, feeds phone roll → room azimuth every frame, and returns
// beginExpansion() for the phase-1 → phase-2 handoff. The Admirer's spoken
// lines are pre-baked TTS clips played through the room via getRoom().
// playVoiceClip (see Admirer.jsx) — there is no live agent and no voice
// capture. Degrades gracefully: with no audio context the room simply never
// builds and getRoom() returns null.
export function useAdmirerRoom({ getAudioCtx }) {
  const roomRef = useRef(null)
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
      room.dispose()
    }
  }, [getAudioCtx])

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
