import { describe, it, expect } from 'vitest'
import { equalPowerGains } from '../equalPower.js'

describe('equalPowerGains', () => {
  it('full-left balance = -1 → all left', () => {
    const g = equalPowerGains(-1)
    expect(g.left).toBeCloseTo(1, 6)
    expect(g.right).toBeCloseTo(0, 6)
  })
  it('full-right balance = +1 → all right', () => {
    const g = equalPowerGains(1)
    expect(g.left).toBeCloseTo(0, 6)
    expect(g.right).toBeCloseTo(1, 6)
  })
  it('center balance = 0 → equal power (~0.707 each)', () => {
    const g = equalPowerGains(0)
    expect(g.left).toBeCloseTo(Math.SQRT1_2, 6)
    expect(g.right).toBeCloseTo(Math.SQRT1_2, 6)
  })
  it('power sums to 1 across the sweep', () => {
    for (const b of [-1, -0.5, 0, 0.3, 1]) {
      const g = equalPowerGains(b)
      expect(g.left ** 2 + g.right ** 2).toBeCloseTo(1, 6)
    }
  })
  it('clamps out-of-range balance', () => {
    expect(equalPowerGains(-5).left).toBeCloseTo(1, 6)
    expect(equalPowerGains(5).right).toBeCloseTo(1, 6)
  })
})
