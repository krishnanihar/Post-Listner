import { describe, it, expect, beforeEach } from 'vitest'
import {
  getIsFirstSession,
  getLexicon,
  addLexicon,
  getRestricted,
  addRestricted,
  getRecencySummary,
  appendEntry,
  getEntries,
  buildDynamicVariables,
  clearAll,
  getYearTier,
} from '../sessionStore'

describe('sessionStore', () => {
  beforeEach(() => {
    clearAll()
    localStorage.clear()
  })

  it('reports first session when no entries exist', () => {
    expect(getIsFirstSession()).toBe(true)
  })

  it('reports not-first-session after one entry is appended', () => {
    appendEntry({ summary: 'first one', ts: Date.now() })
    expect(getIsFirstSession()).toBe(false)
    expect(getEntries()).toHaveLength(1)
  })

  it('round-trips lexicon adds', () => {
    addLexicon('qawwali', 'my dad\'s qawwali tapes')
    expect(getLexicon()).toEqual({ qawwali: "my dad's qawwali tapes" })
  })

  it('round-trips restricted adds and dedupes', () => {
    addRestricted('liturgical hymns')
    addRestricted('liturgical hymns')
    expect(getRestricted()).toEqual(['liturgical hymns'])
  })

  it('produces "first time" recency for an empty store', () => {
    expect(getRecencySummary()).toBe('first time')
  })

  it('produces "a few weeks" recency for a 17-day-old entry', () => {
    const seventeenDaysAgo = Date.now() - 17 * 86400000
    appendEntry({ summary: 'old one', ts: seventeenDaysAgo })
    expect(getRecencySummary()).toBe('a few weeks')
  })

  it('buildDynamicVariables returns a flat object the SDK can pass through', () => {
    addLexicon('Carnatic', 'Carnatic')
    addRestricted('temple bhajans')
    const vars = buildDynamicVariables()
    expect(vars.is_first_session).toBe(true)
    expect(vars.recency_summary).toBe('first time')
    expect(vars.restricted_repertoires).toContain('temple bhajans')
    expect(typeof vars.time_of_day).toBe('string')
    expect(vars.prior_lexicon).toContain('Carnatic')
  })

  describe('getYearTier', () => {
    it('is tier 1 with fewer than 24 entries', () => {
      for (let i = 0; i < 23; i++) appendEntry({ summary: 's', ts: 0 })
      expect(getYearTier(200 * 86400000)).toBe(1)
    })
    it('is tier 1 with 24+ entries but under 180 days', () => {
      for (let i = 0; i < 24; i++) appendEntry({ summary: 's', ts: 0 })
      expect(getYearTier(100 * 86400000)).toBe(1)
    })
    it('is tier 3 with 24+ entries and 180+ days since the first', () => {
      for (let i = 0; i < 24; i++) appendEntry({ summary: 's', ts: 0 })
      expect(getYearTier(180 * 86400000)).toBe(3)
    })
  })
})
