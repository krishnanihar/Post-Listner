import { describe, it, expect } from 'vitest'
import { quatFromEulerZXY, quatMul, quatConj, unwrapAngle }
  from '../quaternion.js'

describe('quatFromEulerZXY', () => {
  it('returns identity quat for zero angles', () => {
    const q = quatFromEulerZXY(0, 0, 0)
    expect(q[0]).toBeCloseTo(0, 5)
    expect(q[1]).toBeCloseTo(0, 5)
    expect(q[2]).toBeCloseTo(0, 5)
    expect(q[3]).toBeCloseTo(1, 5)
  })

  it('produces a unit quaternion for arbitrary input', () => {
    const q = quatFromEulerZXY(45, 30, 60)
    const len = Math.hypot(q[0], q[1], q[2], q[3])
    expect(len).toBeCloseTo(1, 5)
  })
})

describe('quatMul', () => {
  it('identity × q = q', () => {
    const id = [0, 0, 0, 1]
    const q = [0.1, 0.2, 0.3, Math.sqrt(1 - 0.01 - 0.04 - 0.09)]
    const r = quatMul(id, q)
    for (let i = 0; i < 4; i++) expect(r[i]).toBeCloseTo(q[i], 5)
  })
})

describe('quatConj', () => {
  it('negates x/y/z, preserves w', () => {
    expect(quatConj([1, 2, 3, 4])).toEqual([-1, -2, -3, 4])
  })
})

describe('unwrapAngle', () => {
  it('returns delta with sign across 0° boundary', () => {
    // current=358, previous=2 → naive diff -356, unwrapped delta +4
    expect(unwrapAngle(358, 2)).toBeCloseTo(-4, 5)
    expect(unwrapAngle(2, 358)).toBeCloseTo(4, 5)
  })

  it('handles 180° boundary (ambiguous — pick shortest)', () => {
    // 179 → -179: shortest delta is +2 (going through 180)
    expect(Math.abs(unwrapAngle(-179, 179))).toBeCloseTo(2, 5)
  })

  it('returns zero for identical angles', () => {
    expect(unwrapAngle(45, 45)).toBe(0)
  })
})
