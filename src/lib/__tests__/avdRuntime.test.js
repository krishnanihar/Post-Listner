import { describe, it, expect } from 'vitest'
import {
  ETA_COLD,
  ETA_STEADY,
  DEPTH_ETA_SCALE,
  COLD_START_TURNS,
  HYSTERESIS_GATE,
  etaForTurn,
  clampUnitSigned,
  ewmaStep,
  selectScene,
} from '../avdRuntime.js'

describe('avdRuntime — constants', () => {
  it('matches the Ship-Blockers spec', () => {
    expect(ETA_COLD).toBe(0.35)
    expect(ETA_STEADY).toBe(0.18)
    expect(DEPTH_ETA_SCALE).toBe(0.6)
    expect(COLD_START_TURNS).toBe(3)
    expect(HYSTERESIS_GATE).toBe(0.12)
  })
})

describe('avdRuntime — etaForTurn', () => {
  it('uses cold-start eta for turns 0,1,2', () => {
    expect(etaForTurn(0)).toBe(0.35)
    expect(etaForTurn(2)).toBe(0.35)
  })
  it('uses steady eta from turn 3 on', () => {
    expect(etaForTurn(3)).toBe(0.18)
    expect(etaForTurn(50)).toBe(0.18)
  })
})

describe('avdRuntime — clampUnitSigned', () => {
  it('clamps to [-1, 1]', () => {
    expect(clampUnitSigned(-2)).toBe(-1)
    expect(clampUnitSigned(2)).toBe(1)
    expect(clampUnitSigned(0.4)).toBe(0.4)
  })
})

describe('avdRuntime — ewmaStep', () => {
  it('moves a and v toward target by eta (cold start)', () => {
    const next = ewmaStep({ a: 0, v: 0, d: 0 }, { a: 1, v: -1, d: 0 }, 0)
    expect(next.a).toBeCloseTo(0.35, 6)
    expect(next.v).toBeCloseTo(-0.35, 6)
  })

  it('moves depth slower than a/v (0.6x eta)', () => {
    const next = ewmaStep({ a: 0, v: 0, d: 0 }, { a: 1, v: 1, d: 1 }, 0)
    expect(next.d).toBeCloseTo(0.35 * 0.6, 6)
  })

  it('uses steady eta from turn 3', () => {
    const next = ewmaStep({ a: 0, v: 0, d: 0 }, { a: 1, v: 1, d: 1 }, 3)
    expect(next.a).toBeCloseTo(0.18, 6)
    expect(next.d).toBeCloseTo(0.18 * 0.6, 6)
  })

  it('clamps the result to [-1, 1]', () => {
    const next = ewmaStep({ a: 0.95, v: 0, d: 0 }, { a: 100, v: 0, d: 0 }, 0)
    expect(next.a).toBe(1)
  })

  it('never mutates the input vectors', () => {
    const cur = { a: 0.1, v: 0.2, d: 0.3 }
    ewmaStep(cur, { a: 1, v: 1, d: 1 }, 0)
    expect(cur).toEqual({ a: 0.1, v: 0.2, d: 0.3 })
  })
})

describe('avdRuntime — selectScene', () => {
  const scenes = [
    { id: 'peace', anchor: [-0.6, 0.6, 0] },
    { id: 'unease', anchor: [0.6, -0.6, 0] },
    { id: 'sublime', anchor: [0, 0, 0.8] },
  ]

  it('picks nearest centroid when there is no current scene', () => {
    expect(selectScene({ a: -0.5, v: 0.5, d: 0 }, scenes, null)).toBe('peace')
  })

  it('keeps the current scene when no other is closer by more than the gate', () => {
    const v = { a: -0.02, v: 0.02, d: 0.5 }
    const kept = selectScene(v, scenes, 'peace')
    expect(['peace', 'sublime']).toContain(kept)
  })

  it('switches only when the new nearest beats current by > the hysteresis gate', () => {
    const twoScenes = [
      { id: 'A', anchor: [0, 0, 0] },
      { id: 'B', anchor: [1, 0, 0] },
    ]
    expect(selectScene({ a: 0.45, v: 0, d: 0 }, twoScenes, 'A')).toBe('A')
    expect(selectScene({ a: 0.5, v: 0, d: 0 }, twoScenes, 'A')).toBe('A')
    expect(selectScene({ a: 0.6, v: 0, d: 0 }, twoScenes, 'A')).toBe('B')
    expect(selectScene({ a: 0.56, v: 0, d: 0 }, twoScenes, 'A')).toBe('A')
  })

  it('returns current id unchanged when scenes is empty', () => {
    expect(selectScene({ a: 0, v: 0, d: 0 }, [], 'A')).toBe('A')
  })
})
