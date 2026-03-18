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
  map(motionData, hasMotion) {
    const c = this.coupling.getValue();

    // Use hasMotion flag from MotionHandler (avoids falsy-zero gamma bug)
    if (!motionData || !hasMotion) {
      return this.mapTouch(c);
    }

    // Narrow gamma range: ±45° → 0-1 (natural wrist tilt gives full sweep)
    const pan = clamp((motionData.gamma + 45) / 90, 0, 1) * c;

    // Recenter beta around natural upright hold (~75°): 30°-120° → 0-1
    const filterNorm = clamp((motionData.beta - 30) / 90, 0, 1) * c;

    // RMS from gravity-removed acceleration: 0-5 m/s² range for hand motion
    const intensity = clamp(motionData.rms / 5, 0, 1) * c;

    // Jerk → rhythmic articulation (lowered divisor for more sensitivity)
    const articulation = clamp(motionData.jerk / 3, 0, 1) * c;

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
