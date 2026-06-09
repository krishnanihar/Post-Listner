// src/lib/__tests__/seedSelection.test.js
import { describe, it, expect } from 'vitest'
import { selectNextSeed } from '../seedSelection.js'

const N = { a: 0, v: 0, d: 0 }
const DECK = [
  { id: 'b1', kind: 'biography', sessionScope: 'first', tier: 1, gain: 0.3, probes: null, intent: N, text: 'b1' },
  { id: 'b2', kind: 'biography', sessionScope: 'first', tier: 1, gain: 0.3, probes: null, intent: N, text: 'b2' },
  { id: 'arrival', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.3, probes: null, intent: N, text: 'arrival' },
  { id: 'ar', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'A', intent: N, text: 'ar' },
  { id: 'va', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'V', intent: N, text: 'va' },
  { id: 'de', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'D', intent: N, text: 'de' },
  { id: 'y3', kind: 'locate', sessionScope: 'always', tier: 3, gain: 0.8, probes: 'V', intent: N, text: 'y3' },
  { id: 'close', kind: 'closing', sessionScope: 'always', tier: 1, gain: 0, probes: null, intent: N, text: 'close' },
]
const base = { vector: N, deck: DECK, yearTier: 1 }

describe('seedSelection — selectNextSeed', () => {
  it('first session: biography seeds come first, in deck order', () => {
    const s = selectNextSeed({ ...base, sessionCount: 0, askedIds: [] })
    expect(s.id).toBe('b1')
    const s2 = selectNextSeed({ ...base, sessionCount: 0, askedIds: ['b1'] })
    expect(s2.id).toBe('b2')
  })

  it('returning session: skips biography, asks arrival first', () => {
    const s = selectNextSeed({ ...base, sessionCount: 3, askedIds: [] })
    expect(s.id).toBe('arrival')
  })

  it('after arrival, picks the least-resolved probed axis', () => {
    // vector: A resolved (0.8), V unresolved (0.0), D mid (0.3) → expect V seed
    const s = selectNextSeed({
      ...base, sessionCount: 3, askedIds: ['arrival'],
      vector: { a: 0.8, v: 0.0, d: 0.3 },
    })
    expect(s.id).toBe('va')
  })

  it('excludes already-asked seeds', () => {
    const s = selectNextSeed({
      ...base, sessionCount: 3, askedIds: ['arrival', 'va'],
      vector: { a: 0.0, v: 0.9, d: 0.3 },
    })
    expect(s.id).toBe('ar') // A is now least-resolved among remaining
  })

  it('never returns the closing seed', () => {
    const asked = ['arrival', 'ar', 'va', 'de']
    const s = selectNextSeed({ ...base, sessionCount: 3, askedIds: asked })
    expect(s).toBeNull() // budget exhausted, and closing is never returned
  })

  it('gates tier-3 seeds behind yearTier', () => {
    // Exhaust tier-1 locate budget is 3; check eligibility directly with a fresh deck
    const tier3only = [DECK[6]] // y3
    expect(selectNextSeed({ vector: N, deck: tier3only, sessionCount: 3, askedIds: [], yearTier: 1 })).toBeNull()
    expect(selectNextSeed({ vector: N, deck: tier3only, sessionCount: 3, askedIds: [], yearTier: 3 }).id).toBe('y3')
  })

  it('returns null once the per-session locate budget is spent', () => {
    const s = selectNextSeed({ ...base, sessionCount: 3, askedIds: ['arrival', 'ar', 'va'] })
    expect(s).toBeNull()
  })
})
