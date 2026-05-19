import { describe, it, expect } from 'vitest'
import { FRAGMENTS, getFragment, listFragmentIds } from '../fragmentBank'

describe('fragmentBank', () => {
  it('exports at least 8 fragments', () => {
    expect(FRAGMENTS.length).toBeGreaterThanOrEqual(8)
  })

  it('every fragment has id, url, descriptors', () => {
    for (const f of FRAGMENTS) {
      expect(f.id).toBeTruthy()
      expect(typeof f.url).toBe('string')
      expect(f.url.length).toBeGreaterThan(0)
      expect(f.descriptors).toBeTruthy()
      expect(typeof f.descriptors.tempo).toBe('string')
      expect(typeof f.descriptors.mood).toBe('string')
    }
  })

  it('getFragment returns the matching fragment by id', () => {
    const f = getFragment(FRAGMENTS[0].id)
    expect(f).toEqual(FRAGMENTS[0])
  })

  it('getFragment returns null for unknown id', () => {
    expect(getFragment('not-a-fragment')).toBeNull()
  })

  it('listFragmentIds returns every fragment id', () => {
    expect(listFragmentIds()).toEqual(FRAGMENTS.map(f => f.id))
  })

  it('fragment ids are unique', () => {
    const ids = FRAGMENTS.map(f => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
