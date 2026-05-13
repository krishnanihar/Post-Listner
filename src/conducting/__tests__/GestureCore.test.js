import { describe, it, expect } from 'vitest'
import {
  createState, processMotion, processOrientation, calibrate, read,
} from '../GestureCore.js'
import { LEGACY_PARAMS } from '../constants.js'

const PARAMS = LEGACY_PARAMS

function makeMotion({ ax = 0, ay = 0, az = 0,
                      rotAlpha = 0, rotBeta = 0, rotGamma = 0,
                      gravity = false } = {}) {
  return gravity
    ? { acceleration: null, accelerationIncludingGravity: { x: ax, y: ay, z: az },
        rotationRate: { alpha: rotAlpha, beta: rotBeta, gamma: rotGamma } }
    : { acceleration: { x: ax, y: ay, z: az },
        accelerationIncludingGravity: { x: ax, y: ay, z: az - 9.8 },
        rotationRate: { alpha: rotAlpha, beta: rotBeta, gamma: rotGamma } }
}

describe('GestureCore — downbeat detection (LEGACY)', () => {
  it('fires when peak-Y exceeds 2.0 m/s² and prev<0, curr≥0', () => {
    const s = createState({ params: PARAMS })
    // Feed a downward swing followed by zero-crossing
    processMotion(s, makeMotion({ ay: -3.0 }), 0)
    processMotion(s, makeMotion({ ay: -1.5 }), 16)
    processMotion(s, makeMotion({ ay:  0.1 }), 32)  // zero-crossing
    const snap = read(s, 32)
    expect(snap.downbeat.fired).toBe(true)
    expect(snap.downbeat.intensity).toBeGreaterThan(0)
  })

  it('does NOT fire when peak-Y is below 2.0', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ay: -1.5 }), 0)
    processMotion(s, makeMotion({ ay:  0.1 }), 16)
    expect(read(s, 16).downbeat.fired).toBe(false)
  })

  it('enforces 250 ms refractory', () => {
    const s = createState({ params: PARAMS })
    // First downbeat
    processMotion(s, makeMotion({ ay: -3.0 }), 0)
    processMotion(s, makeMotion({ ay:  0.1 }), 16)
    expect(read(s, 16).downbeat.fired).toBe(true)
    // Second qualifying motion 100ms later — must be suppressed
    processMotion(s, makeMotion({ ay: -3.0 }), 100)
    processMotion(s, makeMotion({ ay:  0.1 }), 116)
    expect(read(s, 116).downbeat.fired).toBe(false)
    // Third one ≥250 ms after the first — must fire
    processMotion(s, makeMotion({ ay: -3.0 }), 260)
    processMotion(s, makeMotion({ ay:  0.1 }), 276)
    expect(read(s, 276).downbeat.fired).toBe(true)
  })

  it('consumes the downbeat flag — re-reading without new motion returns fired=false', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ay: -3.0 }), 0)
    processMotion(s, makeMotion({ ay:  0.1 }), 16)
    expect(read(s, 16).downbeat.fired).toBe(true)
    expect(read(s, 17).downbeat.fired).toBe(false)
  })

  it('downbeat snapshot includes detection timestamp (Codex risk: event ordering)', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ay: -3.0 }), 100)
    processMotion(s, makeMotion({ ay:  0.1 }), 116)
    const snap = read(s, 200)  // read long after detection
    expect(snap.downbeat.fired).toBe(true)
    expect(snap.downbeat.detectedAt).toBe(116)
  })
})

describe('GestureCore — gesture size (LEGACY)', () => {
  it('returns 0 with no motion', () => {
    const s = createState({ params: PARAMS })
    expect(read(s, 0).gestureGain).toBe(0)
  })

  it('saturates at GESTURE_SIZE_RANGE (5.0 m/s²) peak-to-peak', () => {
    const s = createState({ params: PARAMS })
    // Build a 0 → 5 m/s² peak-to-peak over 200ms (well inside the 2s window)
    for (let i = 0; i < 12; i++) {
      const ax = i % 2 === 0 ? 2.5 : -2.5  // ±2.5 → mag 2.5 each
      processMotion(s, makeMotion({ ax }), i * 16)
    }
    expect(read(s, 200).gestureGain).toBeCloseTo(1.0, 1)
  })
})

describe('GestureCore — articulation (LEGACY)', () => {
  it('is non-zero when |rms - prevRms| changes rapidly', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ax: 0 }), 0)
    processMotion(s, makeMotion({ ax: 5 }), 16)  // big jerk
    expect(read(s, 16).articulation).toBeGreaterThan(0)
  })
})

describe('GestureCore — exposed rich signals', () => {
  it('snapshot includes yaw (from alpha), rotationRate, per-axis accel', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ax: 1.1, ay: 2.2, az: 3.3,
                                  rotAlpha: 10, rotBeta: 20, rotGamma: 30 }), 0)
    processOrientation(s, { alpha: 45, beta: 30, gamma: -15 }, 0)
    const snap = read(s, 0)
    expect(snap.accel.x).toBeCloseTo(1.1)
    expect(snap.accel.y).toBeCloseTo(2.2)
    expect(snap.accel.z).toBeCloseTo(3.3)
    expect(snap.rotationRate.mag).toBeCloseTo(Math.hypot(10, 20, 30))
    expect(snap.yaw).toBeCloseTo(45)
  })

  it('reports gravityBiased=true when only accelerationIncludingGravity is available', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ax: 0, ay: 0, az: 9.8, gravity: true }), 0)
    expect(read(s, 0).gravityBiased).toBe(true)
  })
})

describe('GestureCore — calibration', () => {
  it('baselines beta/gamma from samples collected since last calibrate()', () => {
    const s = createState({ params: PARAMS })
    processOrientation(s, { alpha: 0, beta: 70, gamma: -3 }, 0)
    processOrientation(s, { alpha: 0, beta: 80, gamma:  3 }, 16)
    calibrate(s)
    const snap = read(s, 16)
    expect(snap.baselineBeta).toBeCloseTo(75, 0)
    expect(snap.baselineGamma).toBeCloseTo(0, 0)
  })
})
