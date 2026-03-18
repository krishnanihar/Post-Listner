import { ORBITAL, VOICE_POSITIONS } from '../utils/constants.js';
import { sphericalToCartesian } from '../utils/math.js';

export default class SpatialEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.panners = new Map();
    this.orbitAngles = new Map();
    this.elevations = new Map();
  }

  createPanner(key, position) {
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 10;
    panner.rolloffFactor = 0.4;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;

    this.setPosition(panner, position);
    this.panners.set(key, panner);
    this.orbitAngles.set(key, (position.azimuth * Math.PI) / 180);
    this.elevations.set(key, position.elevation);
    return panner;
  }

  setPosition(panner, { azimuth, elevation, distance }) {
    const { x, y, z } = sphericalToCartesian(azimuth, elevation, distance);
    const now = this.ctx.currentTime;
    panner.positionX.setTargetAtTime(x, now, 0.1);
    panner.positionY.setTargetAtTime(y, now, 0.1);
    panner.positionZ.setTargetAtTime(z, now, 0.1);
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

      // During dissolution, elevations rise
      if (phase === 'dissolution') {
        elevation += ORBITAL.ELEVATION_RISE_RATE * deltaTime;
        this.elevations.set(key, elevation);
      }

      const azimuth = (angle * 180) / Math.PI;
      const posInfo = VOICE_POSITIONS[key.toUpperCase()];
      const distance = posInfo?.distance || 1;
      this.setPosition(panner, { azimuth, elevation, distance });
    }
  }

  getPanner(key) {
    return this.panners.get(key);
  }
}
