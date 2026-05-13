import { describe, it, expect } from 'vitest'
import { OneEuroFilter } from '../OneEuroFilter.js'

describe('OneEuroFilter', () => {
  it('first sample passes through unchanged', () => {
    const f = new OneEuroFilter({ mincutoff: 1.0, beta: 0.007 })
    expect(f.filter(42, 0)).toBeCloseTo(42, 5)
  })

  it('smooths a noisy signal toward its mean at rest', () => {
    const f = new OneEuroFilter({ mincutoff: 1.0, beta: 0.0 })
    // Feed 30 zero-mean ±2 samples around 100 at 60 Hz
    let last = 0
    for (let i = 0; i < 30; i++) {
      const noise = (i % 2 === 0 ? 2 : -2)
      last = f.filter(100 + noise, i / 60)
    }
    // Filter should converge near 100 (the true mean), much closer than ±2 raw noise
    expect(Math.abs(last - 100)).toBeLessThan(0.6)
  })

  it('tracks a ramp with low lag when beta is high', () => {
    const fAggressive = new OneEuroFilter({ mincutoff: 1.0, beta: 1.0 })
    const fConservative = new OneEuroFilter({ mincutoff: 1.0, beta: 0.0 })
    let aggressive = 0, conservative = 0
    for (let i = 0; i < 60; i++) {
      aggressive   = fAggressive.filter(i, i / 60)
      conservative = fConservative.filter(i, i / 60)
    }
    // Aggressive filter should be closer to the actual ramp value (59)
    expect(59 - aggressive).toBeLessThan(59 - conservative)
  })

  it('reset() clears state — next sample is treated as first', () => {
    const f = new OneEuroFilter({ mincutoff: 1.0, beta: 0.007 })
    for (let i = 0; i < 10; i++) f.filter(50, i / 60)
    f.reset()
    expect(f.filter(200, 0)).toBeCloseTo(200, 5)
  })

  it('handles zero dt without NaN (duplicate timestamp)', () => {
    const f = new OneEuroFilter({ mincutoff: 1.0, beta: 0.007 })
    f.filter(10, 0.5)
    const out = f.filter(20, 0.5)  // same timestamp
    expect(Number.isFinite(out)).toBe(true)
  })

  it('handles a large dt gap (tab suspended then resumed)', () => {
    const f = new OneEuroFilter({ mincutoff: 1.0, beta: 0.007 })
    f.filter(10, 0)
    const out = f.filter(11, 30)  // 30 s later — tab was backgrounded
    expect(Number.isFinite(out)).toBe(true)
  })
})
