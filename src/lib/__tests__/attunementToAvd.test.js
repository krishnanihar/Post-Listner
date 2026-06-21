import { describe, it, expect } from 'vitest'
import {
  leanLiftTarget, riseTarget, riseHedonic, dwellConfidence,
} from '../attunementToAvd.js'

const CUR = { a: 0.3, v: -0.1, d: 0.2 }

describe('leanLiftTarget', () => {
  it('leaning right (pan→1) targets high valence; center pan→0 valence', () => {
    expect(leanLiftTarget(1, 0.5, CUR).v).toBeCloseTo(1, 6)
    expect(leanLiftTarget(0.5, 0.5, CUR).v).toBeCloseTo(0, 6)
    expect(leanLiftTarget(0, 0.5, CUR).v).toBeCloseTo(-1, 6)
  })
  it('tilting back (filterNorm→1) targets high depth', () => {
    expect(leanLiftTarget(0.5, 1, CUR).d).toBeCloseTo(1, 6)
    expect(leanLiftTarget(0.5, 0, CUR).d).toBeCloseTo(-1, 6)
  })
  it('roll-only sentinel (filterNorm===0.5) holds Depth at the current value', () => {
    expect(leanLiftTarget(1, 0.5, CUR).d).toBe(CUR.d)
    expect(leanLiftTarget(0, 0.5, CUR).d).toBe(CUR.d)
  })
  it('leaves arousal at the current value (unprobed axis must not drift)', () => {
    expect(leanLiftTarget(1, 1, CUR).a).toBe(CUR.a)
  })
})

describe('riseTarget', () => {
  it('a big swell targets high arousal', () => {
    expect(riseTarget(1, true, CUR).a).toBeCloseTo(1, 6)
  })
  it('a small swell targets low arousal', () => {
    expect(riseTarget(0, true, CUR).a).toBeCloseTo(-1, 6)
  })
  it('pulling back from the peak lowers arousal and nudges valence down', () => {
    const rode = riseTarget(0.8, true, CUR)
    const held = riseTarget(0.8, false, CUR)
    expect(held.a).toBeLessThan(rode.a)
    expect(held.v).toBeLessThan(rode.v)
  })
  it('leaves depth at the current value', () => {
    expect(riseTarget(0.8, true, CUR).d).toBe(CUR.d)
  })
})

describe('riseHedonic', () => {
  it('passes through the ride/pull-back boolean', () => {
    expect(riseHedonic(true)).toBe(true)
    expect(riseHedonic(false)).toBe(false)
  })
})

describe('dwellConfidence', () => {
  it('a decisive hold (0.4–2s) is full confidence', () => {
    expect(dwellConfidence(400)).toBeCloseTo(1, 6)
    expect(dwellConfidence(1200)).toBeCloseTo(1, 6)
    expect(dwellConfidence(2000)).toBeCloseTo(1, 6)
  })
  it('an instant flick is low confidence', () => {
    expect(dwellConfidence(0)).toBeLessThan(0.5)
  })
  it('an agonized hold (>2s) is discounted, floored at 0.7', () => {
    expect(dwellConfidence(5000)).toBeCloseTo(0.7, 6)
    expect(dwellConfidence(2500)).toBeLessThan(1)
    expect(dwellConfidence(2500)).toBeGreaterThanOrEqual(0.7)
  })
})
