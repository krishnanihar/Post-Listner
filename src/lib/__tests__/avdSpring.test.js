import { describe, it, expect } from 'vitest'
import { SPRING_OMEGA, stepSpring, toUnit } from '../avdSpring.js'

describe('avdSpring — constants', () => {
  it('uses omega = 6 rad/s per spec', () => {
    expect(SPRING_OMEGA).toBe(6)
  })
})

describe('avdSpring — toUnit maps [-1,1] -> [0,1]', () => {
  it('maps endpoints and midpoint', () => {
    expect(toUnit(-1)).toBe(0)
    expect(toUnit(0)).toBe(0.5)
    expect(toUnit(1)).toBe(1)
  })
})

describe('avdSpring — stepSpring (critically damped, no overshoot)', () => {
  it('a single step moves toward the target', () => {
    const s = stepSpring(0, 0, 1, 1 / 60)
    expect(s.value).toBeGreaterThan(0)
    expect(s.value).toBeLessThan(1)
  })

  it('never overshoots a step target while rising', () => {
    let s = { value: 0, velocity: 0 }
    let maxValue = 0
    for (let i = 0; i < 600; i++) {
      s = stepSpring(s.value, s.velocity, 1, 1 / 60)
      maxValue = Math.max(maxValue, s.value)
    }
    expect(maxValue).toBeLessThanOrEqual(1 + 1e-6)
  })

  it('rises monotonically toward the target', () => {
    let s = { value: 0, velocity: 0 }
    let prev = -Infinity
    for (let i = 0; i < 120; i++) {
      s = stepSpring(s.value, s.velocity, 1, 1 / 60)
      expect(s.value).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = s.value
    }
  })

  it('converges to the target within 2 seconds', () => {
    let s = { value: 0, velocity: 0 }
    for (let i = 0; i < 120; i++) s = stepSpring(s.value, s.velocity, 1, 1 / 60)
    expect(s.value).toBeCloseTo(1, 2)
  })

  it('is roughly half-way by ~250ms (perceived response)', () => {
    let s = { value: 0, velocity: 0 }
    for (let i = 0; i < 15; i++) s = stepSpring(s.value, s.velocity, 1, 1 / 60)
    expect(s.value).toBeGreaterThan(0.4)
  })

  it('mutates and returns the provided out object (zero-alloc path)', () => {
    const state = { value: 0, velocity: 0 }
    const ret = stepSpring(state.value, state.velocity, 1, 1 / 60, undefined, state)
    expect(ret).toBe(state)            // same reference, no allocation
    expect(state.value).toBeGreaterThan(0)
  })
})
