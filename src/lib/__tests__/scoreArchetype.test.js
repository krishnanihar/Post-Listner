import { describe, it, expect } from 'vitest'
import { scoreArchetype, _archetypeScores } from '../scoreArchetype'

const fakePhaseData = (overrides = {}) => ({
  spectrum: { pairs: [], hoveredButNotChosen: [] },
  depth: { finalLayer: 4, maxLayer: 4, reEngaged: false },
  textures: { preferred: ['strings', 'keys'], rejected: [], neutral: [] },
  moment: { totalTaps: 12, peakTapRate: 1.4 },
  ...overrides,
})

describe('scoreArchetype', () => {
  it('returns an archetypeId, variationId, confidence, scores', () => {
    const result = scoreArchetype({ a: 0.5, v: 0.5, d: 0.5 }, fakePhaseData())
    expect(result.archetypeId).toBeTruthy()
    expect(result.variationId).toBeTruthy()
    expect(typeof result.confidence).toBe('number')
    expect(result.scores).toBeTypeOf('object')
  })

  it('low-A high-D introspective profile selects Late-Night Architect', () => {
    const result = scoreArchetype({ a: 0.3, v: 0.4, d: 0.85 }, fakePhaseData())
    expect(result.archetypeId).toBe('late-night-architect')
  })

  it('mid-A high-V warm profile selects Hearth-Keeper', () => {
    const result = scoreArchetype({ a: 0.4, v: 0.78, d: 0.5 }, fakePhaseData())
    expect(result.archetypeId).toBe('hearth-keeper')
  })

  it('high-A low-V tense profile selects Quiet Insurgent', () => {
    const result = scoreArchetype({ a: 0.65, v: 0.25, d: 0.55 }, fakePhaseData())
    expect(result.archetypeId).toBe('quiet-insurgent')
  })

  it('high-A high-V high-D triumphant profile selects Sky-Seeker', () => {
    const result = scoreArchetype({ a: 0.8, v: 0.78, d: 0.78 }, fakePhaseData())
    expect(result.archetypeId).toBe('sky-seeker')
  })

  it('confidence is in [0, 1]', () => {
    const result = scoreArchetype({ a: 0.5, v: 0.5, d: 0.5 }, fakePhaseData())
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('archetype scores sum to 1.0 (softmax)', () => {
    const scores = _archetypeScores({ a: 0.5, v: 0.5, d: 0.5 })
    const sum = Object.values(scores).reduce((s, v) => s + v, 0)
    expect(sum).toBeCloseTo(1.0, 5)
  })

  it('selects a valid variation id within the chosen archetype', () => {
    const result = scoreArchetype({ a: 0.3, v: 0.4, d: 0.85 }, fakePhaseData())
    const validIds = [
      'lo-fi-piano-2010s', 'synth-melancholy-1980s',
      'neo-classical-2020s', 'ecm-jazz-piano-1970s',
    ]
    expect(validIds).toContain(result.variationId)
  })
})
