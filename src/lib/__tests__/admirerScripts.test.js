import { describe, it, expect } from 'vitest'
import { ADMIRER_LINES } from '../admirerScripts'

describe('ADMIRER_LINES', () => {
  it('has entries for every phase that needs voice', () => {
    const phases = ['entry', 'spectrum', 'depth', 'gems', 'moment', 'autobio', 'reflection']
    for (const p of phases) {
      expect(ADMIRER_LINES[p]).toBeTruthy()
      expect(typeof ADMIRER_LINES[p]).toBe('object')
    }
  })

  it('every line has text and register', () => {
    for (const phase of Object.keys(ADMIRER_LINES)) {
      const lines = ADMIRER_LINES[phase]
      for (const key of Object.keys(lines)) {
        const entry = lines[key]
        expect(typeof entry.text).toBe('string')
        expect(entry.text.length).toBeGreaterThan(2)
        expect(['caretaking', 'present', 'elevated']).toContain(entry.register)
      }
    }
  })

  it('entry has the threshold statement', () => {
    expect(ADMIRER_LINES.entry.threshold.text.toLowerCase()).toContain('inbox')
  })
})
