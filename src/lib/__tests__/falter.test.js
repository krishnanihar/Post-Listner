import { describe, it, expect } from 'vitest'
import {
  createFalterState,
  stepFalter,
  reverbSendFactor,
  DEFAULT_FALTER,
} from '../falter.js'

// Drive the detector for `ms` at a fixed jerk, in 100ms steps.
function drive(state, jerk, ms, opts) {
  const step = 100
  for (let t = 0; t < ms; t += step) stepFalter(state, jerk, step, opts)
  return state
}

describe('falter — createFalterState', () => {
  it('starts calm', () => {
    const s = createFalterState()
    expect(s.chaosMs).toBe(0)
    expect(s.reduction).toBe(0)
    expect(reverbSendFactor(s)).toBe(1)
  })
})

describe('falter — no reaction before the sustain window', () => {
  it('stays at zero reduction while chaos is brief', () => {
    const s = createFalterState()
    drive(s, 5.0, 2000) // 2s of chaos < 4s sustain
    expect(s.reduction).toBe(0)
    expect(reverbSendFactor(s)).toBe(1)
  })
})

describe('falter — reacts to sustained chaos', () => {
  it('reduces the reverb send after sustained chaotic jerk', () => {
    const s = createFalterState()
    drive(s, 6.0, 4000 + 1500 + 500) // past sustain + full ramp-in
    expect(s.reduction).toBeGreaterThan(0)
    expect(s.reduction).toBeLessThanOrEqual(DEFAULT_FALTER.maxReduction + 1e-6)
    expect(reverbSendFactor(s)).toBeLessThan(1)
    expect(reverbSendFactor(s)).toBeGreaterThan(1 - DEFAULT_FALTER.maxReduction - 1e-6)
  })

  it('approaches the max reduction under prolonged chaos', () => {
    const s = createFalterState()
    drive(s, 8.0, 12000)
    expect(s.reduction).toBeCloseTo(DEFAULT_FALTER.maxReduction, 2)
  })
})

describe('falter — recovers when the hand settles', () => {
  it('returns toward no reduction after chaos stops', () => {
    const s = createFalterState()
    drive(s, 8.0, 10000)
    const peak = s.reduction
    expect(peak).toBeGreaterThan(0)
    drive(s, 0.0, 8000) // calm
    expect(s.reduction).toBeLessThan(peak)
    expect(s.reduction).toBe(0) // fully recovered
    expect(reverbSendFactor(s)).toBe(1)
  })
})

describe('falter — robustness', () => {
  it('ignores non-finite jerk and dt', () => {
    const s = createFalterState()
    stepFalter(s, NaN, 100)
    stepFalter(s, 5, NaN)
    stepFalter(s, Infinity, 100)
    expect(Number.isFinite(s.reduction)).toBe(true)
    expect(Number.isFinite(s.chaosMs)).toBe(true)
  })

  it('clamps a huge dt so a stalled frame cannot jump the state', () => {
    const s = createFalterState()
    stepFalter(s, 9, 100000) // one giant frame
    // chaosMs capped at sustain+rampIn; reduction still within bounds
    expect(s.reduction).toBeLessThanOrEqual(DEFAULT_FALTER.maxReduction + 1e-6)
  })

  it('respects a custom threshold', () => {
    const s = createFalterState()
    drive(s, 1.5, 10000, { jerkThreshold: 1.0 }) // below default, above custom
    expect(s.reduction).toBeGreaterThan(0)
  })
})
