import { describe, it, expect } from 'vitest'
import { buildCompositionPlan, buildPrompt, arousalToBpm, eraWords } from '../avdToPlan.js'
import { ARCHETYPES } from '../archetypes.js'

const NEUTRAL = { a: 0, v: 0, d: 0 }

describe('buildCompositionPlan', () => {
  it('produces the composition-plan shape (snake_case API schema)', () => {
    const plan = buildCompositionPlan({ avd: NEUTRAL, archetypeId: 'hearth-keeper', durationMs: 210000 })
    expect(Array.isArray(plan.positive_global_styles)).toBe(true)
    expect(Array.isArray(plan.negative_global_styles)).toBe(true)
    expect(Array.isArray(plan.sections)).toBe(true)
    expect(plan.sections.length).toBe(4)
    for (const s of plan.sections) {
      expect(typeof s.section_name).toBe('string')
      expect(Array.isArray(s.positive_local_styles)).toBe(true)
      expect(typeof s.duration_ms).toBe('number')
    }
  })

  it('section durations sum exactly to the requested length', () => {
    for (const dur of [30000, 120000, 210000, 199999]) {
      const plan = buildCompositionPlan({ avd: NEUTRAL, archetypeId: 'sky-seeker', durationMs: dur })
      const summed = plan.sections.reduce((a, s) => a + s.duration_ms, 0)
      expect(summed).toBe(dur)
    }
  })

  it('every section is instrumental (empty lines) with no-vocals negatives', () => {
    const plan = buildCompositionPlan({ avd: NEUTRAL, archetypeId: 'slow-glow' })
    for (const s of plan.sections) {
      expect(s.lines).toEqual([])
    }
    expect(plan.negative_global_styles).toContain('vocals')
  })

  it('reflects the faced archetype in the global styles', () => {
    const plan = buildCompositionPlan({ avd: NEUTRAL, archetypeId: 'quiet-insurgent' })
    expect(plan.positive_global_styles).toContain('post-rock')
    expect(plan.positive_global_styles).toContain('instrumental')
  })

  it('maps arousal / valence / depth into distinct style words', () => {
    const calm = buildCompositionPlan({ avd: { a: -0.9, v: 0, d: 0 }, archetypeId: 'hearth-keeper' })
    const driven = buildCompositionPlan({ avd: { a: 0.9, v: 0, d: 0 }, archetypeId: 'hearth-keeper' })
    expect(calm.positive_global_styles).toContain('slow tempo')
    expect(driven.positive_global_styles).toContain('driving')

    const sad = buildCompositionPlan({ avd: { a: 0, v: -0.9, d: 0 }, archetypeId: 'hearth-keeper' })
    const glad = buildCompositionPlan({ avd: { a: 0, v: 0.9, d: 0 }, archetypeId: 'hearth-keeper' })
    expect(sad.positive_global_styles).toContain('melancholic')
    expect(glad.positive_global_styles).toContain('warm')

    const sparse = buildCompositionPlan({ avd: { a: 0, v: 0, d: -0.9 }, archetypeId: 'hearth-keeper' })
    const dense = buildCompositionPlan({ avd: { a: 0, v: 0, d: 0.9 }, archetypeId: 'hearth-keeper' })
    expect(sparse.positive_global_styles).toContain('minimal')
    expect(dense.positive_global_styles).toContain('layered')
  })

  it('folds the era year into production descriptors', () => {
    const plan = buildCompositionPlan({ avd: NEUTRAL, archetypeId: 'hearth-keeper', eraYear: 1985 })
    expect(plan.positive_global_styles.some((s) => s.includes('1980s'))).toBe(true)
  })

  it('handles an unknown archetype id with a safe default', () => {
    const plan = buildCompositionPlan({ avd: NEUTRAL, archetypeId: 'nonexistent' })
    expect(plan.positive_global_styles).toContain('instrumental')
    expect(plan.sections.length).toBe(4)
  })

  it('clamps out-of-range AVD without throwing', () => {
    expect(() => buildCompositionPlan({ avd: { a: 5, v: -5, d: 9 }, archetypeId: 'sky-seeker' })).not.toThrow()
  })

  it('every real archetype id yields a plan', () => {
    for (const a of ARCHETYPES) {
      const plan = buildCompositionPlan({ avd: NEUTRAL, archetypeId: a.id })
      expect(plan.sections.length).toBe(4)
    }
  })
})

describe('helpers', () => {
  it('arousalToBpm is monotonic in arousal', () => {
    expect(arousalToBpm(-1)).toBeLessThan(arousalToBpm(0))
    expect(arousalToBpm(0)).toBeLessThan(arousalToBpm(1))
  })

  it('eraWords returns [] for missing/invalid year', () => {
    expect(eraWords()).toEqual([])
    expect(eraWords('nope')).toEqual([])
  })

  it('buildPrompt is instrumental prose', () => {
    const p = buildPrompt({ avd: NEUTRAL, archetypeId: 'hearth-keeper', eraYear: 2005 })
    expect(p.toLowerCase()).toContain('instrumental')
    expect(p.toLowerCase()).toContain('no vocals')
  })
})
