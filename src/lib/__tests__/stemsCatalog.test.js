import { describe, it, expect } from 'vitest'
import { ARCHETYPES } from '../archetypes'
import {
  STEM_NAMES,
  getStems,
  getArchetypeStems,
  listCatalogKeys,
  listAllStemPaths,
} from '../stemsCatalog'

describe('stemsCatalog', () => {
  it('exposes the canonical Demucs 4-stem channel order', () => {
    expect(STEM_NAMES).toEqual(['vocals', 'drums', 'bass', 'other'])
  })

  it('covers every archetype × variation pair (24 total)', () => {
    const keys = listCatalogKeys()
    expect(keys).toHaveLength(24)
    for (const a of ARCHETYPES) {
      for (const v of a.variations) {
        const present = keys.some(k => k.archetypeId === a.id && k.variationId === v.id)
        expect(present, `${a.id}/${v.id} missing from catalog`).toBe(true)
      }
    }
  })

  it('returns all 4 stem URLs for a valid (archetype, variation) pair', () => {
    const stems = getStems('late-night-architect', 'lo-fi-piano-2010s')
    expect(stems).not.toBeNull()
    expect(Object.keys(stems).sort()).toEqual([...STEM_NAMES].sort())
    for (const name of STEM_NAMES) {
      expect(stems[name]).toMatch(/late-night-architect\/lo-fi-piano-2010s/)
      expect(stems[name]).toMatch(new RegExp(`/${name}\\.mp3$`))
    }
  })

  it('returns null for unknown archetype or variation', () => {
    expect(getStems('does-not-exist', 'whatever')).toBeNull()
    expect(getStems('late-night-architect', 'no-such-variation')).toBeNull()
  })

  it('archetype-only fallback resolves to the first variation', () => {
    const stems = getArchetypeStems('hearth-keeper')
    expect(stems).not.toBeNull()
    const firstVariationId = ARCHETYPES.find(a => a.id === 'hearth-keeper').variations[0].id
    expect(stems.drums).toContain(firstVariationId)
  })

  it('listAllStemPaths enumerates 96 entries (24 pairs × 4 stems)', () => {
    const paths = listAllStemPaths()
    expect(paths).toHaveLength(96)
    const stemCounts = {}
    for (const p of paths) stemCounts[p.stem] = (stemCounts[p.stem] || 0) + 1
    expect(stemCounts).toEqual({ vocals: 24, drums: 24, bass: 24, other: 24 })
  })
})
