import { describe, it, expect } from 'vitest'
import { mapDescriptorsToStems } from '../descriptorsToStems'

describe('mapDescriptorsToStems', () => {
  it('returns a valid bundle with stems and masterUrl for a typical input', () => {
    const bundle = mapDescriptorsToStems({
      tempo: 'medium', mood: 'warm', era: 2014, instrumentation: 'acoustic',
    })
    expect(bundle.archetypeId).toBe('hearth-keeper')
    expect(bundle.variationId).toBe('folk-2010s')
    expect(bundle.stems).toEqual({
      vocals: expect.stringMatching(/hearth-keeper\/folk-2010s\/vocals\.mp3$/),
      drums: expect.stringMatching(/drums\.mp3$/),
      bass: expect.stringMatching(/bass\.mp3$/),
      other: expect.stringMatching(/other\.mp3$/),
    })
    expect(bundle.masterUrl).toMatch(/hearth-keeper_folk-2010s\.mp3$/)
  })

  it('picks late-night-architect for shadowed + intricate', () => {
    const bundle = mapDescriptorsToStems({
      tempo: 'slow', mood: 'shadowed', era: 2015, instrumentation: 'acoustic',
    })
    expect(bundle.archetypeId).toBe('late-night-architect')
  })

  it('picks sky-seeker for expansive + orchestral', () => {
    const bundle = mapDescriptorsToStems({
      tempo: 'medium', mood: 'expansive', era: 2020, instrumentation: 'orchestral',
    })
    expect(bundle.archetypeId).toBe('sky-seeker')
  })

  it('respects restricted_repertoires by avoiding marked archetype ids', () => {
    const bundle = mapDescriptorsToStems({
      tempo: 'medium', mood: 'warm', era: 2014,
    }, { restricted: ['hearth-keeper'] })
    expect(bundle.archetypeId).not.toBe('hearth-keeper')
  })

  it('falls back to a default bundle when input is missing all fields', () => {
    const bundle = mapDescriptorsToStems({})
    expect(bundle.archetypeId).toBeTruthy()
    expect(bundle.variationId).toBeTruthy()
    expect(bundle.stems.vocals).toBeTruthy()
  })

  it('picks the variation whose era is closest to the requested era', () => {
    const bundle = mapDescriptorsToStems({
      tempo: 'slow', mood: 'shadowed', era: 1980, instrumentation: 'synth',
    })
    // late-night-architect has synth-melancholy-1980s (era 1985) — closest
    expect(bundle.archetypeId).toBe('late-night-architect')
    expect(bundle.variationId).toBe('synth-melancholy-1980s')
  })
})
