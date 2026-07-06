import { describe, it, expect } from 'vitest'
import {
  normalizeAvd,
  avdToStar,
  buildOwnConstellation,
  buildMockCollective,
  buildConstellation,
} from '../constellationLayout.js'

describe('constellationLayout — normalizeAvd', () => {
  it('accepts arrays, {a,v,d}, and {arousal,valence,depth}', () => {
    expect(normalizeAvd([0.5, -0.5, 0.2])).toEqual({ a: 0.5, v: -0.5, d: 0.2 })
    expect(normalizeAvd({ a: 0.1, v: 0.2, d: 0.3 })).toEqual({ a: 0.1, v: 0.2, d: 0.3 })
    expect(normalizeAvd({ arousal: -0.4, valence: 0.6, depth: 0 })).toEqual({ a: -0.4, v: 0.6, d: 0 })
  })
  it('clamps to [-1,1] and handles junk', () => {
    expect(normalizeAvd([5, -9, NaN])).toEqual({ a: 1, v: -1, d: 0 })
    expect(normalizeAvd(null)).toEqual({ a: 0, v: 0, d: 0 })
  })
})

describe('constellationLayout — avdToStar', () => {
  it('maps valence to x and arousal to y (high arousal near top)', () => {
    const left = avdToStar({ a: 0, v: -1, d: 0 }, 'x')
    const right = avdToStar({ a: 0, v: 1, d: 0 }, 'x')
    expect(left.x).toBeLessThan(right.x)
    const calm = avdToStar({ a: -1, v: 0, d: 0 }, 'x')
    const excited = avdToStar({ a: 1, v: 0, d: 0 }, 'x')
    expect(excited.y).toBeLessThan(calm.y) // higher arousal = smaller y = nearer top
  })
  it('deeper listening reads warmer and brighter', () => {
    const shallow = avdToStar({ a: 0, v: 0, d: -1 }, 's')
    const deep = avdToStar({ a: 0, v: 0, d: 1 }, 's')
    expect(deep.warmth).toBeGreaterThan(shallow.warmth)
    expect(deep.brightness).toBeGreaterThan(shallow.brightness)
  })
  it('is deterministic for the same avd + seed', () => {
    expect(avdToStar({ a: 0.3, v: -0.2, d: 0.5 }, 'abc')).toEqual(
      avdToStar({ a: 0.3, v: -0.2, d: 0.5 }, 'abc'),
    )
  })
  it('separates identical tastes by seed jitter', () => {
    const a = avdToStar({ a: 0, v: 0, d: 0 }, 'session-1')
    const b = avdToStar({ a: 0, v: 0, d: 0 }, 'session-2')
    expect(a.x !== b.x || a.y !== b.y).toBe(true)
  })
  it('keeps all coordinates within the field', () => {
    for (const v of [-1, 0, 1]) for (const a of [-1, 0, 1]) {
      const s = avdToStar({ a, v, d: 0 }, `${a},${v}`)
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x).toBeLessThanOrEqual(1)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThanOrEqual(1)
    }
  })
})

describe('constellationLayout — buildOwnConstellation', () => {
  it('maps each session record to an own star', () => {
    const sessions = [
      { id: 'a', finalVector: { a: 0.5, v: 0.2, d: 0.1 } },
      { id: 'b', finalVector: [-0.3, 0.4, -0.2] },
    ]
    const stars = buildOwnConstellation(sessions)
    expect(stars.length).toBe(2)
    expect(stars.every((s) => s.own === true)).toBe(true)
  })
  it('reads recent sessions a touch brighter (recency, not a streak)', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, finalVector: { a: 0, v: 0, d: 0 } }))
    const stars = buildOwnConstellation(sessions)
    expect(stars[4].brightness).toBeGreaterThan(stars[0].brightness)
  })
  it('handles an empty archive', () => {
    expect(buildOwnConstellation([])).toEqual([])
    expect(buildOwnConstellation()).toEqual([])
  })
})

describe('constellationLayout — buildMockCollective', () => {
  it('produces the requested count of dim, cool, non-own lights', () => {
    const pts = buildMockCollective(50)
    expect(pts.length).toBe(50)
    expect(pts.every((p) => p.own === false)).toBe(true)
    expect(pts.every((p) => p.brightness <= 0.15)).toBe(true)
    expect(pts.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(true)
  })
  it('is deterministic across calls', () => {
    expect(buildMockCollective(20)).toEqual(buildMockCollective(20))
  })
  it('clamps absurd counts', () => {
    expect(buildMockCollective(99999).length).toBeLessThanOrEqual(2000)
    expect(buildMockCollective(-5).length).toBe(0)
  })
})

describe('constellationLayout — buildConstellation', () => {
  it('returns own over collective', () => {
    const field = buildConstellation([{ id: 'x', finalVector: { a: 0, v: 0, d: 0 } }], 10)
    expect(field.own.length).toBe(1)
    expect(field.collective.length).toBe(10)
  })
})
