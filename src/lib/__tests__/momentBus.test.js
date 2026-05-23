import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  fireMoment,
  subscribeMoments,
  getCurrentRelease,
  resetMoments,
} from '../momentBus.js'

describe('momentBus', () => {
  beforeEach(() => { resetMoments() })

  it('starts at zero release', () => {
    expect(getCurrentRelease()).toBe(0)
  })

  it('fireMoment increments the release total', () => {
    fireMoment(0.12)
    expect(getCurrentRelease()).toBeCloseTo(0.12, 6)
    fireMoment(0.05)
    expect(getCurrentRelease()).toBeCloseTo(0.17, 6)
  })

  it('clamps the total release ratio at 1', () => {
    fireMoment(0.7)
    fireMoment(0.5)
    expect(getCurrentRelease()).toBe(1)
  })

  it('notifies subscribers with the new total on every fire', () => {
    const calls = []
    const unsub = subscribeMoments((r) => calls.push(r))
    fireMoment(0.08)
    fireMoment(0.12)
    fireMoment(0.05)
    // Subscriber receives the initial value on subscribe (0), then each update.
    expect(calls).toEqual([0, 0.08, 0.20, 0.25])
    unsub()
  })

  it('resetMoments returns the total to zero and notifies subscribers', () => {
    const calls = []
    fireMoment(0.5)
    const unsub = subscribeMoments((r) => calls.push(r))
    calls.length = 0 // discard the initial-emit value
    resetMoments()
    expect(getCurrentRelease()).toBe(0)
    expect(calls).toEqual([0])
    unsub()
  })

  it('unsubscribe stops further notifications', () => {
    const listener = vi.fn()
    const unsub = subscribeMoments(listener)
    listener.mockClear() // discard the immediate-emit
    unsub()
    fireMoment(0.3)
    expect(listener).not.toHaveBeenCalled()
  })

  it('same eventId twice is idempotent (dev-mode double-mount defence)', () => {
    fireMoment(0.08, 'mount')
    fireMoment(0.08, 'mount') // second fire with same id MUST be a no-op
    expect(getCurrentRelease()).toBeCloseTo(0.08, 6)
    // Different eventId still fires
    fireMoment(0.12, 'question:0')
    expect(getCurrentRelease()).toBeCloseTo(0.20, 6)
    // No-eventId calls are NOT de-duped (they're for legitimate repeats)
    fireMoment(0.05)
    fireMoment(0.05)
    expect(getCurrentRelease()).toBeCloseTo(0.30, 6)
    // resetMoments clears the seen-id set, so 'mount' fires again next time
    resetMoments()
    fireMoment(0.08, 'mount')
    expect(getCurrentRelease()).toBeCloseTo(0.08, 6)
  })
})
