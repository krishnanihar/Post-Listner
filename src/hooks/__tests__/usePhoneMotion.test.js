import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
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

describe('usePhoneMotion', () => {
  it('produces gestureGain from devicemotion (the motion listener is wired)', () => {
    const { result } = renderHook(() => usePhoneMotion())
    const read = result.current

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
    const snap = result.current()
    expect(snap).toHaveProperty('pan')
    expect(snap).toHaveProperty('filterNorm')
    expect(snap).toHaveProperty('yaw')
  })
})
