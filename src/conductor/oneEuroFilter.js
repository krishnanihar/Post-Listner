// 1€ Filter — Casiez, Roussel, Vogel (CHI 2012).
// Adaptive low-pass: aggressive smoothing at rest, opens up during fast motion.
//   minCutoff:  cutoff at zero speed (Hz). Lower = smoother at rest, more lag.
//   beta:       speed coefficient. Higher = less lag during fast motion.
//   dCutoff:    cutoff for the derivative estimator (Hz). Default 1.0 is fine.

function smoothingFactor(dt, cutoff) {
  const r = 2 * Math.PI * cutoff * dt
  return r / (r + 1)
}

export class OneEuroFilter {
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
    this._xPrev = null
    this._dxPrev = 0
    this._tPrev = 0
  }

  filter(x, t) {
    if (this._xPrev === null) {
      this._xPrev = x
      this._dxPrev = 0
      this._tPrev = t
      return x
    }
    const dt = (t - this._tPrev) / 1000
    if (dt <= 0) return this._xPrev

    // Estimate the derivative and smooth it
    const dx = (x - this._xPrev) / dt
    const aD = smoothingFactor(dt, this.dCutoff)
    const dxHat = aD * dx + (1 - aD) * this._dxPrev

    // Adaptive cutoff: faster motion → higher cutoff → less smoothing
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat)

    const a = smoothingFactor(dt, cutoff)
    const xHat = a * x + (1 - a) * this._xPrev

    this._xPrev = xHat
    this._dxPrev = dxHat
    this._tPrev = t
    return xHat
  }

  reset() {
    this._xPrev = null
    this._dxPrev = 0
    this._tPrev = 0
  }
}

// Quaternion variant: 4 scalar filters + hemisphere continuity + renormalize.
// Returns a plain object {x,y,z,w} so this stays free of any THREE dependency.
export class OneEuroQuaternion {
  constructor(opts = {}) {
    this._fx = new OneEuroFilter(opts)
    this._fy = new OneEuroFilter(opts)
    this._fz = new OneEuroFilter(opts)
    this._fw = new OneEuroFilter(opts)
    this._prev = null
  }

  filter(x, y, z, w, t) {
    // Hemisphere continuity: dot product with previous; flip if negative.
    let qx = x, qy = y, qz = z, qw = w
    if (this._prev) {
      const dot = qx * this._prev.x + qy * this._prev.y +
                  qz * this._prev.z + qw * this._prev.w
      if (dot < 0) { qx = -qx; qy = -qy; qz = -qz; qw = -qw }
    }

    const fx = this._fx.filter(qx, t)
    const fy = this._fy.filter(qy, t)
    const fz = this._fz.filter(qz, t)
    const fw = this._fw.filter(qw, t)

    // Renormalize to keep it a valid unit quaternion
    const len = Math.sqrt(fx * fx + fy * fy + fz * fz + fw * fw) || 1
    const out = { x: fx / len, y: fy / len, z: fz / len, w: fw / len }
    this._prev = out
    return out
  }

  reset() {
    this._fx.reset(); this._fy.reset(); this._fz.reset(); this._fw.reset()
    this._prev = null
  }
}
