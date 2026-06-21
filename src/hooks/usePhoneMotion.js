import { useEffect, useRef, useCallback } from 'react'
import { createState, processOrientation, processMotion, read } from '../conducting/GestureCore.js'
import { activeParams } from '../conducting/index.js'

// React hook: subscribes to DeviceOrientation AND DeviceMotion and exposes the
// latest GestureCore snapshot via a stable read() function. read() returns
// { pan, filterNorm, gamma, beta, yaw, gestureGain, downbeat, articulation, ... }
// — pan/filterNorm/yaw come from orientation (the lean/listen/face beats);
// gestureGain/downbeat come from motion (the rise beat). All 1€-filtered.
//
// NOTE: the devicemotion listener is required for gestureGain/downbeat — without
// it the rise beat's swell + strike never fire. (See the rise-review finding.)
//
// iOS permission must already have been granted — Entry requests it inside
// the "begin" tap. It is safe to call this hook from more than one component:
// each instance keeps its own lightweight GestureCore state, and the window
// event fans out to every listener.
export function usePhoneMotion() {
  const stateRef = useRef(null)
  if (stateRef.current === null) {
    stateRef.current = createState({ params: activeParams() })
  }

  useEffect(() => {
    const state = stateRef.current
    const onOrient = (e) => processOrientation(state, e, performance.now())
    const onMotion = (e) => processMotion(state, e, performance.now())
    window.addEventListener('deviceorientation', onOrient, { passive: true })
    window.addEventListener('devicemotion', onMotion, { passive: true })
    return () => {
      window.removeEventListener('deviceorientation', onOrient)
      window.removeEventListener('devicemotion', onMotion)
    }
  }, [])

  return useCallback(() => read(stateRef.current, performance.now()), [])
}
