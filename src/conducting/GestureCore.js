// GestureCore — pure-function gesture extractor.
//
// State shape:
//   {
//     params,                       // LEGACY_PARAMS | RESEARCH_PARAMS
//     yBuffer: [{y, t}],            // sliding window for downbeat detection
//     magBuffer: [{mag, t}],        // sliding window for gesture size
//     prevY, prevRms,
//     lastDownbeatTime,
//     pendingDownbeat,              // {fired, intensity, detectedAt} | null
//     rotationRate, accel,          // last raw samples
//     alpha, beta, gamma,           // last orientation read (post-filter)
//     baselineBeta, baselineGamma,  // calibration center
//     calibrationSamples,           // [{beta, gamma}] until calibrate() consumes
//     gestureGain, articulation,    // last computed
//     gravityBiased,                // last motion had no e.acceleration
//     filters: { ... }              // 1€ instances, null when params.ONE_EURO_* unset
//     _prevAlphaRaw, _filteredAlphaAbs   // alpha-wraparound bookkeeping
//   }
//
// Convention: all timestamps are in milliseconds, matching DeviceMotionEvent.

import { OneEuroFilter } from './OneEuroFilter.js'
import { unwrapAngle } from './quaternion.js'

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

export function createState({ params }) {
  if (!params) throw new Error('GestureCore.createState requires params')

  const orientation = params.ONE_EURO_ORIENTATION
  const accel       = params.ONE_EURO_ACCEL

  return {
    params,
    yBuffer: [],
    magBuffer: [],
    prevY: 0,
    prevRms: 0,
    lastDownbeatTime: Number.NEGATIVE_INFINITY,
    pendingDownbeat: null,
    rotationRate: { alpha: 0, beta: 0, gamma: 0, mag: 0 },
    accel: { x: 0, y: 0, z: 0 },
    alpha: 0, beta: 0, gamma: 0,
    baselineBeta: 75, baselineGamma: 0,
    calibrationSamples: [],
    gestureGain: 0,
    articulation: 0,
    gravityBiased: false,
    filters: {
      alpha: orientation ? new OneEuroFilter(orientation) : null,
      beta:  orientation ? new OneEuroFilter(orientation) : null,
      gamma: orientation ? new OneEuroFilter(orientation) : null,
      ax:    accel ? new OneEuroFilter(accel) : null,
      ay:    accel ? new OneEuroFilter(accel) : null,
      az:    accel ? new OneEuroFilter(accel) : null,
    },
    _prevAlphaRaw: null,
    _filteredAlphaAbs: null,
  }
}

export function processMotion(state, e, now) {
  const usingGravityFallback = !(e.acceleration && e.acceleration.x != null)
  const a = usingGravityFallback ? (e.accelerationIncludingGravity || {}) : e.acceleration
  state.gravityBiased = usingGravityFallback

  // Optional 1€ filter on accel — only active when params provide settings
  const ax = state.filters.ax ? state.filters.ax.filter(a.x || 0, now / 1000) : (a.x || 0)
  const ay = state.filters.ay ? state.filters.ay.filter(a.y || 0, now / 1000) : (a.y || 0)
  const az = state.filters.az ? state.filters.az.filter(a.z || 0, now / 1000) : (a.z || 0)
  state.accel = { x: ax, y: ay, z: az }

  const rr = e.rotationRate || {}
  const rrA = rr.alpha || 0, rrB = rr.beta || 0, rrG = rr.gamma || 0
  state.rotationRate = {
    alpha: rrA, beta: rrB, gamma: rrG,
    mag: Math.hypot(rrA, rrB, rrG),
  }

  const rms = Math.sqrt(ax * ax + ay * ay + az * az)
  const jerk = Math.abs(rms - state.prevRms)
  state.prevRms = rms

  // Downbeat — negative-Y peak followed by zero-crossing
  const P = state.params
  state.yBuffer.push({ y: ay, t: now })
  const yCutoff = now - P.DOWNBEAT_WINDOW_MS
  while (state.yBuffer.length && state.yBuffer[0].t < yCutoff) state.yBuffer.shift()

  if (state.prevY < 0 && ay >= 0) {
    let peakNegY = 0
    for (const sample of state.yBuffer) if (sample.y < peakNegY) peakNegY = sample.y
    const peakMag = Math.abs(peakNegY)
    if (
      peakMag >= P.DOWNBEAT_ACCEL_THRESHOLD &&
      now - state.lastDownbeatTime >= P.DOWNBEAT_MIN_INTERVAL_MS
    ) {
      state.pendingDownbeat = {
        fired: true,
        intensity: clamp(peakMag / (P.DOWNBEAT_ACCEL_THRESHOLD * 3), 0, 1),
        detectedAt: now,
      }
      state.lastDownbeatTime = now
    }
  }
  state.prevY = ay

  // Gesture size — peak-to-peak RMS excursion in rolling window.
  state.magBuffer.push({ mag: rms, t: now })
  const magCutoff = now - P.GESTURE_SIZE_WINDOW_MS
  while (state.magBuffer.length && state.magBuffer[0].t < magCutoff) state.magBuffer.shift()
  let minMag = Infinity, maxMag = -Infinity
  for (const sample of state.magBuffer) {
    if (sample.mag < minMag) minMag = sample.mag
    if (sample.mag > maxMag) maxMag = sample.mag
  }
  state.gestureGain = state.magBuffer.length > 0
    ? clamp((maxMag - minMag) / P.GESTURE_SIZE_RANGE, 0, 1)
    : 0

  state.articulation = clamp(jerk / P.ARTICULATION_JERK_RANGE, 0, 1)
}

