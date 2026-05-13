import { describe, it, expect } from 'vitest'
import { generateSessionId, isValidSessionId } from '../sessionId.js'

describe('generateSessionId', () => {
  it('returns an 8-character string', () => {
    const id = generateSessionId()
    expect(id).toMatch(/^[0-9A-HJ-NP-TV-Z]{8}$/)
  })

  it('returns a different value on each call', () => {
    const a = generateSessionId()
    const b = generateSessionId()
    expect(a).not.toBe(b)
  })

  it('uses Crockford base32 (no I, L, O, U)', () => {
    // Generate 100 IDs; collectively should never contain those chars
    const ids = Array.from({ length: 100 }, generateSessionId).join('')
    expect(ids).not.toMatch(/[ILOU]/)
  })
})

describe('isValidSessionId', () => {
  it('accepts a valid 8-char Crockford base32 string', () => {
    expect(isValidSessionId('ABCD1234')).toBe(true)
    expect(isValidSessionId('XYZ0PQRS')).toBe(true)
  })

  it('rejects wrong length', () => {
    expect(isValidSessionId('ABC')).toBe(false)
    expect(isValidSessionId('ABCDEFGHI')).toBe(false)
    expect(isValidSessionId('')).toBe(false)
  })

  it('rejects ambiguous chars (I L O U)', () => {
    expect(isValidSessionId('ABCDIFGH')).toBe(false)  // I
    expect(isValidSessionId('ABCDLFGH')).toBe(false)  // L
    expect(isValidSessionId('ABCDOFGH')).toBe(false)  // O
    expect(isValidSessionId('ABCDUFGH')).toBe(false)  // U
  })

  it('rejects lowercase', () => {
    expect(isValidSessionId('abcd1234')).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(isValidSessionId(null)).toBe(false)
    expect(isValidSessionId(undefined)).toBe(false)
    expect(isValidSessionId(12345678)).toBe(false)
  })
})
