import { describe, it, expect } from 'vitest'
import {
  mirrorText, readingText, mirrorClipId, readingClipId, allClipIds, allLines,
  WORLD_KEYS, HANDOFF, FRAME,
} from '../reflectionScript.js'

describe('reflectionScript', () => {
  it('builds a grounded mirror sentence from the three axes', () => {
    expect(mirrorText('warm', 'inward', 'low')).toBe(
      'i was watching how you moved. you leaned toward warmth, and drew it close — near, not open. you kept it low, unhurried.'
    )
    expect(mirrorText('cold', 'open', 'high-rode')).toContain('colder light')
    expect(mirrorText('cold', 'open', 'high-rode')).toContain('met the peak')
    expect(mirrorText('warm', 'inward', 'low').startsWith(FRAME)).toBe(true)
  })

  it('appends the handoff to each world reading and never names the archetype', () => {
    const t = readingText('hearth-keeper')
    expect(t.endsWith(HANDOFF)).toBe(true)
    expect(t).toContain('sitting down beside you')
    for (const id of WORLD_KEYS) {
      // unnamed: the reading must not contain the archetype id slug
      expect(readingText(id).toLowerCase()).not.toContain(id)
    }
  })

  it('there are 6 world readings (one per archetype)', () => {
    expect(WORLD_KEYS).toHaveLength(6)
  })

  it('allClipIds + allLines cover 12 mirror + 6 reading = 18, ids match', () => {
    const ids = allClipIds()
    expect(ids).toHaveLength(18)
    expect(ids.filter((i) => i.startsWith('reflect-mirror-'))).toHaveLength(12)
    expect(ids.filter((i) => i.startsWith('reflect-reading-'))).toHaveLength(6)
    const lines = allLines()
    expect(Object.keys(lines).sort()).toEqual([...ids].sort())
    for (const id of ids) expect(typeof lines[id]).toBe('string')
  })

  it('clip ids are stable strings', () => {
    expect(mirrorClipId('warm', 'inward', 'low')).toBe('reflect-mirror-warm-inward-low')
    expect(readingClipId('sky-seeker')).toBe('reflect-reading-sky-seeker')
  })
})
