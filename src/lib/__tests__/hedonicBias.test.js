import { describe, it, expect } from 'vitest'
import { applyHedonicBias } from '../hedonicBias'

describe('applyHedonicBias', () => {
  const baseScores = {
    'late-night-architect': 0.1,
    'hearth-keeper': 0.1,
    'velvet-mystic': 0.1,
    'quiet-insurgent': 0.1,
    'slow-glow': 0.1,
    'sky-seeker': 0.5,
  }

  it('returns scores unchanged when hedonic is null', () => {
    const out = applyHedonicBias(baseScores, null)
    expect(out).toEqual(baseScores)
  })

  it('returns scores unchanged when hedonic is true', () => {
    const out = applyHedonicBias(baseScores, true)
    expect(out).toEqual(baseScores)
  })

  it('boosts quiet-insurgent and slow-glow when hedonic is false', () => {
    const out = applyHedonicBias(baseScores, false)
    expect(out['quiet-insurgent']).toBeGreaterThan(baseScores['quiet-insurgent'])
    expect(out['slow-glow']).toBeGreaterThan(baseScores['slow-glow'])
  })

  it('reduces sky-seeker when hedonic is false', () => {
    const out = applyHedonicBias(baseScores, false)
    expect(out['sky-seeker']).toBeLessThan(baseScores['sky-seeker'])
  })

  it('renormalizes scores so they sum to 1.0', () => {
    const out = applyHedonicBias(baseScores, false)
    const sum = Object.values(out).reduce((s, v) => s + v, 0)
    expect(sum).toBeCloseTo(1.0, 5)
  })
})
