import {
  createState, processMotion, processOrientation, calibrate as coreCalibrate, read,
  activeParams,
} from '../conducting/index.js'
import { CONDUCTING } from './constants.js'

/**
 * ConductingEngine — DOM bindings + touch fallback around GestureCore.
 *
 * Owns: DeviceMotionEvent / DeviceOrientationEvent listeners, iOS
 * permission request, touch-fallback input. All gesture math is delegated
 * to src/conducting/GestureCore.js.
 *
 * Output of getData() is backwards-compatible — same {pan, filterNorm,
 * gestureGain, articulation, downbeat} fields the Orchestra audio engine
 * has always consumed, plus newly exposed yaw, rotationRate, accel, and
 * gravityBiased for consumers that want them.
 */
export default class ConductingEngine {
  constructor() {
    this.hasPermission = false
    this.hasMotion = false

    this._state = createState({ params: activeParams() })

    // Touch fallback (desktop testing)
    this._touchX = 0.5
    this._touchY = 0.5
    this._touchActive = false

    this._motionHandler = null
    this._orientationHandler = null
    this._calibrating = false
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
      this.hasPermission = true
    }
    return this.hasPermission
  }

  start() {
    if (!this.hasPermission) return

    this._motionHandler = (e) => {
      this.hasMotion = true
      processMotion(this._state, e, performance.now())
    }
    this._orientationHandler = (e) => {
      processOrientation(this._state, e, performance.now())
    }

    window.addEventListener('devicemotion', this._motionHandler, { passive: true })
    window.addEventListener('deviceorientation', this._orientationHandler, { passive: true })

    this.startCalibration()
  }

  startCalibration(durationMs) {
    const duration = durationMs || CONDUCTING.CALIBRATION_DURATION_MS
    return new Promise((resolve) => {
      this._calibrating = true
      setTimeout(() => {
        coreCalibrate(this._state)
        this._calibrating = false
        resolve()
      }, duration)
    })
  }

  getData() {
    if (!this.hasMotion) return this._getTouchData()
    return read(this._state, performance.now())
  }

  _getTouchData() {
    return {
      pan: this._touchX,
      filterNorm: this._touchY,
      gestureGain: this._touchActive ? 0.6 : 0.2,
      articulation: 0,
      downbeat: { fired: false, intensity: 0, detectedAt: 0 },
      yaw: 0,
      rotationRate: { alpha: 0, beta: 0, gamma: 0, mag: 0 },
      accel: { x: 0, y: 0, z: 0 },
      baselineBeta: 75, baselineGamma: 0,
      gravityBiased: false,
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
