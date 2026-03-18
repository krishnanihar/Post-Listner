import { ORBITAL, VOICE_POSITIONS } from '../utils/constants.js';
import { sphericalToCartesian } from '../utils/math.js';

export default class SpatialEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.panners = new Map();
    this.orbitAngles = new Map();
    this.elevations = new Map();
    this.baseDistances = new Map();
  }

  createPanner(key, position, panningModel = 'HRTF') {
    const panner = this.ctx.createPanner();
    panner.panningModel = panningModel;
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 20;
    panner.rolloffFactor = 1.2;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;

    this.setPosition(panner, position);
    this.panners.set(key, panner);
    this.orbitAngles.set(key, (position.azimuth * Math.PI) / 180);
    this.elevations.set(key, position.elevation);
    this.baseDistances.set(key, position.distance);
    return panner;
  }

  setPosition(panner, { azimuth, elevation, distance }) {
    const { x, y, z } = sphericalToCartesian(azimuth, elevation, distance);
    const now = this.ctx.currentTime;
    panner.positionX.setTargetAtTime(x, now, 0.02);
    panner.positionY.setTargetAtTime(y, now, 0.02);
    panner.positionZ.setTargetAtTime(z, now, 0.02);
  }

  /**
   * Called every frame during active phases for orbital motion.
   */
  updateOrbits(deltaTime, phase) {
    for (const [key, panner] of this.panners) {
      const speedKey = `${key.toUpperCase()}_SPEED`;
      const speed = ORBITAL[speedKey] || ORBITAL.DRONE_SPEED;

      let angle = this.orbitAngles.get(key) + speed * deltaTime;
      this.orbitAngles.set(key, angle);

      let elevation = this.elevations.get(key);

      // During dissolution, elevations rise (clamped)
      if (phase === 'dissolution') {
        elevation = Math.min(
          elevation + ORBITAL.ELEVATION_RISE_RATE * deltaTime,
          ORBITAL.MAX_ELEVATION
        );
        this.elevations.set(key, elevation);
      }

      const azimuth = (angle * 180) / Math.PI;
      const baseDistance = this.baseDistances.get(key) || 1;
      // Sinusoidal distance oscillation — breathing approach/recede
      const breathe = ORBITAL.DISTANCE_BREATHE || 0;
      const distance = baseDistance + Math.sin(angle * 0.7) * breathe * baseDistance;
      this.setPosition(panner, { azimuth, elevation, distance });
    }
  }

  /**
   * Trigger a one-shot spatial event on a named panner.
   * Rapidly moves to target elevation; updateOrbits() reads from
   * this.elevations each frame, so normal orbital motion gradually takes over.
   */
  setElevationEvent(key, targetElevation) {
    const panner = this.panners.get(key);
    if (!panner) return;

    this.elevations.set(key, targetElevation);

    const azimuth = (this.orbitAngles.get(key) * 180) / Math.PI;
    const distance = this.baseDistances.get(key) || 1.5;
    this.setPosition(panner, { azimuth, elevation: targetElevation, distance });
  }

  getPanner(key) {
    return this.panners.get(key);
  }

  removePanner(key) {
    const panner = this.panners.get(key);
    if (panner) {
      try { panner.disconnect(); } catch {}
      this.panners.delete(key);
      this.orbitAngles.delete(key);
      this.elevations.delete(key);
      this.baseDistances.delete(key);
    }
  }
}
