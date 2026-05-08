import { describe, it, expect } from 'vitest'
import { hashText } from '../textHash'

describe('hashText', () => {
  it('returns an 8-character hex string', () => {
    const h = hashText('hello world')
    expect(h).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is deterministic — same input yields same hash', () => {
    expect(hashText('foo')).toBe(hashText('foo'))
  })

  it('different inputs yield different hashes', () => {
    expect(hashText('foo')).not.toBe(hashText('bar'))
  })

  it('handles empty string', () => {
    expect(hashText('')).toMatch(/^[0-9a-f]{8}$/)
  })

  it('handles unicode', () => {
    expect(hashText('— em dash 你好')).toMatch(/^[0-9a-f]{8}$/)
  })
})
