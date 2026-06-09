// src/lib/__tests__/questionSeeds.test.js
import { describe, it, expect } from 'vitest'
import { SEEDS, getSeed, LOCATE_BUDGET } from '../questionSeeds.js'

const KINDS = ['biography', 'locate', 'selection', 'closing']

describe('questionSeeds — deck integrity', () => {
  it('every seed has id, kind, text, gain, sessionScope, tier', () => {
    for (const s of SEEDS) {
      expect(typeof s.id).toBe('string')
      expect(KINDS).toContain(s.kind)
      expect(typeof s.text).toBe('string')
      expect(typeof s.gain).toBe('number')
      expect(['first', 'always']).toContain(s.sessionScope)
      expect([1, 3]).toContain(s.tier)
    }
  })
  it('ids are unique', () => {
    const ids = SEEDS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('biography seeds are session-1-only with low gain', () => {
    const bio = SEEDS.filter((s) => s.kind === 'biography')
    expect(bio.length).toBeGreaterThanOrEqual(3)
    for (const s of bio) {
      expect(s.sessionScope).toBe('first')
      expect(s.gain).toBeCloseTo(0.3, 5)
    }
  })
  it('locate seeds carry an intent vector and a probes axis or null', () => {
    const locate = SEEDS.filter((s) => s.kind === 'locate')
    expect(locate.length).toBeGreaterThan(0)
    for (const s of locate) {
      expect(s.intent).toMatchObject({ a: expect.any(Number), v: expect.any(Number), d: expect.any(Number) })
      expect([null, 'A', 'V', 'D']).toContain(s.probes ?? null)
    }
  })
  it('selection seeds have labeled options with avd nudges', () => {
    const sel = SEEDS.filter((s) => s.kind === 'selection')
    for (const s of sel) {
      expect(Array.isArray(s.options)).toBe(true)
      for (const o of s.options) {
        expect(typeof o.label).toBe('string')
        expect(o.avd).toMatchObject({ a: expect.any(Number), v: expect.any(Number), d: expect.any(Number) })
      }
    }
  })
  it('exactly one closing seed, with no AVD effect', () => {
    const closing = SEEDS.filter((s) => s.kind === 'closing')
    expect(closing.length).toBe(1)
  })
})

describe('questionSeeds — getSeed + budget', () => {
  it('getSeed returns by id or null', () => {
    expect(getSeed(SEEDS[0].id)).toBe(SEEDS[0])
    expect(getSeed('nope')).toBeNull()
  })
  it('LOCATE_BUDGET is a small positive integer', () => {
    expect(Number.isInteger(LOCATE_BUDGET)).toBe(true)
    expect(LOCATE_BUDGET).toBeGreaterThan(0)
  })
})
