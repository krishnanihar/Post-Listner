import { describe, it, expect } from 'vitest'
import { inkForPhase } from '../phaseTheme.js'

describe('inkForPhase', () => {
  it('returns the dark ink for the entry phase', () => {
    expect(inkForPhase('entry')).toBe('#1C1814')
  })

  it('returns the dark ink for the admirer phase (cream paper)', () => {
    expect(inkForPhase('admirer')).toBe('#1C1814')
  })

  it('returns the light cream ink for the orchestra phase (dark bg)', () => {
    expect(inkForPhase('orchestra')).toBe('#E8E4DD')
  })

  it('returns the dark ink for the settle phase', () => {
    expect(inkForPhase('settle')).toBe('#1C1814')
  })

  it('falls back to the dark ink for an unknown phase', () => {
    expect(inkForPhase('unknown-phase')).toBe('#1C1814')
  })
})
