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

  it('prefers autobio era median over depth heuristic for variation pick', () => {
    // The Late-Night Architect has variations spanning eras 1975, 1985, 2015, 2022.
    // With autobio.eraSummary.median = 1985, the closest variation should be picked
    // over what the depth heuristic alone would suggest.
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 8, maxLayer: 8 },  // depth would normally push toward 2020s
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: { excerpts: [] },
      moment: { totalDownbeats: 30 },
      autobio: {
        songs: [
          { title: 'A', artist: 'X', year: 1985 },
          { title: 'B', artist: 'Y', year: 1986 },
          { title: 'C', artist: 'Z', year: 1984 },
        ],
        eraSummary: { median: 1985, span: 2, clustered: true },
      },
    }
    // Use a deterministic rand that never triggers ε-greedy (always returns >= 0.5).
    const result = scoreArchetype({ a: 0.3, v: 0.4, d: 0.85 }, phaseData, () => 0.99)
    expect(result.archetypeId).toBe('late-night-architect')
    expect(result.variationId).toBe('synth-melancholy-1980s')
  })
})
