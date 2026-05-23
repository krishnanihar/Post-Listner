import { useEffect, useLayoutEffect, useRef } from 'react'

// Fires `ping()` every `intervalMs` while `enabled` is true. Used by the
// Admirer phase to call `sendUserActivity()` on the ElevenLabs SDK while
// hold-to-speak is idle — this resets the server-side turn-timeout timer
// so the agent waits indefinitely for the user to engage instead of
// advancing through its script into the void.
export function useIdleKeepAlive({ enabled, intervalMs, ping }) {
  const pingRef = useRef(ping)
  useLayoutEffect(() => {
    pingRef.current = ping
  })

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return undefined
    const id = setInterval(() => {
      try { pingRef.current?.() } catch { /* swallow — never break the rite */ }
    }, intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs])
}
