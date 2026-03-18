import { clamp } from '../utils/math.js';

export default class GestureMapper {
  constructor(couplingEngine, motionHandler) {
    this.coupling = couplingEngine;
    this.motionHandler = motionHandler;
    // Touch fallback state
    this.touchX = 0.5;
    this.touchY = 0.5;
    this.touchActive = false;
  }

  /**
   * Returns normalized audio parameters, scaled by coupling.
   * Output: { pan, filterNorm, gestureGain, articulation, downbeat: {fired, intensity} }
   */
  map(motionData, hasMotion) {
    const c = this.coupling.getValue();

    if (!motionData || !hasMotion) {
      return this.mapTouch(c);
    }

    const baseline = this.motionHandler.getBaseline();

    // Pan: gamma relative to baseline, ±45° range → 0-1
    const gammaOffset = motionData.gamma - baseline.gamma;
    const pan = clamp((gammaOffset + 45) / 90, 0, 1);
    const pannedValue = 0.5 + (pan - 0.5) * c; // coupling pulls toward center

    // Filter: beta relative to baseline, ±45° range → 0-1
    const betaOffset = motionData.beta - baseline.beta;
    const filterNorm = clamp((betaOffset + 45) / 90, 0, 1) * c;

    // Gesture size → dynamics gain (the primary conducting control)
    const gestureGain = motionData.gestureSize * c;

    // Articulation from jerk (already normalized)
    const articulation = clamp(motionData.jerk / 3, 0, 1) * c;

    // Downbeat: pass through, scale intensity by coupling
    const downbeat = {
      fired: motionData.downbeat.fired && c > 0.05, // suppress when coupling near-zero
      intensity: motionData.downbeat.intensity * c,
    };

    return { pan: pannedValue, filterNorm, gestureGain, articulation, downbeat };
  }

  mapTouch(c) {
    return {
      pan: 0.5 + (this.touchX - 0.5) * c,
      filterNorm: this.touchY * c,
      gestureGain: this.touchActive ? 0.6 * c : 0.2 * c,
      articulation: 0,
      downbeat: { fired: false, intensity: 0 },
    };
  }

  /**
   * Call from touch event handlers on DarkScreen.
   */
  updateTouch(normalizedX, normalizedY, active) {
    this.touchX = normalizedX;
    this.touchY = normalizedY;
    this.touchActive = active;
  }
}
