import { describe, it, expect } from 'vitest'
import {
  timeOfDay,
  mockDateToIso,
  formatEntryDate,
  normalizeEntries,
  loadMockEntries,
} from '../entryFormat'

describe('timeOfDay', () => {
  it('buckets an hour into a part of the day', () => {
    expect(timeOfDay(8)).toBe('morning')
    expect(timeOfDay(14)).toBe('afternoon')
    expect(timeOfDay(19)).toBe('evening')
    expect(timeOfDay(23)).toBe('night')
    expect(timeOfDay(2)).toBe('night')
  })
})

describe('mockDateToIso / formatEntryDate', () => {
  it('round-trips every part of the day', () => {
    for (const s of [
      'may 21 · evening',
      'apr 02 · night',
      'mar 03 · morning',
      'jun 15 · afternoon',
    ]) {
      expect(formatEntryDate(mockDateToIso(s))).toBe(s)
    }
  })

  it('produces a valid UTC ISO timestamp in 2026', () => {
    expect(mockDateToIso('may 21 · evening')).toBe('2026-05-21T19:00:00.000Z')
  })
})

describe('normalizeEntries', () => {
  it('assigns seq (oldest=1, newest=n) and a display date', () => {
    const rows = [
      { id: 'b', created_at: '2026-05-21T19:00:00.000Z', summary: 'newer', song: null, glyph: null },
      { id: 'a', created_at: '2026-03-03T08:00:00.000Z', summary: 'older', song: null, glyph: null },
    ]
    const out = normalizeEntries(rows)
    expect(out[0]).toMatchObject({ id: 'b', seq: 2, date: 'may 21 · evening' })
    expect(out[1]).toMatchObject({ id: 'a', seq: 1, date: 'mar 03 · morning' })
  })
})

describe('loadMockEntries', () => {
  it('returns the 10 bundled mock entries, normalised, newest first', () => {
    const out = loadMockEntries()
    expect(out).toHaveLength(10)
    expect(out[0].seq).toBe(10)
    expect(out[9].seq).toBe(1)
    expect(out[0].date).toBe('may 21 · evening')
    expect(out[9].summary).toBe('where the record begins')
  })
})
