import { describe, it, expect } from 'vitest'
import { GLYPH_VERSION, simplifyPath, distillGlyph, deriveHand } from '../glyph.js'

describe('simplifyPath (Ramer–Douglas–Peucker)', () => {
  it('keeps both endpoints', () => {
    const pts = [[0, 0, 0], [0.5, 0.01, 1], [1, 0, 2]]
    const out = simplifyPath(pts, 0.1)
    expect(out[0]).toEqual([0, 0, 0])
    expect(out[out.length - 1]).toEqual([1, 0, 2])
  })

  it('collapses a near-straight run to two points', () => {
    const pts = []
    for (let i = 0; i <= 20; i++) pts.push([i / 20, 0.0001 * i, i])
    expect(simplifyPath(pts, 0.05).length).toBe(2)
  })

  it('preserves a sharp corner', () => {
    const pts = [[0, 0, 0], [0.5, 0.5, 1], [1, 0, 2]]
    expect(simplifyPath(pts, 0.1).length).toBe(3)
  })
})

describe('distillGlyph', () => {
  it('returns an empty glyph for empty input', () => {
    expect(distillGlyph([])).toEqual({ v: GLYPH_VERSION, pts: [], dur: 0 })
  })

  it('handles a one-point buffer without throwing', () => {
    const g = distillGlyph([[0.2, 0.3, 0]])
    expect(g.v).toBe(GLYPH_VERSION)
    expect(g.pts.length).toBe(1)
  })

  it('respects the point budget on a large noisy buffer', () => {
    const raw = []
    for (let i = 0; i < 14000; i++) {
      raw.push([0.5 + 0.3 * Math.sin(i / 20), 0.5 + 0.3 * Math.cos(i / 13), i * 16])
    }
    const g = distillGlyph(raw, { budget: 600 })
    expect(g.pts.length).toBeLessThanOrEqual(600)
    expect(g.pts.length).toBeGreaterThan(2)
  })

  it('preserves both endpoints through pre-decimation + budget enforcement', () => {
    const raw = [[0.01, 0.02, 0]]
    for (let i = 1; i < 13999; i++) {
      raw.push([0.5 + 0.3 * Math.sin(i), 0.5 + 0.3 * Math.cos(i * 1.3), i * 16])
    }
    raw.push([0.99, 0.98, 13999 * 16])
    const g = distillGlyph(raw, { budget: 600 })
    expect(g.pts[0]).toEqual([0.01, 0.02, 0])
    expect(g.pts[g.pts.length - 1].slice(0, 2)).toEqual([0.99, 0.98])
  })

  it('keeps t monotonically non-decreasing', () => {
    const raw = []
    for (let i = 0; i < 2000; i++) raw.push([(i * 7) % 100 / 100, (i * 13) % 100 / 100, i * 16])
    const g = distillGlyph(raw)
    for (let i = 1; i < g.pts.length; i++) {
      expect(g.pts[i][2]).toBeGreaterThanOrEqual(g.pts[i - 1][2])
    }
  })

  it('sets dur to the last sample time and rounds coordinates', () => {
    const g = distillGlyph([[0.123456, 0.654321, 0], [0.7, 0.2, 1234.7]])
    expect(g.dur).toBe(1235)
    expect(g.pts[0][0]).toBe(0.123)
    expect(g.pts[0][1]).toBe(0.654)
    expect(g.pts[1]).toEqual([0.7, 0.2, 1235])
  })
})

describe('deriveHand', () => {
  it('is deterministic for a given seed', () => {
    expect(deriveHand('user-abc')).toEqual(deriveHand('user-abc'))
  })

  it('produces distinct styles for distinct seeds', () => {
    expect(deriveHand('user-abc')).not.toEqual(deriveHand('user-xyz'))
  })

  it('returns every style field within range', () => {
    const h = deriveHand('any-seed')
    expect(h.inkHue).toBeGreaterThanOrEqual(18)
    expect(h.inkHue).toBeLessThanOrEqual(38)
    expect(h.minWidth).toBeGreaterThan(0)
    expect(h.maxWidth).toBeGreaterThan(h.minWidth)
    expect(h.taper).toBeGreaterThan(0)
    expect(typeof h.inkSat).toBe('number')
    expect(typeof h.inkLight).toBe('number')
  })

  it('handles a null seed without throwing', () => {
    expect(() => deriveHand(null)).not.toThrow()
  })
})
