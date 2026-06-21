import { describe, it, expect } from 'vitest'
import {
  ARCHETYPE_CENTROIDS,
  selectArchetypeByAvd,
  mapAvdToStems,
} from '../avdToStems.js'
import { ARCHETYPES } from '../archetypes.js'

describe('avdToStems — ARCHETYPE_CENTROIDS', () => {
  it('has one signed centroid per archetype, mapped [0,1]->[-1,1]', () => {
    expect(ARCHETYPE_CENTROIDS.length).toBe(ARCHETYPES.length)
    const sky = ARCHETYPE_CENTROIDS.find((c) => c.id === 'sky-seeker')
    expect(sky.anchor[0]).toBeCloseTo(0.56, 6)
    expect(sky.anchor[1]).toBeCloseTo(0.5, 6)
    expect(sky.anchor[2]).toBeCloseTo(0.56, 6)
  })
})

describe('avdToStems — selectArchetypeByAvd', () => {
  it('high A/V/D → sky-seeker', () => {
    expect(selectArchetypeByAvd({ a: 0.9, v: 0.9, d: 0.9 })).toBe('sky-seeker')
  })
  it('high-A low-V → quiet-insurgent', () => {
    expect(selectArchetypeByAvd({ a: 0.6, v: -0.6, d: 0.1 })).toBe('quiet-insurgent')
  })
  it('low-A high-V high-D → velvet-mystic', () => {
    expect(selectArchetypeByAvd({ a: -0.4, v: 0.5, d: 0.7 })).toBe('velvet-mystic')
  })
  it('neutral vector → nearest-to-origin (slow-glow)', () => {
    expect(selectArchetypeByAvd({ a: 0, v: 0, d: 0 })).toBe('slow-glow')
  })
  it('excludes restricted archetypes', () => {
    expect(selectArchetypeByAvd({ a: 0.9, v: 0.9, d: 0.9 }, { restricted: ['sky-seeker'] }))
      .toBe('velvet-mystic')
  })
  it('falls back to the first archetype when all are restricted', () => {
    const all = ARCHETYPES.map((a) => a.id)
    expect(selectArchetypeByAvd({ a: 0, v: 0, d: 0 }, { restricted: all }))
      .toBe(ARCHETYPES[0].id)
  })
})

describe('avdToStems — mapAvdToStems', () => {
  it('returns the same bundle shape as descriptorsToStems', () => {
    const b = mapAvdToStems({ a: 0.9, v: 0.9, d: 0.9 }, { era: 2015 })
    expect(b).toMatchObject({
      archetypeId: 'sky-seeker',
      variationId: expect.any(String),
      stems: expect.any(Object),
      masterUrl: expect.any(String),
    })
  })
  it('era selects the variation', () => {
    const archetype = ARCHETYPES.find((a) => a.id === 'sky-seeker')
    const b1990 = mapAvdToStems({ a: 0.9, v: 0.9, d: 0.9 }, { era: 1990 })
    let best = archetype.variations[0]
    let bestDist = Math.abs((best.era || 2000) - 1990)
    for (const v of archetype.variations.slice(1)) {
      const dist = Math.abs((v.era || 2000) - 1990)
      if (dist < bestDist) { best = v; bestDist = dist }
    }
    expect(b1990.variationId).toBe(best.id)
  })
  it('era is archetype-invariant (it only moves the variation) and unlocks a non-default version', () => {
    const v = { a: 0.9, v: 0.9, d: 0.9 } // → sky-seeker
    const noEra = mapAvdToStems(v, {})        // the old behaviour → vs[0]
    const oldest = mapAvdToStems(v, { era: 1960 })
    const newest = mapAvdToStems(v, { era: 2025 })
    // same world regardless of era
    expect(oldest.archetypeId).toBe(noEra.archetypeId)
    expect(newest.archetypeId).toBe(noEra.archetypeId)
    // but a real era reaches a different variation than the default (the fix:
    // the 1960s–1990s versions were previously unreachable)
    expect(oldest.variationId).not.toBe(newest.variationId)
    expect([oldest.variationId, newest.variationId]).toContain(
      // at least one differs from the no-era default vs[0]
      [oldest, newest].find((b) => b.variationId !== noEra.variationId).variationId
    )
  })
})
