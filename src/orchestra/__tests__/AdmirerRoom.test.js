import { describe, it, expect } from 'vitest'
import { rollToAzimuthOffset, MAX_AZIMUTH_OFFSET_DEG } from '../AdmirerRoom.js'

describe('rollToAzimuthOffset', () => {
  it('returns 0 at neutral roll', () => {
    expect(rollToAzimuthOffset(0)).toBe(0)
  })

  it('returns 0 inside the deadzone', () => {
    expect(rollToAzimuthOffset(3)).toBe(0)
    expect(rollToAzimuthOffset(-3)).toBe(0)
  })

  it('reaches the max offset at full roll', () => {
    expect(rollToAzimuthOffset(90)).toBeCloseTo(MAX_AZIMUTH_OFFSET_DEG, 5)
    expect(rollToAzimuthOffset(-90)).toBeCloseTo(-MAX_AZIMUTH_OFFSET_DEG, 5)
  })

  it('clamps roll beyond ±90°', () => {
    expect(rollToAzimuthOffset(180)).toBeCloseTo(MAX_AZIMUTH_OFFSET_DEG, 5)
    expect(rollToAzimuthOffset(-180)).toBeCloseTo(-MAX_AZIMUTH_OFFSET_DEG, 5)
  })

  it('is signed and strictly between 0 and the max in the active range', () => {
    expect(rollToAzimuthOffset(45)).toBeGreaterThan(0)
    expect(rollToAzimuthOffset(45)).toBeLessThan(MAX_AZIMUTH_OFFSET_DEG)
    expect(rollToAzimuthOffset(-45)).toBeLessThan(0)
    expect(rollToAzimuthOffset(-45)).toBeGreaterThan(-MAX_AZIMUTH_OFFSET_DEG)
  })

  it('treats null and NaN as 0', () => {
    expect(rollToAzimuthOffset(null)).toBe(0)
    expect(rollToAzimuthOffset(undefined)).toBe(0)
    expect(rollToAzimuthOffset(NaN)).toBe(0)
  })
})
