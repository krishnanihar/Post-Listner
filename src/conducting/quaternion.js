// Quaternion + angle helpers used by GestureCore.
// quatFromEulerZXY/quatMul/quatConj match the implementation that was
// previously inlined in conduct-relay/public/phone.js. unwrapAngle is new —
// needed before any 1€ filtering of compass heading (alpha) to avoid the
// 359°→1° wrap producing a spurious -358° derivative spike.

const DEG = Math.PI / 180

export function quatFromEulerZXY(aDeg, bDeg, gDeg) {
  const a = (aDeg || 0) * DEG
  const b = (bDeg || 0) * DEG
  const g = (gDeg || 0) * DEG
  const cZ = Math.cos(a / 2), sZ = Math.sin(a / 2)
  const cX = Math.cos(b / 2), sX = Math.sin(b / 2)
  const cY = Math.cos(g / 2), sY = Math.sin(g / 2)
  return [
    cZ * sX * cY - sZ * cX * sY,
    sZ * sX * cY + cZ * cX * sY,
    sZ * cX * cY + cZ * sX * sY,
    cZ * cX * cY - sZ * sX * sY,
  ]
}

export function quatMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}

export function quatConj(q) { return [-q[0], -q[1], -q[2], q[3]] }

// Shortest signed angular delta in degrees: prev → curr. Result in [-180, 180].
// Required before 1€ filtering of compass heading — naive subtraction across
// the 0°/360° seam produces ±358° spikes that destroy filter state.
export function unwrapAngle(curr, prev) {
  let d = curr - prev
  while (d > 180)  d -= 360
  while (d < -180) d += 360
  return d
}
