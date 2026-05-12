import { describe, it, expect } from 'vitest'
import { bandAverage, detectBassBeat } from '../audioBands.js'

describe('bandAverage', () => {
  it('averages a slice of bins and normalizes to 0..1 against 255', () => {
    const data = new Uint8Array([128, 128, 128, 128, 128, 128, 128, 128])
    const v = bandAverage(data, 0, 7)
    expect(v).toBeCloseTo(128 / 255, 5)
  })

  it('returns 0 when the slice is empty (startBin > endBin)', () => {
    const data = new Uint8Array([100, 200])
    expect(bandAverage(data, 5, 2)).toBe(0)
  })

  it('clamps endBin against array length', () => {
    const data = new Uint8Array([255, 255, 255])
    const v = bandAverage(data, 0, 10)
    expect(v).toBeCloseTo(1.0, 5)
  })
})

describe('detectBassBeat', () => {
  it('fires when bass crosses up over threshold after refractory', () => {
    const result = detectBassBeat(0.7, 0.3, 0.5, 0, 1000)
    expect(result.fired).toBe(true)
    expect(result.nextRefractoryEnd).toBe(1250)
  })

  it('does not fire when bass stays below threshold', () => {
    const result = detectBassBeat(0.4, 0.3, 0.5, 0, 1000)
    expect(result.fired).toBe(false)
    expect(result.nextRefractoryEnd).toBe(0)
  })

  it('does not fire during refractory window', () => {
    const result = detectBassBeat(0.7, 0.3, 0.5, 999999, 1000)
    expect(result.fired).toBe(false)
    expect(result.nextRefractoryEnd).toBe(999999)
  })

  it('does not fire if previous bass was already above threshold (no edge)', () => {
    const result = detectBassBeat(0.7, 0.6, 0.5, 0, 1000)
    expect(result.fired).toBe(false)
  })
})
