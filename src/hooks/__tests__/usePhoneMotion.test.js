import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePhoneMotion } from '../usePhoneMotion.js'

// Guards the rise-review CRITICAL: usePhoneMotion must subscribe to BOTH
// deviceorientation AND devicemotion. Orientation drives pan/filterNorm/yaw
// (lean/listen/face); motion drives gestureGain/downbeat (rise). The hook
// previously wired only orientation, so the rise beat's swell + strike never
// fired. This test fails if the devicemotion listener is ever dropped again.

function motionEvent(acc) {
  const e = new Event('devicemotion')
  e.acceleration = acc
  e.accelerationIncludingGravity = acc
  e.rotationRate = { alpha: 0, beta: 0, gamma: 0 }
  return e
}

function orientationEvent(beta, gamma) {
  const e = new Event('deviceorientation')
  e.alpha = 0
  e.beta = beta
  e.gamma = gamma
  return e
}

describe('usePhoneMotion', () => {
  it('produces gestureGain from devicemotion (the motion listener is wired)', () => {
    const { result } = renderHook(() => usePhoneMotion())
    const { read } = result.current

    // No motion yet → no gesture energy.
    expect(read().gestureGain).toBe(0)

    // A varying acceleration excursion should register as gesture size.
    window.dispatchEvent(motionEvent({ x: 0, y: 0, z: 0 }))
    window.dispatchEvent(motionEvent({ x: 8, y: 8, z: 8 }))
    window.dispatchEvent(motionEvent({ x: 0, y: 0, z: 0 }))
    window.dispatchEvent(motionEvent({ x: 8, y: 8, z: 8 }))

    expect(read().gestureGain).toBeGreaterThan(0)
  })

  it('still reads orientation (pan/filterNorm/yaw exist)', () => {
    const { result } = renderHook(() => usePhoneMotion())
    const snap = result.current.read()
    expect(snap).toHaveProperty('pan')
    expect(snap).toHaveProperty('filterNorm')
    expect(snap).toHaveProperty('yaw')
  })
})

// Guards the R2 gesture-calibration fix: Act 1 previously never calibrated,
// so leanLift/listen read gesture offsets against GestureCore's hardcoded
// baseline (beta:75, gamma:0) instead of the user's actual resting hold.
// calibrate() gives Act 1 the same one-time neutral-capture Act 2 has always
// had (ConductingEngine.startCalibration).
describe('usePhoneMotion — calibrate()', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('is exposed alongside read (API: { read, calibrate })', () => {
    const { result } = renderHook(() => usePhoneMotion())
    expect(typeof result.current.read).toBe('function')
    expect(typeof result.current.calibrate).toBe('function')
  })

  it('sets the baseline to the mean of the samples collected during the calibration window', async () => {
    const { result } = renderHook(() => usePhoneMotion())
    const { read, calibrate } = result.current

    let resolved = false
    act(() => { calibrate(800).then(() => { resolved = true }) })
    expect(resolved).toBe(false) // still waiting out the window

    // User holds the phone tilted at rest during the window — this is the
    // "true" neutral the calibration window should capture.
    window.dispatchEvent(orientationEvent(60, 10))
    window.dispatchEvent(orientationEvent(80, -10))

    await act(async () => { await vi.advanceTimersByTimeAsync(800) })

    expect(resolved).toBe(true)
    const snap = read()
    expect(snap.baselineBeta).toBeCloseTo(70, 0)
    expect(snap.baselineGamma).toBeCloseTo(0, 0)
  })

  it('clears samples collected before the call, so calibrate() reflects only the fresh window', async () => {
    const { result } = renderHook(() => usePhoneMotion())
    const { read, calibrate } = result.current

    // Stale samples from earlier in a long-lived session — must NOT bleed
    // into the calibration average.
    window.dispatchEvent(orientationEvent(0, 0))
    window.dispatchEvent(orientationEvent(0, 0))

    const promise = calibrate(800)
    // The fresh resting-hold window starts now.
    window.dispatchEvent(orientationEvent(50, 20))
    window.dispatchEvent(orientationEvent(50, 20))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
      await promise
    })

    const snap = read()
    expect(snap.baselineBeta).toBeCloseTo(50, 0)
    expect(snap.baselineGamma).toBeCloseTo(20, 0)
  })
})
