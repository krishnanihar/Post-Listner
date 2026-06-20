import { describe, it, expect } from 'vitest'
import { buildFirstMessage } from '../admirerFirstMessage.js'

describe('buildFirstMessage', () => {
  it('returns the first-session opening for a brand new user', () => {
    const msg = buildFirstMessage({
      isFirstSession: true,
      recencySummary: 'first time',
      timeOfDay: 'evening',
    })
    expect(msg).toMatch(/welcome/i)
    expect(msg).toMatch(/musician/i)
    // Gesture-only input: the opening invites a tap to begin, never speech.
    expect(msg).toMatch(/tap to begin/i)
    expect(msg).not.toMatch(/press and hold/i)
    expect(msg).not.toMatch(/speak/i)
    expect(msg.length).toBeGreaterThan(50)
  })

  it('returns a returning-user opening that does NOT promise slow pacing', () => {
    const msg = buildFirstMessage({
      isFirstSession: false,
      recencySummary: 'a few weeks',
      timeOfDay: 'late',
    })
    expect(msg).not.toMatch(/first time runs slow/i)
    expect(msg).not.toMatch(/welcome\b/i)
    expect(msg.length).toBeGreaterThan(0)
  })

  it('references the recency for returning users', () => {
    const msg = buildFirstMessage({
      isFirstSession: false,
      recencySummary: 'a few weeks',
      timeOfDay: 'evening',
    })
    expect(msg.toLowerCase()).toContain('a few weeks')
  })

  it('uses time-of-day flavour for late returns', () => {
    const msg = buildFirstMessage({
      isFirstSession: false,
      recencySummary: 'yesterday',
      timeOfDay: 'late',
    })
    expect(msg.toLowerCase()).toMatch(/late|tonight/)
  })

  it('handles a same-day return gracefully', () => {
    const msg = buildFirstMessage({
      isFirstSession: false,
      recencySummary: 'today',
      timeOfDay: 'afternoon',
    })
    expect(msg.length).toBeGreaterThan(0)
    expect(msg).not.toMatch(/first time runs slow/i)
  })

  it('falls back gracefully on unrecognised recency', () => {
    const msg = buildFirstMessage({
      isFirstSession: false,
      recencySummary: 'a millennium',
      timeOfDay: 'morning',
    })
    expect(msg.length).toBeGreaterThan(0)
  })
})
