import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prefersReducedMotion } from '../reducedMotion.js'

function mockMatchMedia(matches) {
  return vi.fn((query) => ({
    matches: query.includes('reduce') ? matches : !matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('prefersReducedMotion', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('is true when the reduce-motion query matches', () => {
    window.matchMedia = mockMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
  })
  it('is false when the query does not match', () => {
    window.matchMedia = mockMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })
  it('is false when matchMedia is unavailable', () => {
    const orig = window.matchMedia
    window.matchMedia = undefined
    expect(prefersReducedMotion()).toBe(false)
    window.matchMedia = orig
  })
})
