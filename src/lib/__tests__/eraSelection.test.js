import { describe, it, expect, beforeEach } from 'vitest'
import { setEra, getEra, resetEra } from '../eraSelection.js'

describe('eraSelection', () => {
  beforeEach(() => resetEra())

  it('starts null and captures a year', () => {
    expect(getEra()).toBe(null)
    setEra(1985)
    expect(getEra()).toBe(1985)
  })

  it('reset clears it', () => {
    setEra(2014)
    resetEra()
    expect(getEra()).toBe(null)
  })

  it('ignores non-finite / non-number years', () => {
    setEra(null)
    expect(getEra()).toBe(null)
    setEra(undefined)
    expect(getEra()).toBe(null)
    setEra(NaN)
    expect(getEra()).toBe(null)
    setEra('1999')
    expect(getEra()).toBe(null)
  })
})
