import { useEffect, useRef, useCallback } from 'react'
import {
  createState, processOrientation, processMotion, read, calibrate as coreCalibrate,
} from '../conducting/GestureCore.js'
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
//
// Returns { read, calibrate } — NOT a bare function. (An earlier version
// attached calibrate as a property on the read callback so existing
// `usePhoneMotion()` call sites that only wanted `read()` needed no change;
// `react-hooks/immutability` forbids mutating a hook's return value, so the
// callers below were updated to destructure instead.)
//
// Calibration: read() computes pan/filterNorm against a fixed baseline
// (GestureCore's hardcoded baselineBeta:75/baselineGamma:0) until calibrated.
// calibrate(windowMs?) clears any samples accumulated so far, waits
// `windowMs` (default 800) for a fresh resting-hold sample window, then
// averages that window into the baseline — mirroring Act 2's
// ConductingEngine.startCalibration, but callable on-demand instead of only
// once at start().
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

  const readMotion = useCallback(() => read(stateRef.current, performance.now()), [])

  const calibrate = useCallback((windowMs = 800) => {
    const state = stateRef.current
    // Drop samples collected before this call so the average reflects only
    // the upcoming resting-hold window, not the whole session's history
    // (this hook's GestureCore state is long-lived, unlike Act 2's
    // fresh-per-session one).
    state.calibrationSamples = []
    return new Promise((resolve) => {
      setTimeout(() => {
        coreCalibrate(state)
        resolve()
      }, windowMs)
    })
  }, [])

  return { read: readMotion, calibrate }
}
