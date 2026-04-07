import { CONDUCTING } from './constants.js'
import { clamp } from '../chamber/utils/math.js'

/**
 * Consolidated conducting engine — combines MotionHandler + GestureMapper.
 * Returns RAW gesture data without coupling scaling.
 * OrchestraEngine handles per-section coupling in applyConducting().
 */
export default class ConductingEngine {
  constructor() {
    this.hasPermission = false
    this.hasMotion = false

    // Raw motion data
    this._accelX = 0
    this._accelY = 0
    this._accelZ = 0
    this._alpha = 0
    this._beta = 0
    this._gamma = 0
    this._rms = 0
    this._prevRms = 0
    this._jerk = 0
    this._gestureSize = 0

    // Downbeat state
    this._yBuffer = []         // [{y, t}]
    this._lastDownbeatTime = 0
    this._prevY = 0
    this._downbeatFired = false
    this._downbeatIntensity = 0

    // Gesture size state
    this._magBuffer = []       // [{mag, t}]

    // Calibration
    this._calibrating = false
    this._calibrationSamples = []
    this._baselineBeta = 75    // default upright
    this._baselineGamma = 0

    // Touch fallback
    this._touchX = 0.5
    this._touchY = 0.5
    this._touchActive = false

    // Event handler refs for cleanup
    this._motionHandler = null
    this._orientationHandler = null
  }

  async requestPermission() {
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      try {
        const permission = await DeviceMotionEvent.requestPermission()
        this.hasPermission = permission === 'granted'
      } catch {
        this.hasPermission = false
      }
    } else {
      // Non-iOS or no permission API needed
      this.hasPermission = true
    }
    return this.hasPermission
  }

  start() {
    if (!this.hasPermission) return

    this._motionHandler = (e) => {
      this._downbeatFired = false

      const a = e.acceleration && (e.acceleration.x != null)
        ? e.acceleration
        : e.accelerationIncludingGravity || {}
      const ax = a.x || 0
      const ay = a.y || 0
      const az = a.z || 0

      this._accelX = ax
      this._accelY = ay
      this._accelZ = az

      const rms = Math.sqrt(ax * ax + ay * ay + az * az)
      this._jerk = Math.abs(rms - this._prevRms)
      this._rms = rms
      this._prevRms = rms
      this.hasMotion = true

      const now = performance.now()

      // Downbeat detection: negative-to-positive Y zero-crossing
      this._yBuffer.push({ y: ay, t: now })
      const windowCutoff = now - CONDUCTING.DOWNBEAT_WINDOW_MS
      let trimIdx = 0
      while (trimIdx < this._yBuffer.length && this._yBuffer[trimIdx].t < windowCutoff) trimIdx++
      if (trimIdx > 0) this._yBuffer.splice(0, trimIdx)

      if (this._prevY < 0 && ay >= 0) {
        let peakNegY = 0
        for (let i = 0; i < this._yBuffer.length; i++) {
          if (this._yBuffer[i].y < peakNegY) peakNegY = this._yBuffer[i].y
        }
        const peakMag = Math.abs(peakNegY)
        if (
          peakMag >= CONDUCTING.DOWNBEAT_ACCEL_THRESHOLD &&
          now - this._lastDownbeatTime >= CONDUCTING.DOWNBEAT_MIN_INTERVAL_MS
        ) {
          this._downbeatFired = true
          this._downbeatIntensity = clamp(peakMag / (CONDUCTING.DOWNBEAT_ACCEL_THRESHOLD * 3), 0, 1)
          this._lastDownbeatTime = now
        }
      }
      this._prevY = ay

      // Gesture size: peak-to-peak amplitude in rolling window
      this._magBuffer.push({ mag: rms, t: now })
      const magCutoff = now - CONDUCTING.GESTURE_SIZE_WINDOW_MS
      let magTrimIdx = 0
      while (magTrimIdx < this._magBuffer.length && this._magBuffer[magTrimIdx].t < magCutoff) magTrimIdx++
      if (magTrimIdx > 0) this._magBuffer.splice(0, magTrimIdx)

      let minMag = Infinity, maxMag = -Infinity
      for (let i = 0; i < this._magBuffer.length; i++) {
        const m = this._magBuffer[i].mag
        if (m < minMag) minMag = m
        if (m > maxMag) maxMag = m
      }
      this._gestureSize = this._magBuffer.length > 0
        ? clamp((maxMag - minMag) / CONDUCTING.GESTURE_SIZE_RANGE, 0, 1)
        : 0

      // Calibration sampling
      if (this._calibrating) {
        this._calibrationSamples.push({ beta: 0, gamma: 0, y: ay })
      }
    }

    this._orientationHandler = (e) => {
      this._alpha = e.alpha || 0
      this._beta = e.beta || 0
      this._gamma = e.gamma || 0

      if (this._calibrating && this._calibrationSamples.length > 0) {
        const last = this._calibrationSamples[this._calibrationSamples.length - 1]
        last.beta = this._beta
        last.gamma = this._gamma
      }
    }

    window.addEventListener('devicemotion', this._motionHandler, { passive: true })
    window.addEventListener('deviceorientation', this._orientationHandler, { passive: true })

    // Start calibration immediately
    this.startCalibration()
  }

  startCalibration(durationMs) {
    const duration = durationMs || CONDUCTING.CALIBRATION_DURATION_MS
    return new Promise((resolve) => {
      this._calibrating = true
      this._calibrationSamples = []

      setTimeout(() => {
        this._calibrating = false
        if (this._calibrationSamples.length > 0) {
          const n = this._calibrationSamples.length
          let sumBeta = 0, sumGamma = 0
          for (let i = 0; i < n; i++) {
            sumBeta += this._calibrationSamples[i].beta
            sumGamma += this._calibrationSamples[i].gamma
          }
          this._baselineBeta = sumBeta / n
          this._baselineGamma = sumGamma / n
        }
        this._calibrationSamples = []
        resolve()
      }, duration)
    })
  }

  /**
   * Returns raw gesture data — NO coupling applied.
   */
  getData() {
    if (!this.hasMotion) {
      return this._getTouchData()
    }

    // Pan: gamma relative to baseline, ±45° range → 0-1
    const gammaOffset = this._gamma - this._baselineGamma
    const pan = clamp((gammaOffset + 45) / 90, 0, 1)

    // Filter: beta relative to baseline, ±45° range → 0-1
    const betaOffset = this._beta - this._baselineBeta
    const filterNorm = clamp((betaOffset + 45) / 90, 0, 1)

    // Gesture size (already 0-1)
    const gestureGain = this._gestureSize

    // Articulation from jerk
    const articulation = clamp(this._jerk / 3, 0, 1)

    // Downbeat — consume the flag so one physical downbeat produces one event
    const downbeat = {
      fired: this._downbeatFired,
      intensity: this._downbeatIntensity,
    }
    if (this._downbeatFired) {
      this._downbeatFired = false
    }

    return { pan, filterNorm, gestureGain, articulation, downbeat }
  }

  _getTouchData() {
    return {
      pan: this._touchX,
      filterNorm: this._touchY,
      gestureGain: this._touchActive ? 0.6 : 0.2,
      articulation: 0,
      downbeat: { fired: false, intensity: 0 },
    }
  }

  updateTouch(normalizedX, normalizedY, active) {
    this._touchX = normalizedX
    this._touchY = normalizedY
    this._touchActive = active
  }

  stop() {
    if (this._motionHandler) {
      window.removeEventListener('devicemotion', this._motionHandler)
    }
    if (this._orientationHandler) {
      window.removeEventListener('deviceorientation', this._orientationHandler)
    }
  }
}
