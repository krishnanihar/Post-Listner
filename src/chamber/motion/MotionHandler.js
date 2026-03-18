import { CONDUCTING } from '../utils/constants.js';
import { clamp } from '../utils/math.js';

export default class MotionHandler {
  constructor() {
    this.hasPermission = false;
    this.hasMotion = false;
    this.data = {
      accelX: 0, accelY: 0, accelZ: 0,
      alpha: 0, beta: 0, gamma: 0,
      rms: 0, jerk: 0,
      gestureSize: 0,
      downbeat: { fired: false, intensity: 0, timestamp: 0 },
    };
    this.prevRms = 0;

    // Downbeat detection state
    this._yBuffer = [];           // [{y, t}] — sliding window of Y acceleration
    this._lastDownbeatTime = 0;
    this._prevY = 0;

    // Gesture size state
    this._magBuffer = [];         // [{mag, t}] — sliding window of accel magnitudes

    // Calibration state
    this._calibrating = false;
    this._calibrationSamples = [];
    this._baselineBeta = 75;      // default upright
    this._baselineGamma = 0;
    this._baselineY = 0;          // estimated gravity Y component for fallback
  }

  async requestPermission() {
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        this.hasPermission = permission === 'granted';
      } catch {
        this.hasPermission = false;
      }
    } else {
      this.hasPermission = true;
    }
    return this.hasPermission;
  }

  startCalibration() {
    return new Promise((resolve) => {
      this._calibrating = true;
      this._calibrationSamples = [];

      setTimeout(() => {
        this._calibrating = false;
        if (this._calibrationSamples.length > 0) {
          const n = this._calibrationSamples.length;
          let sumBeta = 0, sumGamma = 0, sumY = 0;
          for (let i = 0; i < n; i++) {
            sumBeta += this._calibrationSamples[i].beta;
            sumGamma += this._calibrationSamples[i].gamma;
            sumY += this._calibrationSamples[i].y;
          }
          this._baselineBeta = sumBeta / n;
          this._baselineGamma = sumGamma / n;
          this._baselineY = sumY / n;
        }
        this._calibrationSamples = [];
        resolve({
          beta: this._baselineBeta,
          gamma: this._baselineGamma,
        });
      }, CONDUCTING.CALIBRATION_DURATION_MS);
    });
  }

  getBaseline() {
    return {
      beta: this._baselineBeta,
      gamma: this._baselineGamma,
    };
  }

  start() {
    if (!this.hasPermission) return;

    window.addEventListener('devicemotion', (e) => {
      // Reset downbeat fired at start of each event
      this.data.downbeat.fired = false;

      // Prefer gravity-removed acceleration
      const a = e.acceleration && (e.acceleration.x != null)
        ? e.acceleration
        : e.accelerationIncludingGravity || {};
      const ax = a.x || 0;
      const ay = a.y || 0;
      const az = a.z || 0;

      this.data.accelX = ax;
      this.data.accelY = ay;
      this.data.accelZ = az;

      // RMS and jerk (existing behavior)
      const rms = Math.sqrt(ax * ax + ay * ay + az * az);
      this.data.jerk = Math.abs(rms - this.prevRms);
      this.data.rms = rms;
      this.prevRms = rms;
      this.hasMotion = true;

      const now = performance.now();

      // --- Downbeat detection ---
      this._yBuffer.push({ y: ay, t: now });

      // Trim samples older than window
      const windowCutoff = now - CONDUCTING.DOWNBEAT_WINDOW_MS;
      let trimIdx = 0;
      while (trimIdx < this._yBuffer.length && this._yBuffer[trimIdx].t < windowCutoff) {
        trimIdx++;
      }
      if (trimIdx > 0) {
        this._yBuffer.splice(0, trimIdx);
      }

      // Check for negative-to-positive zero-crossing in Y acceleration
      // Negative Y = phone moving downward, positive = reversing upward
      if (this._prevY < 0 && ay >= 0) {
        // Find peak negative Y in the window
        let peakNegY = 0;
        for (let i = 0; i < this._yBuffer.length; i++) {
          if (this._yBuffer[i].y < peakNegY) {
            peakNegY = this._yBuffer[i].y;
          }
        }

        const peakMag = Math.abs(peakNegY);
        if (
          peakMag >= CONDUCTING.DOWNBEAT_ACCEL_THRESHOLD &&
          now - this._lastDownbeatTime >= CONDUCTING.DOWNBEAT_MIN_INTERVAL_MS
        ) {
          this.data.downbeat.fired = true;
          this.data.downbeat.intensity = clamp(
            peakMag / (CONDUCTING.DOWNBEAT_ACCEL_THRESHOLD * 3), 0, 1
          );
          this.data.downbeat.timestamp = now;
          this._lastDownbeatTime = now;
        }
      }
      this._prevY = ay;

      // --- Gesture size tracking ---
      this._magBuffer.push({ mag: rms, t: now });

      // Trim entries older than gesture size window
      const magCutoff = now - CONDUCTING.GESTURE_SIZE_WINDOW_MS;
      let magTrimIdx = 0;
      while (magTrimIdx < this._magBuffer.length && this._magBuffer[magTrimIdx].t < magCutoff) {
        magTrimIdx++;
      }
      if (magTrimIdx > 0) {
        this._magBuffer.splice(0, magTrimIdx);
      }

      // Peak-to-peak amplitude
      let minMag = Infinity, maxMag = -Infinity;
      for (let i = 0; i < this._magBuffer.length; i++) {
        const m = this._magBuffer[i].mag;
        if (m < minMag) minMag = m;
        if (m > maxMag) maxMag = m;
      }
      const peakToPeak = this._magBuffer.length > 0 ? maxMag - minMag : 0;
      this.data.gestureSize = clamp(peakToPeak / CONDUCTING.GESTURE_SIZE_RANGE, 0, 1);

      // Calibration sampling (acceleration Y for gravity baseline)
      if (this._calibrating) {
        this._calibrationSamples.push({
          beta: 0, gamma: 0, // filled by orientation handler
          y: ay,
        });
      }
    }, { passive: true });

    window.addEventListener('deviceorientation', (e) => {
      this.data.alpha = e.alpha || 0;
      this.data.beta = e.beta || 0;
      this.data.gamma = e.gamma || 0;

      // Calibration sampling (orientation)
      if (this._calibrating && this._calibrationSamples.length > 0) {
        // Update the most recent sample with orientation data
        const last = this._calibrationSamples[this._calibrationSamples.length - 1];
        last.beta = this.data.beta;
        last.gamma = this.data.gamma;
      }
    }, { passive: true });
  }

  getData() {
    return this.data;
  }
}
