import { describe, it, expect } from 'vitest'
import { mapRelayMessage } from '../motion.js'

describe('mapRelayMessage rotationRate', () => {
  it('extracts angular speed magnitude from rotationRate.mag', () => {
    const msg = {
      raw: { alpha: 0, beta: 0, gamma: 0 },
      rotationRate: { alpha: 0, beta: 30, gamma: 40, mag: 50 },
      calibrated: true,
    }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.angularSpeed).toBeCloseTo(50 / 360, 5)
  })

  it('falls back to 0 when rotationRate missing', () => {
    const msg = {
      raw: { alpha: 0, beta: 0, gamma: 0 },
      calibrated: true,
    }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.angularSpeed).toBe(0)
  })

  it('clamps angular speed at 1.0 for very fast rotations', () => {
    const msg = {
      raw: { alpha: 0, beta: 0, gamma: 0 },
      rotationRate: { mag: 720 },
      calibrated: true,
    }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.angularSpeed).toBe(1)
  })
})

describe('mapRelayMessage accel vector', () => {
  it('passes through accel x/y/z normalized against 10 m/s^2', () => {
    const msg = {
      raw: { alpha: 0, beta: 0, gamma: 0 },
      accel: { x: 5, y: -3, z: 0 },
      calibrated: true,
    }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.accel.x).toBeCloseTo(0.5, 5)
    expect(out.controls.accel.y).toBeCloseTo(-0.3, 5)
    expect(out.controls.accel.z).toBe(0)
  })

  it('defaults accel to zeros when missing', () => {
    const msg = { raw: { alpha: 0, beta: 0, gamma: 0 }, calibrated: true }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.accel).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('clamps accel components to ±1', () => {
    const msg = {
      raw: { alpha: 0, beta: 0, gamma: 0 },
      accel: { x: 50, y: -50, z: 50 },
      calibrated: true,
    }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.accel.x).toBe(1)
    expect(out.controls.accel.y).toBe(-1)
    expect(out.controls.accel.z).toBe(1)
  })
})
