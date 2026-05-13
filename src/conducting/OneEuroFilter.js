// One Euro Filter — adaptive low-pass for noisy sensor streams.
// Casiez, Roussel, Vogel (CHI 2012). Reference: https://gery.casiez.net/1euro
//
// Algorithm:
//   cutoff = mincutoff + beta * |dx_filtered|
//   alpha  = 1 / (1 + tau / dt),  tau = 1 / (2π·cutoff)
//   y      = alpha·x + (1 - alpha)·y_prev
//
// Edge cases handled per Codex review:
//   - First sample passes through unchanged (no history).
//   - dt ≤ 0 (duplicate/out-of-order timestamps) → reuse previous filtered value.
//   - Very large dt (tab suspended) → still produces a finite output;
//     alpha approaches 1, so the filter snaps toward the new input.
//   - reset() flushes state — required when calibration baseline shifts.

class LowPassFilter {
  constructor(alpha) {
    this.setAlpha(alpha)
    this.y = null
    this.s = null
  }
  setAlpha(alpha) {
    if (!(alpha > 0 && alpha <= 1)) throw new Error(`alpha must be in (0,1]; got ${alpha}`)
    this.alpha = alpha
  }
  filter(x, alpha = this.alpha) {
    this.alpha = alpha
    if (this.y == null) { this.y = x; this.s = x; return x }
    this.s = alpha * x + (1 - alpha) * this.s
    this.y = x
    return this.s
  }
  lastFiltered() { return this.s }
  reset() { this.y = null; this.s = null }
}

function alphaFromCutoff(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}

export class OneEuroFilter {
  constructor({ mincutoff = 1.0, beta = 0.0, dcutoff = 1.0 } = {}) {
    this.mincutoff = mincutoff
    this.beta = beta
    this.dcutoff = dcutoff
    this._x = new LowPassFilter(1)   // value filter
    this._dx = new LowPassFilter(1)  // derivative filter
    this._lastTime = null
  }

  setParams({ mincutoff, beta, dcutoff } = {}) {
    if (mincutoff != null) this.mincutoff = mincutoff
    if (beta != null) this.beta = beta
    if (dcutoff != null) this.dcutoff = dcutoff
  }

  reset() {
    this._x.reset()
    this._dx.reset()
    this._lastTime = null
  }

  filter(x, timestamp) {
    if (this._lastTime == null) {
      this._lastTime = timestamp
      this._x.filter(x, 1)
      this._dx.filter(0, 1)
      return x
    }
    let dt = timestamp - this._lastTime
    if (!(dt > 0)) {
      // Duplicate or out-of-order timestamp — return previous filtered value
      // without advancing state.
      return this._x.lastFiltered() ?? x
    }
    this._lastTime = timestamp

    const prevX = this._x.lastFiltered() ?? x
    const dx = (x - prevX) / dt
    const edx = this._dx.filter(dx, alphaFromCutoff(this.dcutoff, dt))
    const cutoff = this.mincutoff + this.beta * Math.abs(edx)
    return this._x.filter(x, alphaFromCutoff(cutoff, dt))
  }
}
