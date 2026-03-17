import { clamp } from '../utils/math.js';

export default class GestureMapper {
  constructor(couplingEngine) {
    this.coupling = couplingEngine;
    // Touch fallback state
    this.touchX = 0.5;
    this.touchY = 0.5;
    this.touchActive = false;
  }

  /**
   * Returns normalized audio parameters (all 0-1), scaled by coupling.
   */
  map(motionData) {
    const c = this.coupling.getValue();

    // If no motion data available, use touch fallback
    if (!motionData || (motionData.rms === 0 && !motionData.gamma)) {
      return this.mapTouch(c);
    }

    // Normalize gamma: -90 to 90 → 0 to 1
    const pan = clamp((motionData.gamma + 90) / 180, 0, 1) * c;

    // Normalize beta: map center region to filter
    const filterNorm = clamp((motionData.beta + 60) / 120, 0, 1) * c;

    // RMS magnitude → intensity (gravity ~9.8)
    const intensity = clamp((motionData.rms - 5) / 15, 0, 1) * c;

    // Jerk → rhythmic articulation
    const articulation = clamp(motionData.jerk / 5, 0, 1) * c;

    return { pan, filterNorm, intensity, articulation };
  }

  mapTouch(c) {
    return {
      pan: this.touchX * c,
      filterNorm: this.touchY * c,
      intensity: this.touchActive ? 0.5 * c : 0,
      articulation: 0,
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
