import { useEffect } from 'react'

// While `enabled`, suspend the audio context when the page is hidden and
// resume it when visible — a battery mitigation (Ship-Blockers §4). `getCtx`
// returns the AudioContext (or null). Tolerant of a null ctx / no document.
//
// Orchestra-scoped: deliberately NOT used during the live Admirer
// conversation, where suspending the context would break ElevenLabs voice
// capture. By the Orchestra phase the agent is done and the same context only
// drives stem playback.
export function useVisibilityAudioPause(getCtx, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined
    const onChange = () => {
      const ctx = getCtx?.()
      if (!ctx) return
      if (document.hidden) {
        if (ctx.state === 'running') ctx.suspend?.()
      } else if (ctx.state === 'suspended') {
        ctx.resume?.()
      }
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [getCtx, enabled])
}
