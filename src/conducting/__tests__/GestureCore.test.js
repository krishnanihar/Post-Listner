import { describe, it, expect } from 'vitest'
import {
  createState, processMotion, processOrientation, calibrate, read,
} from '../GestureCore.js'
import { LEGACY_PARAMS, RESEARCH_PARAMS } from '../constants.js'

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
    // Alternate between zero motion and 5 m/s² single-axis motion so the
    // RMS sliding window sees peak=5.0 and trough=0, giving peak-to-peak=5.0
    // which saturates gestureGain at 1.0.
    for (let i = 0; i < 12; i++) {
      const ax = i % 2 === 0 ? 5.0 : 0
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

describe('GestureCore — RESEARCH params (validate higher thresholds)', () => {
  it('does NOT fire downbeat at 3.5 m/s² (between legacy 2.0 and research 4.0)', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    processMotion(s, makeMotion({ ay: -3.5 }), 0)
    processMotion(s, makeMotion({ ay:  0.1 }), 16)
    expect(read(s, 16).downbeat.fired).toBe(false)
  })

  it('fires downbeat at 4.5 m/s²', () => {
    // The 1€ accel filter (mincutoff=0.5 Hz, alpha≈0.048 at 16ms) requires
    // ~14+ positive frames to cross zero from a negative steady state.
    // We prime with 5 frames at -4.5, then send 20 frames at +5.0. The
    // pendingDownbeat is set when the filtered ay crosses zero (frame ~14).
    const s = createState({ params: RESEARCH_PARAMS })
    for (let i = 0; i < 5; i++) {
      processMotion(s, makeMotion({ ay: -4.5 }), i * 16)
    }
    let fired = false
    for (let i = 0; i < 20; i++) {
      processMotion(s, makeMotion({ ay: 5.0 }), (5 + i) * 16)
      const snap = read(s, (5 + i) * 16)
      if (snap.downbeat.fired) { fired = true; break }
    }
    expect(fired).toBe(true)
  })

  it('enforces 300 ms refractory (suppresses second downbeat at 200ms)', () => {
    // The 1€ accel filter with mincutoff=0.5 Hz takes hundreds of ms to
    // converge, making it physically impossible to produce two threshold-meeting
    // crossings within 300ms using sustained steady-state inputs. We therefore
    // test the 300ms refractory directly by using a params variant that keeps
    // RESEARCH_PARAMS's DOWNBEAT_MIN_INTERVAL_MS=300 but disables the accel
    // filter (like LEGACY), so raw crossings hit the yBuffer at full magnitude.
    const researchRefractoryParams = {
      ...RESEARCH_PARAMS,
      ONE_EURO_ACCEL: null,      // raw accel so crossings are predictable
    }
    const s = createState({ params: researchRefractoryParams })

    // First downbeat — drive negative then cross zero
    processMotion(s, makeMotion({ ay: -5.0 }), 0)
    processMotion(s, makeMotion({ ay:  0.1 }), 16)
    const snap1 = read(s, 16)
    expect(snap1.downbeat.fired).toBe(true)
    const t1 = snap1.downbeat.detectedAt

    // Second crossing at t1+200ms — within 300ms refractory, must not fire
    processMotion(s, makeMotion({ ay: -5.0 }), t1 + 180)
    processMotion(s, makeMotion({ ay:  0.1 }), t1 + 200)
    const snap2 = read(s, t1 + 200)
    expect(snap2.downbeat.fired).toBe(false)

    // Third crossing at t1+310ms — past 300ms refractory, must fire
    processMotion(s, makeMotion({ ay: -5.0 }), t1 + 290)
    processMotion(s, makeMotion({ ay:  0.1 }), t1 + 310)
    const snap3 = read(s, t1 + 310)
    expect(snap3.downbeat.fired).toBe(true)
  })

  it('1€ filter is active on orientation streams', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    // Feed a jittery beta around 30°
    for (let i = 0; i < 30; i++) {
      const noisy = 30 + ((i % 3 === 0) ? 1.5 : -1.5)
      processOrientation(s, { alpha: 0, beta: noisy, gamma: 0 }, i * 16)
    }
    const snap = read(s, 30 * 16)
    // Filtered beta should be much closer to 30 than ±1.5 raw noise
    expect(snap.beta).toBeGreaterThan(28.5)
    expect(snap.beta).toBeLessThan(31.5)
  })

  it('handles alpha wraparound — feeding 358°→2° does not destroy filter state', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    processOrientation(s, { alpha: 358, beta: 0, gamma: 0 }, 0)
    processOrientation(s, { alpha: 1,   beta: 0, gamma: 0 }, 16)
    processOrientation(s, { alpha: 4,   beta: 0, gamma: 0 }, 32)
    const snap = read(s, 32)
    // Filtered alpha should be in the 0–10° range, NOT 180° from a spurious
    // -357° derivative spike.
    const a = snap.yaw
    const wrappedDistance = Math.min(a, 360 - a)
    expect(wrappedDistance).toBeLessThan(10)
  })

  it('calibrate() resets 1€ filter state — Codex risk #3', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    for (let i = 0; i < 30; i++) {
      processOrientation(s, { alpha: 0, beta: 30, gamma: 0 }, i * 16)
    }
    calibrate(s)
    // After reset + a new sample at 90°, the filter should treat it as the
    // first sample (passthrough), not blend it with the prior 30° history.
    processOrientation(s, { alpha: 0, beta: 90, gamma: 0 }, 30 * 16)
    const snap = read(s, 30 * 16)
    expect(snap.beta).toBeCloseTo(90, 1)
  })
})
