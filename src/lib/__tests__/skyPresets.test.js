import { describe, it, expect } from 'vitest'
import { INTIMATE, EXPANDED, easeExpansion } from '../skyPresets.js'

describe('skyPresets', () => {
  it('INTIMATE is a closer zoom than EXPANDED', () => {
    expect(INTIMATE.zoom).toBeGreaterThan(EXPANDED.zoom)
  })
  it('re-exports easeExpansion as a smoothstep (0->0, 1->1, 0.5->0.5)', () => {
    expect(easeExpansion(0)).toBe(0)
    expect(easeExpansion(1)).toBe(1)
    expect(easeExpansion(0.5)).toBeCloseTo(0.5, 5)
  })
  it('easeExpansion clamps out-of-range input to [0,1]', () => {
    expect(easeExpansion(-1)).toBe(0)
    expect(easeExpansion(2)).toBe(1)
  })
})
