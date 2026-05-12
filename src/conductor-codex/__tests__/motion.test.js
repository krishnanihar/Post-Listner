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
