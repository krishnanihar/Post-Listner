import { describe, it, expect } from 'vitest'
import { OneEuroFilter, OneEuroQuaternion } from '../oneEuroFilter'

describe('OneEuroFilter (scalar)', () => {
  it('passes the first sample through unchanged', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.0 })
    expect(f.filter(0.5, 0)).toBe(0.5)
  })

  it('returns a smoothed value when given a stable signal with jitter', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.0 })
    let out = 0
    // 60Hz for 1 second of small noise around 1.0
    const seed = 12345
    let rng = seed
    for (let i = 0; i < 60; i++) {
      rng = (rng * 1664525 + 1013904223) >>> 0
      const noise = ((rng / 0xffffffff) - 0.5) * 0.2
      out = f.filter(1.0 + noise, i * 1000 / 60)
    }
    // After 1s of filtering, output should be much closer to 1.0 than the raw noise
    expect(Math.abs(out - 1.0)).toBeLessThan(0.05)
  })

  it('tracks fast motion with bounded lag when beta > 0', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.1 })
    let out = 0
    // Step input from 0 to 1.0 at t=500ms; sample at 60Hz for 1s
    for (let i = 0; i < 60; i++) {
      const t = i * 1000 / 60
      const x = t < 500 ? 0 : 1.0
      out = f.filter(x, t)
    }
    // Should have caught up to within 5% by end
    expect(out).toBeGreaterThan(0.95)
  })
})

describe('OneEuroQuaternion', () => {
  it('passes the first quaternion through (normalized)', () => {
    const f = new OneEuroQuaternion({ minCutoff: 1.0, beta: 0.0 })
    const out = f.filter(0, 0, 0, 1, 0)
    expect(out.x).toBeCloseTo(0)
    expect(out.y).toBeCloseTo(0)
    expect(out.z).toBeCloseTo(0)
    expect(out.w).toBeCloseTo(1)
  })

  it('output is always a unit quaternion', () => {
    const f = new OneEuroQuaternion({ minCutoff: 1.0, beta: 0.007 })
    let out
    for (let i = 0; i < 30; i++) {
      const a = i * 0.05
      out = f.filter(Math.sin(a) * 0.3, 0, 0, Math.cos(a) * 0.7 + 0.5, i * 16.6)
      const len = Math.sqrt(out.x*out.x + out.y*out.y + out.z*out.z + out.w*out.w)
      expect(len).toBeCloseTo(1.0, 5)
    }
  })

  it('handles hemisphere flip without snapping', () => {
    const f = new OneEuroQuaternion({ minCutoff: 1.0, beta: 0.0 })
    f.filter(0, 0, 0, 1, 0)
    // Identity flipped: -0,-0,-0,-1 represents the same rotation
    const out = f.filter(0, 0, 0, -1, 16.6)
    // Should not produce a wild swing — output stays near identity
    const dot = Math.abs(out.w)
    expect(dot).toBeGreaterThan(0.99)
  })
})
