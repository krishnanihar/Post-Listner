import { describe, it, expect } from 'vitest'
import { sceneForPhase } from '../phaseScenes.js'

describe('phaseScenes', () => {
  it('returns a scene partial for each known phase', () => {
    for (const phase of ['entry', 'admirer', 'orchestra', 'settle']) {
      const s = sceneForPhase(phase)
      expect(s).toHaveProperty('pool')
      expect(s).toHaveProperty('warmth')
      expect(s).toHaveProperty('breadth')
    }
  })
  it('orchestra starts intimate (bloom opens it later)', () => {
    expect(sceneForPhase('orchestra').breadth).toBeLessThan(0.2)
  })
  it('falls back to the entry scene for an unknown phase', () => {
    expect(sceneForPhase('nope')).toEqual(sceneForPhase('entry'))
  })
})
