import { describe, it, test, expect } from 'vitest'
import { ARCHETYPES, getArchetype, getVariation } from '../archetypes'

describe('archetypes', () => {
  it('has exactly 6 archetypes', () => {
    expect(ARCHETYPES).toHaveLength(6)
  })

  it('each archetype has exactly 4 variations', () => {
    for (const a of ARCHETYPES) {
      expect(a.variations).toHaveLength(4)
    }
  })

  it('each archetype has a 4-sentence Forer template', () => {
    for (const a of ARCHETYPES) {
      expect(a.forerTemplate).toHaveLength(4)
      for (const sentence of a.forerTemplate) {
        expect(typeof sentence).toBe('string')
        expect(sentence.length).toBeGreaterThan(20)
      }
    }
  })

  it('each archetype has scoringWeights with a, v, d numeric fields', () => {
    for (const a of ARCHETYPES) {
      expect(typeof a.scoringWeights.a).toBe('number')
      expect(typeof a.scoringWeights.v).toBe('number')
      expect(typeof a.scoringWeights.d).toBe('number')
    }
  })

  it('getArchetype returns the archetype by id', () => {
    expect(getArchetype('late-night-architect').displayName).toBe('The Late-Night Architect')
  })

  it('getVariation returns the variation by archetype + variation id', () => {
    const v = getVariation('late-night-architect', 'lo-fi-piano-2010s')
    expect(v.microgenreLabel).toContain('lo-fi piano')
  })

  it('all variation ids are unique within an archetype', () => {
    for (const a of ARCHETYPES) {
      const ids = a.variations.map(v => v.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  test('every archetype has a 4th forerTemplate sentence with a self-projection ___ glyph', () => {
    for (const a of ARCHETYPES) {
      expect(a.forerTemplate.length).toBe(4)
      expect(a.forerTemplate[3]).toMatch(/_{3,}/)  // at least 3 underscores
    }
  })
})
