export default class MotionHandler {
  constructor() {
    this.hasPermission = false;
    this.hasMotion = false;
    this.data = {
      accelX: 0, accelY: 0, accelZ: 0,
      alpha: 0, beta: 0, gamma: 0,
      rms: 0, jerk: 0,
    };
    this.prevRms = 0;
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

  start() {
    if (!this.hasPermission) return;

    window.addEventListener('devicemotion', (e) => {
      const a = e.accelerationIncludingGravity || {};
      this.data.accelX = a.x || 0;
      this.data.accelY = a.y || 0;
      this.data.accelZ = a.z || 0;

      const rms = Math.sqrt(
        this.data.accelX ** 2 +
        this.data.accelY ** 2 +
        this.data.accelZ ** 2
      );
      this.data.jerk = Math.abs(rms - this.prevRms);
      this.data.rms = rms;
      this.prevRms = rms;
      this.hasMotion = true;
    }, { passive: true });

    window.addEventListener('deviceorientation', (e) => {
      this.data.alpha = e.alpha || 0;
      this.data.beta = e.beta || 0;
      this.data.gamma = e.gamma || 0;
    }, { passive: true });
  }

  getData() {
    return this.data;
  }
}
