import { describe, it, expect } from 'vitest'
import {
  breath,
  swell,
  swellRate,
  swellApproach,
  strike,
  strikeAlive,
} from '../motionGrammar.js'

describe('motionGrammar — breath', () => {
  it('is zero at phase 0, t 0', () => {
    expect(breath(0, { amp: 1 })).toBeCloseTo(0, 6)
  })
  it('peaks at a quarter period', () => {
    // hz=0.1 → period 10s → quarter = 2500ms → sin(pi/2)=1
    expect(breath(2500, { hz: 0.1, amp: 1 })).toBeCloseTo(1, 4)
  })
  it('scales by amplitude', () => {
    expect(breath(2500, { hz: 0.1, amp: 0.3 })).toBeCloseTo(0.3, 4)
  })
  it('folds to zero when reduced', () => {
    expect(breath(2500, { hz: 0.1, amp: 1, reduced: true })).toBe(0)
  })
  it('folds to zero when amp is zero', () => {
    expect(breath(2500, { amp: 0 })).toBe(0)
  })
  it('is deterministic for equal inputs', () => {
    expect(breath(1234, { hz: 0.13 })).toBe(breath(1234, { hz: 0.13 }))
  })
})

describe('motionGrammar — swell', () => {
  it('returns from at k=0 and to at k=1', () => {
    expect(swell(2, 8, 0)).toBeCloseTo(2, 6)
    expect(swell(2, 8, 1)).toBeCloseTo(8, 6)
  })
  it('clamps k below 0 and above 1', () => {
    expect(swell(2, 8, -5)).toBeCloseTo(2, 6)
    expect(swell(2, 8, 5)).toBeCloseTo(8, 6)
  })
  it('is monotonic between endpoints', () => {
    const a = swell(0, 1, 0.25)
    const b = swell(0, 1, 0.5)
    const c = swell(0, 1, 0.75)
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(c)
    expect(a).toBeGreaterThan(0)
    expect(c).toBeLessThan(1)
  })
})

describe('motionGrammar — swellRate / swellApproach', () => {
  it('covers ~63% of the gap in one time-constant', () => {
    const k = swellRate(1, 1) // dt=tau
    expect(k).toBeCloseTo(1 - Math.exp(-1), 4) // ≈0.632
  })
  it('returns 1 for a non-positive tau', () => {
    expect(swellRate(0.016, 0)).toBe(1)
  })
  it('clamps rate into [0,1]', () => {
    expect(swellRate(100, 0.1)).toBeLessThanOrEqual(1)
    expect(swellRate(-1, 0.1)).toBeGreaterThanOrEqual(0)
  })
  it('approach moves value toward target', () => {
    const v = swellApproach(0, 10, 0.5)
    expect(v).toBeCloseTo(5, 6)
  })
  it('approach with k=1 snaps to target', () => {
    expect(swellApproach(3, 9, 1)).toBeCloseTo(9, 6)
  })
})

describe('motionGrammar — strike', () => {
  it('is at peak at age 0', () => {
    expect(strike(0, { peak: 1 })).toBe(1)
    expect(strike(-5, { peak: 2 })).toBe(2)
  })
  it('decays exponentially by the time-constant', () => {
    expect(strike(600, { decayMs: 600, peak: 1 })).toBeCloseTo(Math.exp(-1), 4)
  })
  it('is effectively zero after many time-constants', () => {
    expect(strike(6000, { decayMs: 600 })).toBe(0)
  })
  it('reduced strike is a single flash then zero', () => {
    expect(strike(0, { reduced: true })).toBe(1)
    expect(strike(10, { reduced: true })).toBe(1)
    expect(strike(30, { reduced: true })).toBe(0)
  })
})

describe('motionGrammar — strikeAlive', () => {
  it('is alive at start, dead after decay window', () => {
    expect(strikeAlive(1000, 1000, { decayMs: 600 })).toBe(true)
    expect(strikeAlive(1000, 1000 + 600 * 6 + 1, { decayMs: 600 })).toBe(false)
  })
  it('is not alive before its start', () => {
    expect(strikeAlive(1000, 900)).toBe(false)
  })
  it('reduced strike is alive only for one frame', () => {
    expect(strikeAlive(1000, 1010, { reduced: true })).toBe(true)
    expect(strikeAlive(1000, 1030, { reduced: true })).toBe(false)
  })
})
