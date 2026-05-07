import { describe, it, expect } from 'vitest'
import { GEMS_TAGS, gemsExcerptsToAvdNudge, dominantGemsTag } from '../gemsTags'

describe('GEMS_TAGS', () => {
  it('has exactly 6 tiles', () => {
    expect(GEMS_TAGS).toHaveLength(6)
  })

  it('includes the canonical GEMS-9 + Cowen-13 union', () => {
    const ids = GEMS_TAGS.map(t => t.id)
    expect(ids).toContain('nostalgic')
    expect(ids).toContain('awed')
    expect(ids).toContain('tender')
    expect(ids).toContain('melancholic')
    expect(ids).toContain('defiant')
    expect(ids).toContain('peaceful')
  })

  it('each tile has id, label, and avdNudge with a/v/d numeric fields', () => {
    for (const tag of GEMS_TAGS) {
      expect(typeof tag.id).toBe('string')
      expect(typeof tag.label).toBe('string')
      expect(typeof tag.avdNudge.a).toBe('number')
      expect(typeof tag.avdNudge.v).toBe('number')
      expect(typeof tag.avdNudge.d).toBe('number')
    }
  })
})

describe('gemsExcerptsToAvdNudge', () => {
  it('returns zero nudge for empty excerpts', () => {
    expect(gemsExcerptsToAvdNudge([])).toEqual({ a: 0, v: 0, d: 0 })
  })

  it('sums nudges across excerpts and selected tiles', () => {
    const excerpts = [
      { id: 'sublimity', tilesSelected: ['awed', 'peaceful'] },
      { id: 'tenderness', tilesSelected: ['tender', 'nostalgic'] },
    ]
    const nudge = gemsExcerptsToAvdNudge(excerpts)
    expect(typeof nudge.a).toBe('number')
    expect(typeof nudge.v).toBe('number')
    expect(typeof nudge.d).toBe('number')
  })

  it('ignores unknown tile ids', () => {
    const excerpts = [{ id: 'x', tilesSelected: ['unknown', 'awed'] }]
    const nudge = gemsExcerptsToAvdNudge(excerpts)
    // Should still produce a non-zero nudge from "awed".
    expect(Math.abs(nudge.v) + Math.abs(nudge.a) + Math.abs(nudge.d)).toBeGreaterThan(0)
  })

  it('clamps total nudge to a reasonable range (≤0.3 magnitude per axis)', () => {
    // Three excerpts × all 6 tiles selected = max stack
    const excerpts = [
      { id: 'a', tilesSelected: ['nostalgic', 'awed', 'tender', 'melancholic', 'defiant', 'peaceful'] },
      { id: 'b', tilesSelected: ['nostalgic', 'awed', 'tender', 'melancholic', 'defiant', 'peaceful'] },
      { id: 'c', tilesSelected: ['nostalgic', 'awed', 'tender', 'melancholic', 'defiant', 'peaceful'] },
    ]
    const nudge = gemsExcerptsToAvdNudge(excerpts)
    expect(Math.abs(nudge.a)).toBeLessThanOrEqual(0.3)
    expect(Math.abs(nudge.v)).toBeLessThanOrEqual(0.3)
    expect(Math.abs(nudge.d)).toBeLessThanOrEqual(0.3)
  })
})

describe('dominantGemsTag', () => {
  it('returns null for empty excerpts', () => {
    expect(dominantGemsTag([])).toBeNull()
  })

  it('returns the most frequently selected tile across excerpts', () => {
    const excerpts = [
      { id: 'a', tilesSelected: ['nostalgic', 'awed'] },
      { id: 'b', tilesSelected: ['nostalgic'] },
      { id: 'c', tilesSelected: ['tender'] },
    ]
    expect(dominantGemsTag(excerpts)).toBe('nostalgic')
  })
})
