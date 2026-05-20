import { useEffect, useRef, useCallback } from 'react'
import { createState, processOrientation, read } from '../conducting/GestureCore.js'
import { activeParams } from '../conducting/index.js'

// React hook: subscribes to DeviceOrientation and exposes the latest
// GestureCore snapshot via a stable read() function. read() returns
// { pan, filterNorm, gamma, beta, yaw, ... } — pan/filterNorm are 0..1
// (roll/pitch normalised), gamma/beta/yaw are degrees, all 1€-filtered.
//
// iOS permission must already have been granted — Entry requests it inside
// the "begin" tap. It is safe to call this hook from more than one component:
// each instance keeps its own lightweight GestureCore state, and the window
// event fans out to every listener. (Phase 1 has at most two callers — the
// room azimuth feed and the glyph — so the duplication cost is negligible.)
export function usePhoneMotion() {
  const stateRef = useRef(null)
  if (stateRef.current === null) {
    stateRef.current = createState({ params: activeParams() })
  }

  useEffect(() => {
    const state = stateRef.current
    const onOrient = (e) => processOrientation(state, e, performance.now())
    window.addEventListener('deviceorientation', onOrient, { passive: true })
    return () => window.removeEventListener('deviceorientation', onOrient)
  }, [])

  return useCallback(() => read(stateRef.current, performance.now()), [])
}
