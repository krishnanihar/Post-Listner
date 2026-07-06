import { describe, it, expect } from 'vitest'
import {
  SCHEMA_VERSION, makeSessionId, buildSessionRecord,
  isFirstSessionFrom, recencySummaryFrom, yearTierFrom,
} from '../sessionRecord.js'

const DAY = 86400000

describe('sessionRecord — buildSessionRecord', () => {
  it('shapes a full record with schemaVersion and defaults', () => {
    const r = buildSessionRecord({
      startedAt: 1000, endedAt: 5000,
      finalVector: { a: 0.5, v: -0.2, d: 0.1 },
      avdTrajectory: [{ t: 0, a: 0, v: 0, d: 0 }, { t: 1000, a: 0.5, v: -0.2, d: 0.1 }],
      landing: { archetypeId: 'sky-seeker', variationId: 'x' },
      summary: 'a bright one', rand: 0.5,
    })
    expect(r.schemaVersion).toBe(SCHEMA_VERSION)
    expect(typeof r.id).toBe('string')
    expect(r.startedAt).toBe(1000)
    expect(r.endedAt).toBe(5000)
    expect(r.finalVector).toEqual({ a: 0.5, v: -0.2, d: 0.1 })
    expect(r.avdTrajectory).toHaveLength(2)
    expect(r.landing).toEqual({ archetypeId: 'sky-seeker', variationId: 'x', mode: 'catalog' })
    expect(r.summary).toBe('a bright one')
  })
  it('records the song-production mode (generated vs catalog default)', () => {
    const gen = buildSessionRecord({ startedAt: 1, landing: { archetypeId: 'sky-seeker', variationId: 'x', mode: 'generated' } })
    expect(gen.landing.mode).toBe('generated')
    const cat = buildSessionRecord({ startedAt: 1, landing: { archetypeId: 'sky-seeker', variationId: 'x' } })
    expect(cat.landing.mode).toBe('catalog')
  })
  it('clamps the final vector and tolerates missing fields', () => {
    const r = buildSessionRecord({ startedAt: 0, finalVector: { a: 9, v: -9, d: NaN } })
    expect(r.finalVector).toEqual({ a: 1, v: -1, d: 0 })
    expect(r.endedAt).toBe(0)
    expect(r.avdTrajectory).toEqual([])
    expect(r.landing).toBeNull()
    expect(r.summary).toBe('')
  })
  it('makeSessionId is stable for the same inputs', () => {
    expect(makeSessionId(1000, 0.5)).toBe(makeSessionId(1000, 0.5))
  })
})

describe('sessionRecord — derivations', () => {
  const rec = (startedAt) => ({ schemaVersion: 1, id: String(startedAt), startedAt, endedAt: startedAt, finalVector: { a: 0, v: 0, d: 0 }, avdTrajectory: [], landing: null, summary: '' })
  it('isFirstSessionFrom', () => {
    expect(isFirstSessionFrom([])).toBe(true)
    expect(isFirstSessionFrom([rec(0)])).toBe(false)
  })
  it('recencySummaryFrom buckets by age of the last record', () => {
    expect(recencySummaryFrom([], 0)).toBe('first time')
    expect(recencySummaryFrom([rec(0)], 17 * DAY)).toBe('a few weeks')
    expect(recencySummaryFrom([rec(0)], 0.5 * DAY)).toBe('today')
  })
  it('yearTierFrom is 3 only at >=24 records AND >=180 days since first', () => {
    const many = Array.from({ length: 24 }, () => rec(0))
    expect(yearTierFrom(many, 180 * DAY)).toBe(3)
    expect(yearTierFrom(many, 100 * DAY)).toBe(1)
    expect(yearTierFrom(Array.from({ length: 23 }, () => rec(0)), 200 * DAY)).toBe(1)
  })
})
