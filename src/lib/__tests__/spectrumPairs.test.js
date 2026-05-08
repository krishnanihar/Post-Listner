import { describe, it, expect } from 'vitest'
import { PAIRS_LEGACY, PAIRS_V2, ACTIVE_PAIRS } from '../spectrumPairs'

describe('spectrumPairs', () => {
  it('PAIRS_LEGACY has 8 pairs', () => {
    expect(PAIRS_LEGACY).toHaveLength(8)
  })

  it('PAIRS_V2 has 9 pairs along orthogonal production-aesthetic axes', () => {
    expect(PAIRS_V2).toHaveLength(9)
    const axes = PAIRS_V2.map(p => `${p.left}/${p.right}`)
    expect(axes).toContain('warm/cold')
    expect(axes).toContain('dense/spare')
    expect(axes).toContain('sung/instrumental')
    expect(axes).toContain('slow/fast')
  })

  it('every pair has left, right, coordL, coordR with a/v/d numeric fields', () => {
    for (const pairs of [PAIRS_LEGACY, PAIRS_V2]) {
      for (const p of pairs) {
        expect(typeof p.left).toBe('string')
        expect(typeof p.right).toBe('string')
        expect(typeof p.coordL.a).toBe('number')
        expect(typeof p.coordL.v).toBe('number')
        expect(typeof p.coordL.d).toBe('number')
        expect(typeof p.coordR.a).toBe('number')
        expect(typeof p.coordR.v).toBe('number')
        expect(typeof p.coordR.d).toBe('number')
      }
    }
  })

  it('ACTIVE_PAIRS is PAIRS_V2 (Phase 4 — Spectrum v2 activated)', () => {
    expect(ACTIVE_PAIRS).toBe(PAIRS_V2)
    expect(ACTIVE_PAIRS.length).toBe(9)
  })
})
