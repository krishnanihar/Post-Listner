import { describe, it, expect } from 'vitest'
import { INTIMATE, EXPANDED, roomAt, easeExpansion, lerp } from '../roomPresets.js'

describe('roomPresets', () => {
  it('lerp interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0)
    expect(lerp(0, 10, 1)).toBe(10)
    expect(lerp(0, 10, 0.5)).toBe(5)
  })

  it('easeExpansion clamps out-of-range input to [0,1]', () => {
    expect(easeExpansion(-1)).toBe(0)
    expect(easeExpansion(2)).toBe(1)
  })

  it('easeExpansion is a smoothstep (0->0, 1->1, 0.5->0.5)', () => {
    expect(easeExpansion(0)).toBe(0)
    expect(easeExpansion(1)).toBe(1)
    expect(easeExpansion(0.5)).toBeCloseTo(0.5, 5)
  })

  it('roomAt(0) equals the INTIMATE preset', () => {
    expect(roomAt(0)).toEqual(INTIMATE)
  })

  it('roomAt(1) equals the EXPANDED preset', () => {
    expect(roomAt(1)).toEqual(EXPANDED)
  })

  it('roomAt(0.5) sits strictly between the two presets', () => {
    const mid = roomAt(0.5)
    expect(mid.reverbWet).toBeGreaterThan(INTIMATE.reverbWet)
    expect(mid.reverbWet).toBeLessThan(EXPANDED.reverbWet)
    expect(mid.reflectionDelayScale).toBeGreaterThan(INTIMATE.reflectionDelayScale)
    expect(mid.reflectionDelayScale).toBeLessThan(EXPANDED.reflectionDelayScale)
  })
})
