import { describe, it, expect } from 'vitest'
import { MOCK_COLLECTIVE, buildMockCollective } from '../mockCollective.js'

describe('mockCollective', () => {
  it('is deterministic — two builds are identical', () => {
    expect(buildMockCollective()).toEqual(buildMockCollective())
  })
  it('MOCK_COLLECTIVE holds a few hundred points', () => {
    expect(MOCK_COLLECTIVE.length).toBeGreaterThan(400)
    expect(MOCK_COLLECTIVE.length).toBeLessThan(800)
  })
  it('every point is a valid lat/lng', () => {
    for (const p of MOCK_COLLECTIVE) {
      expect(p.lat).toBeGreaterThanOrEqual(-90)
      expect(p.lat).toBeLessThanOrEqual(90)
      expect(p.lng).toBeGreaterThanOrEqual(-180)
      expect(p.lng).toBeLessThan(180)
    }
  })
})