export function processOrientation(state, e, now) {
  // iOS Safari exposes webkitCompassHeading (true compass, 0=N, clockwise).
  // Standard DeviceOrientationEvent.alpha is counter-clockwise from north.
  // Convert iOS reading to the alpha convention so consumers see one signal
  // type (Codex risk #2).
  const rawAlpha = (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading))
    ? (360 - e.webkitCompassHeading) % 360   // clockwise → counter-clockwise
    : (e.alpha || 0)
  const rawBeta  = e.beta  || 0
  const rawGamma = e.gamma || 0

  // Alpha — filter on the unwrapped absolute representation so the filter
  // never sees a 358° jump (Codex risk #1).
  if (state.filters.alpha) {
    if (state._filteredAlphaAbs == null) {
      state._filteredAlphaAbs = rawAlpha
      state.alpha = rawAlpha
    } else {
      const delta = unwrapAngle(rawAlpha, state._prevAlphaRaw)
      state._filteredAlphaAbs += delta
      const filteredAbs = state.filters.alpha.filter(state._filteredAlphaAbs, now / 1000)
      state.alpha = ((filteredAbs % 360) + 360) % 360
    }
  } else {
    state.alpha = rawAlpha
  }
  state._prevAlphaRaw = rawAlpha

  // Beta + gamma — simple 1€ filter (no wraparound needed; valid ranges are
  // [-180, 180] and [-90, 90] respectively, and conducting motion doesn't
  // cross those boundaries).
  state.beta  = state.filters.beta  ? state.filters.beta.filter(rawBeta,  now / 1000) : rawBeta
  state.gamma = state.filters.gamma ? state.filters.gamma.filter(rawGamma, now / 1000) : rawGamma

  if (state.calibrationSamples) {
    state.calibrationSamples.push({ beta: rawBeta, gamma: rawGamma })
  }
}

export function calibrate(state) {
  const samples = state.calibrationSamples
  if (samples && samples.length > 0) {
    let sumB = 0, sumG = 0
    for (const s of samples) { sumB += s.beta; sumG += s.gamma }
    state.baselineBeta  = sumB / samples.length
    state.baselineGamma = sumG / samples.length
  }
  state.calibrationSamples = []

  // Reset 1€ filter state on calibration (Codex risk #3) — old samples must
  // not bleed into the new neutral baseline.
  for (const k of ['alpha', 'beta', 'gamma', 'ax', 'ay', 'az']) {
    if (state.filters[k]) state.filters[k].reset()
  }
  state._prevAlphaRaw = null
  state._filteredAlphaAbs = null
}

export function read(state, now) {
  // Compute backwards-compatible pan/filterNorm from gamma/beta + baselines.
  const gammaOffset = state.gamma - state.baselineGamma
  const betaOffset  = state.beta  - state.baselineBeta
  const pan = clamp((gammaOffset + 45) / 90, 0, 1)
  const filterNorm = clamp((betaOffset + 45) / 90, 0, 1)

  // Yaw: filtered alpha in degrees. iOS uses webkitCompassHeading when
  // available (true compass); Android uses alpha as-is.
  const yaw = state.alpha

  // Downbeat — consume the one-shot
  const downbeat = state.pendingDownbeat
    ? { ...state.pendingDownbeat }
    : { fired: false, intensity: 0, detectedAt: 0 }
  state.pendingDownbeat = null

  return {
    pan, filterNorm,
    gestureGain: state.gestureGain,
    articulation: state.articulation,
    downbeat,
    // Newly exposed signals
    yaw,
    beta: state.beta,
    gamma: state.gamma,
    rotationRate: { ...state.rotationRate },
    accel: { ...state.accel },
    baselineBeta: state.baselineBeta,
    baselineGamma: state.baselineGamma,
    gravityBiased: state.gravityBiased,
  }
}
