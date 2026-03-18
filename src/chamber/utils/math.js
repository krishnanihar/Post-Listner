export function sigmoid(x, steepness = 6) {
  return 1 / (1 + Math.exp(steepness * (x - 0.5)));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export function rms(x, y, z) {
  return Math.sqrt(x * x + y * y + z * z);
}

export function sphericalToCartesian(azimuth, elevation, distance) {
  const azRad = (azimuth * Math.PI) / 180;
  const elRad = (elevation * Math.PI) / 180;
  return {
    x: distance * Math.cos(elRad) * Math.sin(azRad),
    y: distance * Math.sin(elRad),
    z: -distance * Math.cos(elRad) * Math.cos(azRad),
  };
}
