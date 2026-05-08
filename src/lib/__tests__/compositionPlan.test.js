import { describe, it, expect } from 'vitest'
import { buildCompositionPlan } from '../compositionPlan'

const baseInput = {
  archetypeId: 'late-night-architect',
  variationId: 'lo-fi-piano-2010s',
  eraMedian: 2015,
  dominantGemsTag: null,
  hedonic: null,
}

describe('buildCompositionPlan', () => {
  it('returns positive_global_styles, negative_global_styles, sections', () => {
    const plan = buildCompositionPlan(baseInput)
    expect(Array.isArray(plan.positive_global_styles)).toBe(true)
    expect(Array.isArray(plan.negative_global_styles)).toBe(true)
    expect(Array.isArray(plan.sections)).toBe(true)
    expect(plan.sections.length).toBeGreaterThanOrEqual(1)
  })

  it('every section has section_name + duration_ms + style arrays', () => {
    const plan = buildCompositionPlan(baseInput)
    for (const s of plan.sections) {
      expect(typeof s.section_name).toBe('string')
      expect(typeof s.duration_ms).toBe('number')
      expect(s.duration_ms).toBeGreaterThan(2000)
      expect(Array.isArray(s.positive_local_styles)).toBe(true)
      expect(Array.isArray(s.negative_local_styles)).toBe(true)
    }
  })

  it('total duration is between 25s and 60s', () => {
    const plan = buildCompositionPlan(baseInput)
    const total = plan.sections.reduce((s, sec) => s + sec.duration_ms, 0)
    expect(total).toBeGreaterThanOrEqual(25000)
    expect(total).toBeLessThanOrEqual(60000)
  })

  it('archetype-specific styles appear in positive_global_styles', () => {
    const lateNight = buildCompositionPlan({ ...baseInput, archetypeId: 'late-night-architect' })
    const skySeeker = buildCompositionPlan({ ...baseInput, archetypeId: 'sky-seeker' })
    expect(lateNight.positive_global_styles.join(' ').toLowerCase()).toMatch(/lo-fi|piano|introspective|nocturnal|ambient/)
    expect(skySeeker.positive_global_styles.join(' ').toLowerCase()).toMatch(/cinematic|triumphant|expansive|sky/)
  })

  it('era median <1990 emits "vintage" / "analog"', () => {
    const plan = buildCompositionPlan({ ...baseInput, eraMedian: 1985 })
    const text = plan.positive_global_styles.join(' ').toLowerCase()
    expect(text).toMatch(/vintage|analog|tape|warm/)
  })

  it('era median ≥2015 emits "modern" / "neo-classical"', () => {
    const plan = buildCompositionPlan({ ...baseInput, eraMedian: 2022 })
    const text = plan.positive_global_styles.join(' ').toLowerCase()
    expect(text).toMatch(/contemporary|modern|neo-classical|2020s/)
  })

  it('dominantGemsTag injects a matching style hint', () => {
    const plan = buildCompositionPlan({ ...baseInput, dominantGemsTag: 'nostalgic' })
    expect(plan.positive_global_styles.join(' ').toLowerCase()).toMatch(/nostalgic|warm|memory/)
  })

  it('hedonic === false biases toward restraint', () => {
    const plan = buildCompositionPlan({ ...baseInput, hedonic: false })
    const neg = plan.negative_global_styles.join(' ').toLowerCase()
    expect(neg).toMatch(/triumphant|saccharine|bombastic|overproduced/)
  })

  it('always sets force_instrumental implicitly via negative styles', () => {
    const plan = buildCompositionPlan(baseInput)
    expect(plan.negative_global_styles.join(' ').toLowerCase()).toContain('vocal')
  })

  it('returns null when archetypeId is unknown', () => {
    const plan = buildCompositionPlan({ ...baseInput, archetypeId: 'fake' })
    expect(plan).toBeNull()
  })
})
