# Conducting Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the two parallel conducting pipelines (Orchestra's phone-native `ConductingEngine` and the relay-served `phone.js`) onto a single shared `GestureCore`, then apply research-aligned fixes from `Research/gesture-felt-agency-phone-as-baton.md` behind two short-lived feature flags so the structural refactor can be regression-tested before any behavior change ships.

**Architecture:** Extract the gesture-extraction math (downbeat detector, gesture-size RMS, jerk, quaternion calibration) into pure functions in a new `src/conducting/` module. Migrate both call sites (Orchestra's `ConductingEngine.js` and `conduct-relay/public/phone.js`) to wrap that module — `ConductingEngine` keeps its existing `getData()` output shape (additive new fields only), and the relay phone script gets bundled into a single IIFE via esbuild so it can use ES module imports. Once the structural move is verified on a real iOS device, two feature flags (`USE_RESEARCH_CONDUCTING_PARAMS`, `ENABLE_GYRO_ENERGY_COUPLING`) gate the behavioral changes: One Euro Filter on input streams, threshold bump to 4 m/s² / 300 ms, ±6 dB gain band, and the yaw-on-alpha bug fix + gyro→brightness cross-coupling in `OrchestraEngine.applyConducting`.

**Tech Stack:** Vanilla JS (pure functions, no React/Three dependencies in the core), Vitest 4 + jsdom for tests, esbuild 0.27+ for the relay phone bundle (new devDep), Web Audio API, DeviceMotionEvent / DeviceOrientationEvent.

---

## Research grounding (read once, then refer back)

The plan implements these specific mechanisms — keep them in mind when reviewing thresholds and signal flow:

- **One Euro Filter** (Casiez et al., CHI 2012) — adaptive low-pass filter, `cutoff = mincutoff + beta * |dx_filtered|`. Gold standard for noisy sensor streams. Recommended params from research §3.4: orientation `mincutoff=1.0 Hz, beta=0.007`; acceleration `mincutoff=0.5 Hz, beta=0.005`.
- **Downbeat thresholds** (research §5.1) — `4 m/s²` peak-Y, `300 ms` minimum IOI. Personal Orchestra found phantom double-beats from baton momentum; phone is 3–6× heavier.
- **Gesture-size gain band** (research §3.1) — `±6 dB` (≈ 0.5× to 2× linear) for the "Intensity" macro-dimension. Current `0.15× to 1.0×` floor lets the music near-vanish, inverting Wegnerian exclusivity.
- **Yaw spotlight on alpha** (research §3.5) — directional "spotlight" on the stem the user faces is driven by compass heading (`alpha`), not roll (`gamma`). Currently `OrchestraEngine.js:336-337` uses roll-derived `pan` for `facingDeg` — a one-axis collapse bug.
- **Gyro → spectral brightness** (research §3.3) — `rotationRate.mag` should cross-couple into the "Energy/Brightness" macro-dimension alongside pitch. Phone.js already exposes it; Orchestra ignores it.

## Codex review concerns this plan addresses

From `/tmp/codex-review.md` (independent review by OpenAI Codex CLI on 2026-05-13):

1. **Separation of extraction from enhancement** — Steps 1–4 are pure refactor (same behavior). Steps 5–6 are behavior change behind flags.
2. **Bundle, don't copy** — Step 3 uses esbuild to produce a single IIFE bundle. No copied source trees.
3. **Five risks called out by Codex** — all addressed in Step 5:
   - **Alpha wraparound** (359° → 1° jumps through 180°) — handled by `unwrapAngle()` helper before 1€ filtering.
   - **iOS vs Android compass semantics** — guard reads `webkitCompassHeading` first on iOS, falls back to `alpha`.
   - **Filter state reset on calibration** — `OneEuroFilter.reset()` invoked from `GestureCore.calibrate()`.
   - **Event ordering (motion vs orientation)** — downbeats carry their detection timestamp; consumers read by absolute time, not "pending since last send".
   - **Gravity-fallback distortion** — `GestureCore.processMotion()` exposes a `gravityBiased` boolean; downstream can warn or reduce downbeat sensitivity.

---

## File structure

**New files:**

| File | Responsibility |
|------|----------------|
| `src/conducting/OneEuroFilter.js` | Pure 1€ filter class: `filter(x, timestamp) → number`, `reset()`, `setParams({mincutoff, beta})`. Internal `LowPassFilter` for the inner stage. |
| `src/conducting/GestureCore.js` | Stateful gesture extractor. `createState(opts)`, `processMotion(state, motionEvent, now)`, `processOrientation(state, orientationEvent, now)`, `calibrate(state)`, `read(state, now) → snapshot`. Pure with explicit state — no global vars, no DOM access. |
| `src/conducting/quaternion.js` | Pure quaternion helpers extracted from phone.js: `quatFromEulerZXY`, `quatMul`, `quatConj`, `unwrapAngle` (for alpha wraparound). |
| `src/conducting/constants.js` | Thresholds + filter params + feature flags. Two-mode: `LEGACY_PARAMS` (current 2.0/250/150/5.0/0.15-1.0) and `RESEARCH_PARAMS` (4.0/300/150/5.0/0.5-2.0). Flag constants `USE_RESEARCH_CONDUCTING_PARAMS`, `ENABLE_GYRO_ENERGY_COUPLING`. |
| `src/conducting/index.js` | Public exports — re-exports `OneEuroFilter`, `GestureCore` functions, constants. |
| `src/conducting/__tests__/OneEuroFilter.test.js` | Vitest: filter math, reset behavior, first-sample handling, dt edge cases. |
| `src/conducting/__tests__/GestureCore.test.js` | Vitest: golden-master tests asserting current 2.0/250/150/5.0 behavior, then research-mode tests at 4.0/300. |
| `src/conducting/__tests__/quaternion.test.js` | Vitest: quat math + `unwrapAngle` across 359°↔1° boundary. |
| `conduct-relay/src/phone.js` | New ESM entry point. Owns DOM + WS + listeners; imports `GestureCore` from `../../src/conducting/index.js`. |
| `scripts/build-relay-phone.js` | Node script invoking esbuild API. Used by `npm run build:relay-phone` and `npm run dev:relay`. |

**Modified files:**

| File | What changes |
|------|--------------|
| `src/orchestra/ConductingEngine.js` | Becomes a thin wrapper around `GestureCore`. Owns DeviceMotion/DeviceOrientation listeners and touch fallback; delegates math to `GestureCore`. `getData()` output shape preserved; new fields (`yaw`, `rotationRate`, `accel`, `gravityBiased`) added. |
| `src/orchestra/OrchestraEngine.js` | `applyConducting()` switches `facingDeg` from `pan`-derived to `yaw`-derived (gated by `ENABLE_GYRO_ENERGY_COUPLING`). Gyro cross-coupling added behind same flag. Gesture-size gain band uses `RESEARCH_PARAMS` when flag is on. |
| `conduct-relay/public/phone.html` | `<script>` tag points at `phone.bundle.js` (esbuild output) instead of `phone.js`. |
| `conduct-relay/public/phone.js` | **Deleted.** Replaced by the bundled output. |
| `conduct-relay/server.cjs` | No changes — already serves `*.js` files via static handler. |
| `package.json` | Adds `esbuild` to devDependencies. Adds `build:relay-phone` and `dev:relay` scripts. |
| `.gitignore` | Adds `conduct-relay/public/phone.bundle.js*`. |
| `CLAUDE.md` | Updates "Parked for later → §2 Conducting gaps" to reflect what's now fixed. |

---

## Step 1 — Extract GestureCore (behavior-identical)

**Goal:** Create the pure-function core with current thresholds. Tests assert the same `2.0` / `250 ms` / `150 ms` / `5.0` behavior so we can verify no regression in steps 2–4 before changing anything in step 5.

### Task 1.1: Scaffold `src/conducting/` module skeleton

**Files:**
- Create: `src/conducting/constants.js`
- Create: `src/conducting/index.js`

- [ ] **Step 1: Create `src/conducting/constants.js`**

```js
// Conducting-core constants. Two parameter sets — LEGACY matches the
// pre-refactor behavior byte-for-byte; RESEARCH applies the spec from
// Research/gesture-felt-agency-phone-as-baton.md §3-5.
//
// Until step 5, the active set MUST be LEGACY so the refactor is a no-op
// for the user. Step 5 flips USE_RESEARCH_CONDUCTING_PARAMS to true.

export const LEGACY_PARAMS = {
  // Downbeat detection (matches src/orchestra/ConductingEngine.js + phone.js)
  DOWNBEAT_ACCEL_THRESHOLD: 2.0,    // m/s²
  DOWNBEAT_MIN_INTERVAL_MS: 250,
  DOWNBEAT_WINDOW_MS: 150,

  // Gesture size → gain band (consumed by OrchestraEngine)
  GESTURE_SIZE_WINDOW_MS: 2000,
  GESTURE_SIZE_RANGE: 5.0,          // m/s² peak-to-peak that maps to 1.0
  GESTURE_SIZE_GAIN_MIN: 0.15,
  GESTURE_SIZE_GAIN_MAX: 1.0,

  // One Euro filter params — disabled in legacy mode (use raw input).
  ONE_EURO_ORIENTATION: null,
  ONE_EURO_ACCEL: null,

  // Articulation
  ARTICULATION_JERK_RANGE: 3.0,     // m/s³ that maps to 1.0
}

export const RESEARCH_PARAMS = {
  DOWNBEAT_ACCEL_THRESHOLD: 4.0,
  DOWNBEAT_MIN_INTERVAL_MS: 300,
  DOWNBEAT_WINDOW_MS: 150,

  GESTURE_SIZE_WINDOW_MS: 2000,
  GESTURE_SIZE_RANGE: 5.0,
  GESTURE_SIZE_GAIN_MIN: 0.5,       // ±6 dB → 0.5× linear
  GESTURE_SIZE_GAIN_MAX: 2.0,       // ±6 dB → 2.0× linear

  ONE_EURO_ORIENTATION: { mincutoff: 1.0, beta: 0.007, dcutoff: 1.0 },
  ONE_EURO_ACCEL:       { mincutoff: 0.5, beta: 0.005, dcutoff: 1.0 },

  ARTICULATION_JERK_RANGE: 3.0,
}

// Feature flags — flip to true in step 5/6, default false through steps 1-4.
export const USE_RESEARCH_CONDUCTING_PARAMS = false
export const ENABLE_GYRO_ENERGY_COUPLING    = false

export function activeParams() {
  return USE_RESEARCH_CONDUCTING_PARAMS ? RESEARCH_PARAMS : LEGACY_PARAMS
}
```

- [ ] **Step 2: Create `src/conducting/index.js` (placeholder)**

```js
// Public surface for the conducting core. Filled in by subsequent tasks.
export { LEGACY_PARAMS, RESEARCH_PARAMS, activeParams,
         USE_RESEARCH_CONDUCTING_PARAMS, ENABLE_GYRO_ENERGY_COUPLING }
  from './constants.js'
```

- [ ] **Step 3: Verify nothing imports from this yet**

Run: `grep -rn "src/conducting" src/ conduct-relay/ scripts/`
Expected: only the two files we just created — no consumers yet.

- [ ] **Step 4: Commit**

```bash
git add src/conducting/constants.js src/conducting/index.js
git commit -m "feat(conducting): scaffold src/conducting/ with dual param sets

LEGACY_PARAMS matches the pre-refactor behavior byte-for-byte; RESEARCH_PARAMS
applies the spec from Research/gesture-felt-agency-phone-as-baton.md. Two
feature flags (USE_RESEARCH_CONDUCTING_PARAMS, ENABLE_GYRO_ENERGY_COUPLING)
gate the behavioral changes that arrive in steps 5-6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.2: Extract quaternion helpers + add `unwrapAngle`

**Files:**
- Create: `src/conducting/quaternion.js`
- Create: `src/conducting/__tests__/quaternion.test.js`

- [ ] **Step 1: Write failing test `src/conducting/__tests__/quaternion.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { quatFromEulerZXY, quatMul, quatConj, unwrapAngle }
  from '../quaternion.js'

describe('quatFromEulerZXY', () => {
  it('returns identity quat for zero angles', () => {
    const q = quatFromEulerZXY(0, 0, 0)
    expect(q[0]).toBeCloseTo(0, 5)
    expect(q[1]).toBeCloseTo(0, 5)
    expect(q[2]).toBeCloseTo(0, 5)
    expect(q[3]).toBeCloseTo(1, 5)
  })

  it('produces a unit quaternion for arbitrary input', () => {
    const q = quatFromEulerZXY(45, 30, 60)
    const len = Math.hypot(q[0], q[1], q[2], q[3])
    expect(len).toBeCloseTo(1, 5)
  })
})

describe('quatMul', () => {
  it('identity × q = q', () => {
    const id = [0, 0, 0, 1]
    const q = [0.1, 0.2, 0.3, Math.sqrt(1 - 0.01 - 0.04 - 0.09)]
    const r = quatMul(id, q)
    for (let i = 0; i < 4; i++) expect(r[i]).toBeCloseTo(q[i], 5)
  })
})

describe('quatConj', () => {
  it('negates x/y/z, preserves w', () => {
    expect(quatConj([1, 2, 3, 4])).toEqual([-1, -2, -3, 4])
  })
})

describe('unwrapAngle', () => {
  it('returns delta with sign across 0° boundary', () => {
    // current=358, previous=2 → naive diff -356, unwrapped delta +4
    expect(unwrapAngle(358, 2)).toBeCloseTo(-4, 5)
    expect(unwrapAngle(2, 358)).toBeCloseTo(4, 5)
  })

  it('handles 180° boundary (ambiguous — pick shortest)', () => {
    // 179 → -179: shortest delta is +2 (going through 180)
    expect(Math.abs(unwrapAngle(-179, 179))).toBeCloseTo(2, 5)
  })

  it('returns zero for identical angles', () => {
    expect(unwrapAngle(45, 45)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/conducting/__tests__/quaternion.test.js`
Expected: FAIL — `Failed to resolve import "../quaternion.js"`

- [ ] **Step 3: Create `src/conducting/quaternion.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/conducting/__tests__/quaternion.test.js`
Expected: 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/conducting/quaternion.js src/conducting/__tests__/quaternion.test.js
git commit -m "feat(conducting): extract quaternion helpers + add unwrapAngle

Lifted from conduct-relay/public/phone.js verbatim. unwrapAngle is new —
needed for 1€ filtering of compass heading (alpha) to avoid the 359°→1°
boundary producing a -358° derivative spike that would destroy filter state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.3: Implement OneEuroFilter (used in step 5, scaffolded now)

**Files:**
- Create: `src/conducting/OneEuroFilter.js`
- Create: `src/conducting/__tests__/OneEuroFilter.test.js`

The filter is added now so step 5 only flips a flag rather than introducing new code. In steps 1–4 it's instantiated but never called (`activeParams().ONE_EURO_ORIENTATION` is null).

- [ ] **Step 1: Write failing test `src/conducting/__tests__/OneEuroFilter.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { OneEuroFilter } from '../OneEuroFilter.js'

describe('OneEuroFilter', () => {
  it('first sample passes through unchanged', () => {
    const f = new OneEuroFilter({ mincutoff: 1.0, beta: 0.007 })
    expect(f.filter(42, 0)).toBeCloseTo(42, 5)
  })

  it('smooths a noisy signal toward its mean at rest', () => {
    const f = new OneEuroFilter({ mincutoff: 1.0, beta: 0.0 })
    // Feed 30 noisy samples around 100 at 60 Hz
    let last = 0
    for (let i = 0; i < 30; i++) {
      const noise = (i % 3 === 0 ? 2 : -2)
      last = f.filter(100 + noise, i / 60)
    }
    // Should be much closer to 100 than the ±2 raw noise band
    expect(Math.abs(last - 100)).toBeLessThan(0.6)
  })

  it('tracks a ramp with low lag when beta is high', () => {
    const fAggressive = new OneEuroFilter({ mincutoff: 1.0, beta: 1.0 })
    const fConservative = new OneEuroFilter({ mincutoff: 1.0, beta: 0.0 })
    let aggressive = 0, conservative = 0
    for (let i = 0; i < 60; i++) {
      aggressive   = fAggressive.filter(i, i / 60)
      conservative = fConservative.filter(i, i / 60)
    }
    // Aggressive filter should be closer to the actual ramp value (59)
    expect(59 - aggressive).toBeLessThan(59 - conservative)
  })

  it('reset() clears state — next sample is treated as first', () => {
    const f = new OneEuroFilter({ mincutoff: 1.0, beta: 0.007 })
    for (let i = 0; i < 10; i++) f.filter(50, i / 60)
    f.reset()
    expect(f.filter(200, 0)).toBeCloseTo(200, 5)
  })

  it('handles zero dt without NaN (duplicate timestamp)', () => {
    const f = new OneEuroFilter({ mincutoff: 1.0, beta: 0.007 })
    f.filter(10, 0.5)
    const out = f.filter(20, 0.5)  // same timestamp
    expect(Number.isFinite(out)).toBe(true)
  })

  it('handles a large dt gap (tab suspended then resumed)', () => {
    const f = new OneEuroFilter({ mincutoff: 1.0, beta: 0.007 })
    f.filter(10, 0)
    const out = f.filter(11, 30)  // 30 s later — tab was backgrounded
    expect(Number.isFinite(out)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/conducting/__tests__/OneEuroFilter.test.js`
Expected: FAIL — `Failed to resolve import "../OneEuroFilter.js"`

- [ ] **Step 3: Implement `src/conducting/OneEuroFilter.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/conducting/__tests__/OneEuroFilter.test.js`
Expected: 6 tests passing.

- [ ] **Step 5: Re-export from index**

Edit `src/conducting/index.js`:

```js
export { OneEuroFilter } from './OneEuroFilter.js'
export { quatFromEulerZXY, quatMul, quatConj, unwrapAngle }
  from './quaternion.js'
export { LEGACY_PARAMS, RESEARCH_PARAMS, activeParams,
         USE_RESEARCH_CONDUCTING_PARAMS, ENABLE_GYRO_ENERGY_COUPLING }
  from './constants.js'
```

- [ ] **Step 6: Commit**

```bash
git add src/conducting/OneEuroFilter.js src/conducting/__tests__/OneEuroFilter.test.js src/conducting/index.js
git commit -m "feat(conducting): add OneEuroFilter pure class with edge-case tests

Reference: Casiez/Roussel/Vogel CHI 2012. Two-stage low-pass with adaptive
cutoff. Edge cases per Codex review: first sample passthrough, dt≤0 from
duplicate timestamps, large dt from tab suspension, reset() flushes state.

Not consumed yet — wired into GestureCore in step 5 via the
USE_RESEARCH_CONDUCTING_PARAMS flag.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.4: Implement GestureCore with golden-master tests

**Files:**
- Create: `src/conducting/GestureCore.js`
- Create: `src/conducting/__tests__/GestureCore.test.js`

Golden-master tests assert the **exact current behavior** so refactor regressions are caught. Research-mode tests come in step 5.

- [ ] **Step 1: Write failing test `src/conducting/__tests__/GestureCore.test.js`**

```js
import { describe, it, expect } from 'vitest'
import {
  createState, processMotion, processOrientation, calibrate, read,
} from '../GestureCore.js'
import { LEGACY_PARAMS } from '../constants.js'

const PARAMS = LEGACY_PARAMS

function makeMotion({ ax = 0, ay = 0, az = 0,
                      rotAlpha = 0, rotBeta = 0, rotGamma = 0,
                      gravity = false } = {}) {
  return gravity
    ? { acceleration: null, accelerationIncludingGravity: { x: ax, y: ay, z: az },
        rotationRate: { alpha: rotAlpha, beta: rotBeta, gamma: rotGamma } }
    : { acceleration: { x: ax, y: ay, z: az },
        accelerationIncludingGravity: { x: ax, y: ay, z: az - 9.8 },
        rotationRate: { alpha: rotAlpha, beta: rotBeta, gamma: rotGamma } }
}

describe('GestureCore — downbeat detection (LEGACY)', () => {
  it('fires when peak-Y exceeds 2.0 m/s² and prev<0, curr≥0', () => {
    const s = createState({ params: PARAMS })
    // Feed a downward swing followed by zero-crossing
    processMotion(s, makeMotion({ ay: -3.0 }), 0)
    processMotion(s, makeMotion({ ay: -1.5 }), 16)
    processMotion(s, makeMotion({ ay:  0.1 }), 32)  // zero-crossing
    const snap = read(s, 32)
    expect(snap.downbeat.fired).toBe(true)
    expect(snap.downbeat.intensity).toBeGreaterThan(0)
  })

  it('does NOT fire when peak-Y is below 2.0', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ay: -1.5 }), 0)
    processMotion(s, makeMotion({ ay:  0.1 }), 16)
    expect(read(s, 16).downbeat.fired).toBe(false)
  })

  it('enforces 250 ms refractory', () => {
    const s = createState({ params: PARAMS })
    // First downbeat
    processMotion(s, makeMotion({ ay: -3.0 }), 0)
    processMotion(s, makeMotion({ ay:  0.1 }), 16)
    expect(read(s, 16).downbeat.fired).toBe(true)
    // Second qualifying motion 100ms later — must be suppressed
    processMotion(s, makeMotion({ ay: -3.0 }), 100)
    processMotion(s, makeMotion({ ay:  0.1 }), 116)
    expect(read(s, 116).downbeat.fired).toBe(false)
    // Third one ≥250 ms after the first — must fire
    processMotion(s, makeMotion({ ay: -3.0 }), 260)
    processMotion(s, makeMotion({ ay:  0.1 }), 276)
    expect(read(s, 276).downbeat.fired).toBe(true)
  })

  it('consumes the downbeat flag — re-reading without new motion returns fired=false', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ay: -3.0 }), 0)
    processMotion(s, makeMotion({ ay:  0.1 }), 16)
    expect(read(s, 16).downbeat.fired).toBe(true)
    expect(read(s, 17).downbeat.fired).toBe(false)
  })

  it('downbeat snapshot includes detection timestamp (Codex risk: event ordering)', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ay: -3.0 }), 100)
    processMotion(s, makeMotion({ ay:  0.1 }), 116)
    const snap = read(s, 200)  // read long after detection
    expect(snap.downbeat.fired).toBe(true)
    expect(snap.downbeat.detectedAt).toBe(116)
  })
})

describe('GestureCore — gesture size (LEGACY)', () => {
  it('returns 0 with no motion', () => {
    const s = createState({ params: PARAMS })
    expect(read(s, 0).gestureGain).toBe(0)
  })

  it('saturates at GESTURE_SIZE_RANGE (5.0 m/s²) peak-to-peak', () => {
    const s = createState({ params: PARAMS })
    // Build a 0 → 5 m/s² peak-to-peak over 200ms (well inside the 2s window)
    for (let i = 0; i < 12; i++) {
      const ax = i % 2 === 0 ? 2.5 : -2.5  // ±2.5 → mag 2.5 each
      processMotion(s, makeMotion({ ax }), i * 16)
    }
    expect(read(s, 200).gestureGain).toBeCloseTo(1.0, 1)
  })
})

describe('GestureCore — articulation (LEGACY)', () => {
  it('is non-zero when |rms - prevRms| changes rapidly', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ax: 0 }), 0)
    processMotion(s, makeMotion({ ax: 5 }), 16)  // big jerk
    expect(read(s, 16).articulation).toBeGreaterThan(0)
  })
})

describe('GestureCore — exposed rich signals', () => {
  it('snapshot includes yaw (from alpha), rotationRate, per-axis accel', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ax: 1.1, ay: 2.2, az: 3.3,
                                  rotAlpha: 10, rotBeta: 20, rotGamma: 30 }), 0)
    processOrientation(s, { alpha: 45, beta: 30, gamma: -15 }, 0)
    const snap = read(s, 0)
    expect(snap.accel.x).toBeCloseTo(1.1)
    expect(snap.accel.y).toBeCloseTo(2.2)
    expect(snap.accel.z).toBeCloseTo(3.3)
    expect(snap.rotationRate.mag).toBeCloseTo(Math.hypot(10, 20, 30))
    expect(snap.yaw).toBeCloseTo(45)
  })

  it('reports gravityBiased=true when only accelerationIncludingGravity is available', () => {
    const s = createState({ params: PARAMS })
    processMotion(s, makeMotion({ ax: 0, ay: 0, az: 9.8, gravity: true }), 0)
    expect(read(s, 0).gravityBiased).toBe(true)
  })
})

describe('GestureCore — calibration', () => {
  it('baselines beta/gamma from samples collected since last calibrate()', () => {
    const s = createState({ params: PARAMS })
    processOrientation(s, { alpha: 0, beta: 70, gamma: -3 }, 0)
    processOrientation(s, { alpha: 0, beta: 80, gamma:  3 }, 16)
    calibrate(s)
    const snap = read(s, 16)
    expect(snap.baselineBeta).toBeCloseTo(75, 0)
    expect(snap.baselineGamma).toBeCloseTo(0, 0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/conducting/__tests__/GestureCore.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/conducting/GestureCore.js`**

```js
// GestureCore — pure-function gesture extractor.
//
// State shape:
//   {
//     params,                       // LEGACY_PARAMS | RESEARCH_PARAMS
//     yBuffer: [{y, t}],            // sliding window for downbeat detection
//     magBuffer: [{mag, t}],        // sliding window for gesture size
//     prevY, prevRms,
//     lastDownbeatTime,
//     pendingDownbeat,              // {fired, intensity, detectedAt} | null
//     rotationRate, accel,          // last raw samples
//     alpha, beta, gamma,           // last orientation read (post-filter)
//     baselineBeta, baselineGamma,  // calibration center
//     calibrationSamples,           // [{beta, gamma}] until calibrate() consumes
//     gestureGain, articulation,    // last computed
//     gravityBiased,                // last motion had no e.acceleration
//     filters: { ... }              // 1€ instances, null when params.ONE_EURO_* unset
//     _prevAlphaRaw, _filteredAlphaAbs   // alpha-wraparound bookkeeping
//   }
//
// Convention: all timestamps are in milliseconds, matching DeviceMotionEvent.

import { OneEuroFilter } from './OneEuroFilter.js'
import { unwrapAngle } from './quaternion.js'

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

export function createState({ params }) {
  if (!params) throw new Error('GestureCore.createState requires params')

  const orientation = params.ONE_EURO_ORIENTATION
  const accel       = params.ONE_EURO_ACCEL

  return {
    params,
    yBuffer: [],
    magBuffer: [],
    prevY: 0,
    prevRms: 0,
    lastDownbeatTime: 0,
    pendingDownbeat: null,
    rotationRate: { alpha: 0, beta: 0, gamma: 0, mag: 0 },
    accel: { x: 0, y: 0, z: 0 },
    alpha: 0, beta: 0, gamma: 0,
    baselineBeta: 75, baselineGamma: 0,
    calibrationSamples: [],
    gestureGain: 0,
    articulation: 0,
    gravityBiased: false,
    filters: {
      alpha: orientation ? new OneEuroFilter(orientation) : null,
      beta:  orientation ? new OneEuroFilter(orientation) : null,
      gamma: orientation ? new OneEuroFilter(orientation) : null,
      ax:    accel ? new OneEuroFilter(accel) : null,
      ay:    accel ? new OneEuroFilter(accel) : null,
      az:    accel ? new OneEuroFilter(accel) : null,
    },
    _prevAlphaRaw: null,
    _filteredAlphaAbs: null,
  }
}

export function processMotion(state, e, now) {
  const usingGravityFallback = !(e.acceleration && e.acceleration.x != null)
  const a = usingGravityFallback ? (e.accelerationIncludingGravity || {}) : e.acceleration
  state.gravityBiased = usingGravityFallback

  // Optional 1€ filter on accel — only active when params provide settings
  const ax = state.filters.ax ? state.filters.ax.filter(a.x || 0, now / 1000) : (a.x || 0)
  const ay = state.filters.ay ? state.filters.ay.filter(a.y || 0, now / 1000) : (a.y || 0)
  const az = state.filters.az ? state.filters.az.filter(a.z || 0, now / 1000) : (a.z || 0)
  state.accel = { x: ax, y: ay, z: az }

  const rr = e.rotationRate || {}
  const rrA = rr.alpha || 0, rrB = rr.beta || 0, rrG = rr.gamma || 0
  state.rotationRate = {
    alpha: rrA, beta: rrB, gamma: rrG,
    mag: Math.hypot(rrA, rrB, rrG),
  }

  const rms = Math.sqrt(ax * ax + ay * ay + az * az)
  const jerk = Math.abs(rms - state.prevRms)
  state.prevRms = rms

  // Downbeat — negative-Y peak followed by zero-crossing
  const P = state.params
  state.yBuffer.push({ y: ay, t: now })
  const yCutoff = now - P.DOWNBEAT_WINDOW_MS
  while (state.yBuffer.length && state.yBuffer[0].t < yCutoff) state.yBuffer.shift()

  if (state.prevY < 0 && ay >= 0) {
    let peakNegY = 0
    for (const sample of state.yBuffer) if (sample.y < peakNegY) peakNegY = sample.y
    const peakMag = Math.abs(peakNegY)
    if (
      peakMag >= P.DOWNBEAT_ACCEL_THRESHOLD &&
      now - state.lastDownbeatTime >= P.DOWNBEAT_MIN_INTERVAL_MS
    ) {
      state.pendingDownbeat = {
        fired: true,
        intensity: clamp(peakMag / (P.DOWNBEAT_ACCEL_THRESHOLD * 3), 0, 1),
        detectedAt: now,
      }
      state.lastDownbeatTime = now
    }
  }
  state.prevY = ay

  // Gesture size — peak-to-peak in rolling window
  state.magBuffer.push({ mag: rms, t: now })
  const magCutoff = now - P.GESTURE_SIZE_WINDOW_MS
  while (state.magBuffer.length && state.magBuffer[0].t < magCutoff) state.magBuffer.shift()
  let minMag = Infinity, maxMag = -Infinity
  for (const sample of state.magBuffer) {
    if (sample.mag < minMag) minMag = sample.mag
    if (sample.mag > maxMag) maxMag = sample.mag
  }
  state.gestureGain = state.magBuffer.length > 0
    ? clamp((maxMag - minMag) / P.GESTURE_SIZE_RANGE, 0, 1)
    : 0

  state.articulation = clamp(jerk / P.ARTICULATION_JERK_RANGE, 0, 1)
}

export function processOrientation(state, e, now) {
  // iOS Safari exposes webkitCompassHeading (true compass, 0=N, clockwise).
  // Standard DeviceOrientationEvent.alpha is counter-clockwise from north.
  // Convert iOS reading to the alpha convention so consumers see one signal
  // type (Codex risk #2).
  const rawAlpha = (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading))
    ? (360 - e.webkitCompassHeading) % 360   // clockwise → counter-clockwise
    : (e.alpha || 0)
  const rawBeta  = e.beta  || 0
  const rawGamma = e.gamma || 0

  // Alpha — filter on the unwrapped absolute representation so the filter
  // never sees a 358° jump (Codex risk #1).
  if (state.filters.alpha) {
    if (state._filteredAlphaAbs == null) {
      state._filteredAlphaAbs = rawAlpha
      state.alpha = rawAlpha
    } else {
      const delta = unwrapAngle(rawAlpha, state._prevAlphaRaw)
      state._filteredAlphaAbs += delta
      const filteredAbs = state.filters.alpha.filter(state._filteredAlphaAbs, now / 1000)
      state.alpha = ((filteredAbs % 360) + 360) % 360
    }
  } else {
    state.alpha = rawAlpha
  }
  state._prevAlphaRaw = rawAlpha

  // Beta + gamma — simple 1€ filter (no wraparound needed; valid ranges are
  // [-180, 180] and [-90, 90] respectively, and conducting motion doesn't
  // cross those boundaries).
  state.beta  = state.filters.beta  ? state.filters.beta.filter(rawBeta,  now / 1000) : rawBeta
  state.gamma = state.filters.gamma ? state.filters.gamma.filter(rawGamma, now / 1000) : rawGamma

  if (state.calibrationSamples) {
    state.calibrationSamples.push({ beta: rawBeta, gamma: rawGamma })
  }
}

export function calibrate(state) {
  const samples = state.calibrationSamples
  if (samples && samples.length > 0) {
    let sumB = 0, sumG = 0
    for (const s of samples) { sumB += s.beta; sumG += s.gamma }
    state.baselineBeta  = sumB / samples.length
    state.baselineGamma = sumG / samples.length
  }
  state.calibrationSamples = []

  // Reset 1€ filter state on calibration (Codex risk #3) — old samples must
  // not bleed into the new neutral baseline.
  for (const k of ['alpha', 'beta', 'gamma', 'ax', 'ay', 'az']) {
    if (state.filters[k]) state.filters[k].reset()
  }
  state._prevAlphaRaw = null
  state._filteredAlphaAbs = null
}

export function read(state, now) {
  // Compute backwards-compatible pan/filterNorm from gamma/beta + baselines.
  const gammaOffset = state.gamma - state.baselineGamma
  const betaOffset  = state.beta  - state.baselineBeta
  const pan = clamp((gammaOffset + 45) / 90, 0, 1)
  const filterNorm = clamp((betaOffset + 45) / 90, 0, 1)

  // Yaw: filtered alpha in degrees. iOS uses webkitCompassHeading when
  // available (true compass); Android uses alpha as-is.
  const yaw = state.alpha

  // Downbeat — consume the one-shot
  const downbeat = state.pendingDownbeat
    ? { ...state.pendingDownbeat }
    : { fired: false, intensity: 0, detectedAt: 0 }
  state.pendingDownbeat = null

  return {
    pan, filterNorm,
    gestureGain: state.gestureGain,
    articulation: state.articulation,
    downbeat,
    // Newly exposed signals
    yaw,
    beta: state.beta,
    gamma: state.gamma,
    rotationRate: { ...state.rotationRate },
    accel: { ...state.accel },
    baselineBeta: state.baselineBeta,
    baselineGamma: state.baselineGamma,
    gravityBiased: state.gravityBiased,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/conducting/__tests__/GestureCore.test.js`
Expected: 11 tests passing.

- [ ] **Step 5: Update index.js exports**

```js
// src/conducting/index.js — final
export { OneEuroFilter } from './OneEuroFilter.js'
export { quatFromEulerZXY, quatMul, quatConj, unwrapAngle }
  from './quaternion.js'
export {
  LEGACY_PARAMS, RESEARCH_PARAMS, activeParams,
  USE_RESEARCH_CONDUCTING_PARAMS, ENABLE_GYRO_ENERGY_COUPLING,
} from './constants.js'
export { createState, processMotion, processOrientation, calibrate, read }
  from './GestureCore.js'
```

- [ ] **Step 6: Run full test suite to confirm no regression elsewhere**

Run: `npm test`
Expected: all 125 existing tests pass + new conducting tests = 142+ passing.

- [ ] **Step 7: Commit**

```bash
git add src/conducting/GestureCore.js src/conducting/__tests__/GestureCore.test.js src/conducting/index.js
git commit -m "feat(conducting): implement GestureCore with LEGACY golden-master tests

Pure-function gesture extractor matching the byte-for-byte behavior of the
current ConductingEngine + phone.js implementations. Exposes the richer
signal set (yaw, rotationRate, per-axis accel, gravityBiased,
downbeat.detectedAt) on the snapshot — backwards-compatible fields
(pan/filterNorm/gestureGain/articulation/downbeat) preserved.

1€ filtering is wired but inert: LEGACY_PARAMS.ONE_EURO_ORIENTATION is null,
so the filters never run. Step 5 flips USE_RESEARCH_CONDUCTING_PARAMS to
activate them.

Alpha wraparound is handled via unwrapAngle before filtering (Codex risk #1).
Calibration resets all filter state (Codex risk #3). Downbeats carry their
detection timestamp (Codex risk #4).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Step 2 — Migrate Orchestra's ConductingEngine to wrap GestureCore

**Goal:** Replace the duplicated logic in `src/orchestra/ConductingEngine.js` with thin DOM-binding code that delegates to `GestureCore`. Output shape of `getData()` stays additive-compatible.

### Task 2.1: Replace ConductingEngine internals

**Files:**
- Modify: `src/orchestra/ConductingEngine.js`

- [ ] **Step 1: Replace `src/orchestra/ConductingEngine.js` with the thin wrapper**

```js
import {
  createState, processMotion, processOrientation, calibrate as coreCalibrate, read,
  activeParams,
} from '../conducting/index.js'
import { CONDUCTING } from './constants.js'

/**
 * ConductingEngine — DOM bindings + touch fallback around GestureCore.
 *
 * Owns: DeviceMotionEvent / DeviceOrientationEvent listeners, iOS
 * permission request, touch-fallback input. All gesture math is delegated
 * to src/conducting/GestureCore.js.
 *
 * Output of getData() is backwards-compatible — same {pan, filterNorm,
 * gestureGain, articulation, downbeat} fields the Orchestra audio engine
 * has always consumed, plus newly exposed yaw, rotationRate, accel, and
 * gravityBiased for consumers that want them.
 */
export default class ConductingEngine {
  constructor() {
    this.hasPermission = false
    this.hasMotion = false

    this._state = createState({ params: activeParams() })

    // Touch fallback (desktop testing)
    this._touchX = 0.5
    this._touchY = 0.5
    this._touchActive = false

    this._motionHandler = null
    this._orientationHandler = null
    this._calibrating = false
  }

  async requestPermission() {
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      try {
        const permission = await DeviceMotionEvent.requestPermission()
        this.hasPermission = permission === 'granted'
      } catch {
        this.hasPermission = false
      }
    } else {
      this.hasPermission = true
    }
    return this.hasPermission
  }

  start() {
    if (!this.hasPermission) return

    this._motionHandler = (e) => {
      this.hasMotion = true
      processMotion(this._state, e, performance.now())
    }
    this._orientationHandler = (e) => {
      processOrientation(this._state, e, performance.now())
    }

    window.addEventListener('devicemotion', this._motionHandler, { passive: true })
    window.addEventListener('deviceorientation', this._orientationHandler, { passive: true })

    this.startCalibration()
  }

  startCalibration(durationMs) {
    const duration = durationMs || CONDUCTING.CALIBRATION_DURATION_MS
    return new Promise((resolve) => {
      this._calibrating = true
      setTimeout(() => {
        coreCalibrate(this._state)
        this._calibrating = false
        resolve()
      }, duration)
    })
  }

  getData() {
    if (!this.hasMotion) return this._getTouchData()
    return read(this._state, performance.now())
  }

  _getTouchData() {
    return {
      pan: this._touchX,
      filterNorm: this._touchY,
      gestureGain: this._touchActive ? 0.6 : 0.2,
      articulation: 0,
      downbeat: { fired: false, intensity: 0, detectedAt: 0 },
      yaw: 0,
      rotationRate: { alpha: 0, beta: 0, gamma: 0, mag: 0 },
      accel: { x: 0, y: 0, z: 0 },
      baselineBeta: 75, baselineGamma: 0,
      gravityBiased: false,
    }
  }

  updateTouch(normalizedX, normalizedY, active) {
    this._touchX = normalizedX
    this._touchY = normalizedY
    this._touchActive = active
  }

  stop() {
    if (this._motionHandler) {
      window.removeEventListener('devicemotion', this._motionHandler)
    }
    if (this._orientationHandler) {
      window.removeEventListener('deviceorientation', this._orientationHandler)
    }
  }
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: 142+ tests pass — no behavior change yet because OrchestraEngine still reads only the legacy fields.

- [ ] **Step 3: Confirm production Orchestra phase still builds**

Run: `npm run build`
Expected: succeeds with no new warnings.

- [ ] **Step 4: Commit**

```bash
git add src/orchestra/ConductingEngine.js
git commit -m "refactor(orchestra): ConductingEngine wraps GestureCore (no behavior change)

ConductingEngine becomes a thin shell — DOM listeners, iOS permission, touch
fallback, calibration scheduling. All gesture extraction delegated to
src/conducting/GestureCore.js.

getData() output shape is additive-compatible: existing consumers
(OrchestraEngine.applyConducting) continue to read pan/filterNorm/
gestureGain/articulation/downbeat unchanged. New fields (yaw, rotationRate,
accel, gravityBiased, downbeat.detectedAt) are available but unconsumed
until step 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Step 3 — Bundle relay phone with esbuild

**Goal:** Move the relay's phone-side script to ES modules so it can import `GestureCore`. Output a single IIFE bundle served as `phone.bundle.js`. Relay WS message shape stays identical.

### Task 3.1: Add esbuild as a devDependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install esbuild**

Run: `npm install --save-dev esbuild@^0.27.0`
Expected: package.json devDependencies gains `esbuild`.

- [ ] **Step 2: Verify installation**

Run: `npx esbuild --version`
Expected: prints `0.27.x`.

- [ ] **Step 3: Commit (just the dep)**

```bash
git add package.json package-lock.json
git commit -m "build: add esbuild for bundling the relay phone script

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.2: Create new ESM entry point at `conduct-relay/src/phone.js`

**Files:**
- Create: `conduct-relay/src/phone.js`

This file imports `GestureCore` from `../../src/conducting/index.js`. Same DOM bindings as the old `conduct-relay/public/phone.js`. Same WS message shape so `motion.js` on the desktop side keeps working unchanged.

- [ ] **Step 1: Create `conduct-relay/src/phone.js`**

```js
import {
  createState, processMotion, processOrientation, calibrate as coreCalibrate, read,
  activeParams,
} from '../../src/conducting/index.js'

const startBtn = document.getElementById('start')
const calibrateBtn = document.getElementById('calibrate')
const statusEl = document.getElementById('status')
const dataEl = document.getElementById('data')

const SEND_INTERVAL_MS = 16  // ~60 Hz cap

const state = createState({ params: activeParams() })

let ws = null
let lastSentAt = 0
let zeroQuat = [0, 0, 0, 1]
let lastAbsQuat = [0, 0, 0, 1]
let calibrated = false
let hasSample = false

function setStatus(s) { statusEl.textContent = s }

function fmt(n, w = 7, p = 2) {
  if (n == null || Number.isNaN(n)) return '   —  '.padStart(w, ' ')
  return n.toFixed(p).padStart(w, ' ')
}

function connectWS() {
  const url = `wss://${location.host}/?role=phone`
  ws = new WebSocket(url)
  ws.addEventListener('open',  () => setStatus('Connected. Move the phone.'))
  ws.addEventListener('close', () => setStatus('Disconnected.'))
  ws.addEventListener('error', () => setStatus('WebSocket error.'))
}

// Quaternion helpers stay inlined here — they're consumed by the WS payload,
// not GestureCore. (GestureCore exposes alpha/beta/gamma + rotationRate +
// per-axis accel; the desktop motion.js decoder builds quats from raw.)
import { quatFromEulerZXY, quatMul, quatConj } from '../../src/conducting/quaternion.js'

function onMotion(e) {
  processMotion(state, e, performance.now())
}

function onOrientation(e) {
  const now = performance.now()
  processOrientation(state, e, now)

  // Build absolute + relative quats for the WS payload
  const qAbs = quatFromEulerZXY(e.alpha, e.beta, e.gamma)
  lastAbsQuat = qAbs
  if (!hasSample) {
    hasSample = true
    calibrateBtn.disabled = false
  }
  const qRel = quatMul(quatConj(zeroQuat), qAbs)

  if (now - lastSentAt < SEND_INTERVAL_MS) {
    updateDataReadout(e, qRel)
    return
  }
  lastSentAt = now

  const snap = read(state, now)

  // WS message shape stays identical to the pre-refactor format so the
  // desktop motion.js decoder works unchanged.
  const msg = {
    type: 'gesture',
    q: qRel,
    raw: { alpha: e.alpha, beta: e.beta, gamma: e.gamma },
    downbeat: snap.downbeat.fired
      ? { fired: true, intensity: snap.downbeat.intensity, t: snap.downbeat.detectedAt }
      : null,
    gestureGain: snap.gestureGain,
    articulation: snap.articulation,
    rotationRate: snap.rotationRate,
    accel: snap.accel,
    calibrated,
    t: now,
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
  // Haptic on phone for downbeats (Personal Orchestra: diegetic feedback)
  if (snap.downbeat.fired && typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(15) } catch { /* tolerate denied */ }
  }
  updateDataReadout(e, qRel, snap)
}

function updateDataReadout(e, qRel, snap = null) {
  dataEl.textContent =
    `α: ${fmt(e.alpha)}°  β: ${fmt(e.beta)}°  γ: ${fmt(e.gamma)}°\n` +
    `q: [${fmt(qRel[0], 6, 3)}, ${fmt(qRel[1], 6, 3)}, ${fmt(qRel[2], 6, 3)}, ${fmt(qRel[3], 6, 3)}]\n` +
    (snap ? `gain: ${fmt(snap.gestureGain, 5, 2)}  artic: ${fmt(snap.articulation, 5, 2)}  ` : '') +
    `calibrated: ${calibrated ? 'yes' : 'no'}`
}

function calibrate() {
  zeroQuat = lastAbsQuat.slice()
  coreCalibrate(state)
  calibrated = true
  calibrateBtn.classList.add('flash')
  setTimeout(() => calibrateBtn.classList.remove('flash'), 220)
}

async function start() {
  startBtn.disabled = true
  setStatus('Starting…')
  try {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      const r = await DeviceOrientationEvent.requestPermission()
      if (r !== 'granted') {
        setStatus('Permission denied.')
        startBtn.disabled = false
        return
      }
    }
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      try {
        const r = await DeviceMotionEvent.requestPermission()
        if (r !== 'granted') {
          setStatus('Motion permission denied — downbeats disabled.')
        }
      } catch { /* tolerate */ }
    }
    if (!('DeviceOrientationEvent' in window)) {
      setStatus('DeviceOrientationEvent not supported in this browser.')
      startBtn.disabled = false
      return
    }
    connectWS()
    window.addEventListener('deviceorientation', onOrientation)
    if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', onMotion)
    }
    startBtn.textContent = 'Streaming'
  } catch (err) {
    setStatus('Error: ' + (err && err.message ? err.message : String(err)))
    startBtn.disabled = false
  }
}

startBtn.addEventListener('click', start)
calibrateBtn.addEventListener('click', calibrate)
```

- [ ] **Step 2: Verify it does NOT break existing relay (we haven't switched the HTML yet)**

Run: `ls conduct-relay/public/phone.js`
Expected: still exists.

- [ ] **Step 3: Commit (entry source, not yet wired)**

```bash
git add conduct-relay/src/phone.js
git commit -m "feat(relay): add ESM entry conduct-relay/src/phone.js

New entry point that imports GestureCore. Bundled in next commit via
esbuild. The legacy conduct-relay/public/phone.js stays in place until
the bundle is wired in via phone.html.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.3: Add esbuild build script + npm wiring

**Files:**
- Create: `scripts/build-relay-phone.js`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `scripts/build-relay-phone.js`**

```js
#!/usr/bin/env node
// Bundles conduct-relay/src/phone.js → conduct-relay/public/phone.bundle.js
//
// Single-file IIFE so the relay server.cjs can serve it as a plain <script>
// without ESM resolution. Browser target = es2020 (matches the rest of the
// app's runtime expectations).
//
// Usage:
//   node scripts/build-relay-phone.js          # one-shot build
//   node scripts/build-relay-phone.js --watch  # rebuild on changes
//
// Invoked by:
//   npm run build:relay-phone
//   npm run dev:relay  (runs --watch + node conduct-relay/server.cjs)

import * as esbuild from 'esbuild'

const watch = process.argv.includes('--watch')

const config = {
  entryPoints: ['conduct-relay/src/phone.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  outfile: 'conduct-relay/public/phone.bundle.js',
  sourcemap: true,
  logLevel: 'info',
}

if (watch) {
  const ctx = await esbuild.context(config)
  await ctx.watch()
  console.log('[build-relay-phone] watching…')
} else {
  await esbuild.build(config)
  console.log('[build-relay-phone] built conduct-relay/public/phone.bundle.js')
}
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/build-relay-phone.js`

- [ ] **Step 3: Add scripts to package.json**

Edit the `"scripts"` block in `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run --passWithNoTests",
  "test:watch": "vitest",
  "gen:phase2": "node scripts/generate-phase2-assets.js",
  "build:relay-phone": "node scripts/build-relay-phone.js",
  "dev:relay": "npm run build:relay-phone && node conduct-relay/server.cjs",
  "relay": "npm run build:relay-phone && node conduct-relay/server.cjs"
}
```

(`relay` updates to build the bundle before launching — was previously just `node conduct-relay/server.cjs`. `dev:relay` is an alias kept for clarity.)

- [ ] **Step 4: Add bundle output to .gitignore**

Append to `.gitignore`:

```gitignore

# Generated by scripts/build-relay-phone.js
conduct-relay/public/phone.bundle.js
conduct-relay/public/phone.bundle.js.map
```

- [ ] **Step 5: Run the build to confirm it works**

Run: `npm run build:relay-phone`
Expected: prints `[build-relay-phone] built conduct-relay/public/phone.bundle.js` and the file exists.

- [ ] **Step 6: Inspect the bundle output size**

Run: `wc -l conduct-relay/public/phone.bundle.js`
Expected: ~300–600 lines (GestureCore + OneEuroFilter + quaternion + phone.js code, bundled).

- [ ] **Step 7: Commit**

```bash
git add scripts/build-relay-phone.js package.json package-lock.json .gitignore
git commit -m "build(relay): add esbuild script for phone bundle

scripts/build-relay-phone.js produces conduct-relay/public/phone.bundle.js
(IIFE, es2020 target, sourcemap). The npm 'relay' script now builds before
launching server.cjs, and 'dev:relay' is an alias for clarity.

Bundle output is gitignored — checked in only as a build artifact when
needed. esbuild was added in the previous commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.4: Switch `phone.html` to load the bundle + delete legacy file

**Files:**
- Modify: `conduct-relay/public/phone.html`
- Delete: `conduct-relay/public/phone.js`

- [ ] **Step 1: Read `conduct-relay/public/phone.html` to locate the script tag**

Run: `grep -n "phone.js" conduct-relay/public/phone.html`
Expected: one or two matches (the `<script src>` line).

- [ ] **Step 2: Replace `phone.js` with `phone.bundle.js` in `phone.html`**

Open `conduct-relay/public/phone.html` and change:

```html
<script src="/phone.js"></script>
```

to:

```html
<script src="/phone.bundle.js"></script>
```

- [ ] **Step 3: Delete the legacy file**

Run: `git rm conduct-relay/public/phone.js`

- [ ] **Step 4: Build the bundle**

Run: `npm run build:relay-phone`

- [ ] **Step 5: Launch the relay and smoke-test in browser**

Run: `npm run relay`
Expected output includes `Phone: https://<your-IP>:8443/phone`.

In a browser, open `https://localhost:8443/phone` and confirm:
- The page loads with the start/calibrate buttons.
- The browser console shows no module-resolution errors.
- (If on a real phone) clicking Start prompts for motion permission.

- [ ] **Step 6: Commit**

```bash
git add conduct-relay/public/phone.html
git commit -m "build(relay): switch phone.html to phone.bundle.js + delete legacy phone.js

The legacy conduct-relay/public/phone.js (266 lines of duplicated gesture
math) is replaced by the esbuild output bundling conduct-relay/src/phone.js
+ src/conducting/. One source of truth now.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Step 4 — Smoke-test on real iOS device (gate)

**Goal:** Confirm steps 1–3 are a no-op user-facing change before moving to behavior modifications. This is the **hard gate** — if anything feels different from before, find the regression before proceeding.

### Task 4.1: Smoke test the Orchestra phone-native path

**Files:** (none — manual test)

- [ ] **Step 1: Verify dev server runs**

Run: `npm run dev`
Expected: Vite starts on the usual port. Open the URL from a real iOS device (iPhone Safari).

- [ ] **Step 2: Walk through all 9 phases to reach Orchestra**

On the device, complete entry → spectrum → depth → gems → moment → autobio → reflection → reveal → orchestra.

- [ ] **Step 3: In Orchestra phase, check the following**

- [ ] Briefing screen renders the baton SVG and the 12-second silent threshold completes.
- [ ] Bloom phase fades in audio over ~24 seconds.
- [ ] Tilting the phone left/right pans the stems audibly.
- [ ] Tilting forward/back changes filter brightness audibly.
- [ ] A vertical down-up gesture triggers a perceptible accent (gain spike + filter resonance + percussive click).
- [ ] Holding the phone still drops the gesture-size gain to ~15% (consistent with `LEGACY_PARAMS.GESTURE_SIZE_GAIN_MIN`).
- [ ] Closing card renders the Forer last-sentence after the song ends.

If anything feels different from before the refactor, STOP and investigate before proceeding to step 5.

### Task 4.2: Smoke test the /conduct-glb desktop relay path

**Files:** (none — manual test)

- [ ] **Step 1: Launch the relay**

Run: `npm run relay`

- [ ] **Step 2: Open desktop side**

In a desktop browser, open `https://localhost:8443/desktop`. Accept the self-signed cert. Then in another tab open the main Vite dev server (`npm run dev`) and navigate to `/conduct-glb`.

- [ ] **Step 3: Open phone side**

On a real iOS device, open `https://<your-LAN-IP>:8443/phone`. Accept cert, tap Start, grant motion permission.

- [ ] **Step 4: In `/conduct-glb`, check the following**

- [ ] The relay status panel shows "connected" once the phone WS connects.
- [ ] Tilting the phone moves the cursor on the parchment canvas.
- [ ] Vertical down-up gestures fire star bursts within 180px of the cursor.
- [ ] Activating a sequence of nodes inscribes Metatron edges (visible as bright gold lines).
- [ ] Tapping "calibrate" on the phone re-zeros the cursor to center.

If anything feels different from before the refactor, STOP and investigate.

### Task 4.3: Commit a "verification" marker if both pass

- [ ] **Step 1: If both smoke tests pass**

Run: `git tag conducting-refactor-verified-legacy`
Run: `git push origin conducting-refactor-verified-legacy` (only if working on a remote branch)

This marks the safe rollback point before any behavior change.

If only the relay or only the Orchestra works, fix before proceeding — both must work in legacy mode before activating research mode.

---

## Step 5 — Apply research-aligned thresholds + 1€ filter behind flag

**Goal:** Flip `USE_RESEARCH_CONDUCTING_PARAMS` to `true` and confirm the four research changes ship correctly: 1€ filter on input streams (with all five Codex risks addressed), thresholds at 4 m/s² / 300 ms, gesture-size band ±6 dB.

### Task 5.1: Add research-mode tests in GestureCore

**Files:**
- Modify: `src/conducting/__tests__/GestureCore.test.js`

- [ ] **Step 1: Append research-mode test block to `GestureCore.test.js`**

```js
describe('GestureCore — RESEARCH params (validate higher thresholds)', () => {
  it('does NOT fire downbeat at 3.5 m/s² (between legacy 2.0 and research 4.0)', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    processMotion(s, makeMotion({ ay: -3.5 }), 0)
    processMotion(s, makeMotion({ ay:  0.1 }), 16)
    expect(read(s, 16).downbeat.fired).toBe(false)
  })

  it('fires downbeat at 4.5 m/s²', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    processMotion(s, makeMotion({ ay: -4.5 }), 0)
    processMotion(s, makeMotion({ ay:  0.1 }), 16)
    expect(read(s, 16).downbeat.fired).toBe(true)
  })

  it('enforces 300 ms refractory (suppresses second downbeat at 200ms)', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    processMotion(s, makeMotion({ ay: -5.0 }), 0)
    processMotion(s, makeMotion({ ay:  0.1 }), 16)
    expect(read(s, 16).downbeat.fired).toBe(true)
    processMotion(s, makeMotion({ ay: -5.0 }), 200)
    processMotion(s, makeMotion({ ay:  0.1 }), 216)
    expect(read(s, 216).downbeat.fired).toBe(false)
    processMotion(s, makeMotion({ ay: -5.0 }), 310)
    processMotion(s, makeMotion({ ay:  0.1 }), 326)
    expect(read(s, 326).downbeat.fired).toBe(true)
  })

  it('1€ filter is active on orientation streams', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    // Feed a jittery beta around 30°
    for (let i = 0; i < 30; i++) {
      const noisy = 30 + ((i % 3 === 0) ? 1.5 : -1.5)
      processOrientation(s, { alpha: 0, beta: noisy, gamma: 0 }, i * 16)
    }
    const snap = read(s, 30 * 16)
    // Filtered beta should be much closer to 30 than ±1.5 raw noise
    expect(snap.beta).toBeGreaterThan(28.5)
    expect(snap.beta).toBeLessThan(31.5)
  })

  it('handles alpha wraparound — feeding 358°→2° does not destroy filter state', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    processOrientation(s, { alpha: 358, beta: 0, gamma: 0 }, 0)
    processOrientation(s, { alpha: 1,   beta: 0, gamma: 0 }, 16)
    processOrientation(s, { alpha: 4,   beta: 0, gamma: 0 }, 32)
    const snap = read(s, 32)
    // Filtered alpha should be in the 0–10° range, NOT 180° from a spurious
    // -357° derivative spike.
    const a = snap.yaw
    const wrappedDistance = Math.min(a, 360 - a)
    expect(wrappedDistance).toBeLessThan(10)
  })

  it('calibrate() resets 1€ filter state — Codex risk #3', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    for (let i = 0; i < 30; i++) {
      processOrientation(s, { alpha: 0, beta: 30, gamma: 0 }, i * 16)
    }
    calibrate(s)
    // After reset + a new sample at 90°, the filter should treat it as the
    // first sample (passthrough), not blend it with the prior 30° history.
    processOrientation(s, { alpha: 0, beta: 90, gamma: 0 }, 30 * 16)
    const snap = read(s, 30 * 16)
    expect(snap.beta).toBeCloseTo(90, 1)
  })

  it('downbeat.detectedAt preserves the motion-event timestamp — Codex risk #4', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    processMotion(s, makeMotion({ ay: -5.0 }), 100)
    processMotion(s, makeMotion({ ay:  0.1 }), 116)
    const snap = read(s, 500)  // read far later
    expect(snap.downbeat.detectedAt).toBe(116)
  })

  it('reports gravityBiased=true on accelerationIncludingGravity fallback', () => {
    const s = createState({ params: RESEARCH_PARAMS })
    processMotion(s, makeMotion({ ax: 0, ay: 0, az: 9.8, gravity: true }), 0)
    expect(read(s, 0).gravityBiased).toBe(true)
  })
})
```

Also add `import { RESEARCH_PARAMS } from '../constants.js'` at the top.

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- src/conducting/__tests__/GestureCore.test.js`
Expected: 11 LEGACY tests + 8 RESEARCH tests = 19 passing.

- [ ] **Step 3: Commit**

```bash
git add src/conducting/__tests__/GestureCore.test.js
git commit -m "test(conducting): validate RESEARCH params + Codex risk mitigations

Adds 8 tests covering: research thresholds (4.0/300), 1€ filtering on
orientation, alpha wraparound, calibration-flushes-filter-state, downbeat
detectedAt timestamping, gravity-fallback flagging. All risks Codex flagged
in /tmp/codex-review.md §4 are now test-covered.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.2: Flip the research flag

**Files:**
- Modify: `src/conducting/constants.js`

- [ ] **Step 1: Set the flag to true**

Edit `src/conducting/constants.js`, change:

```js
export const USE_RESEARCH_CONDUCTING_PARAMS = false
```

to:

```js
export const USE_RESEARCH_CONDUCTING_PARAMS = true
```

Leave `ENABLE_GYRO_ENERGY_COUPLING` as `false` for now — that's step 6.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: all tests pass. LEGACY tests use `LEGACY_PARAMS` directly so they're unaffected by the flag flip; RESEARCH tests use `RESEARCH_PARAMS` directly.

- [ ] **Step 3: Rebuild the relay bundle (needed any time `src/conducting/` changes)**

Run: `npm run build:relay-phone`

- [ ] **Step 4: Smoke-test BOTH paths again**

Repeat Step 4 tasks 4.1 + 4.2 with research mode active.

What to expect that's **different** from legacy:
- Downbeats require sharper gestures (4 m/s² vs 2 m/s²) — soft taps no longer register.
- Refractory feels slightly longer (300 ms vs 250 ms) — fast double-taps now collapse to one accent.
- Pan/filter feel smoother (1€ filter active) — less jittery at rest, no perceptible lag during active conducting.
- Holding phone still no longer drops volume to 15%; it drops to 50% (gain band ±6 dB).

If any of these feel **worse** rather than just different, revert the flag and investigate. Possible culprits: 1€ params too aggressive for your specific device, threshold too high for soft-handed conducting, gain band too narrow.

- [ ] **Step 5: Commit**

```bash
git add src/conducting/constants.js
git commit -m "feat(conducting): activate research-aligned thresholds + 1€ filter

Flips USE_RESEARCH_CONDUCTING_PARAMS to true. Effects:
  - Downbeat threshold 2.0 → 4.0 m/s² (research §5.1, mitigates phantom doubles)
  - Refractory 250 → 300 ms
  - Gesture-size gain band 0.15-1.0× → 0.5-2.0× (±6 dB, research §3.1)
  - 1€ Filter on alpha/beta/gamma (mincutoff=1.0, beta=0.007)
  - 1€ Filter on accel.x/y/z (mincutoff=0.5, beta=0.005)
  - Alpha wraparound handled via unwrapAngle (Codex risk #1)
  - calibrate() resets all filter state (Codex risk #3)
  - downbeat.detectedAt timestamp preserved (Codex risk #4)
  - gravityBiased flag exposed when only accelerationIncludingGravity is available

ENABLE_GYRO_ENERGY_COUPLING remains false — Orchestra audio engine changes
ship separately in step 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Step 6 — Wire yaw + gyro into OrchestraEngine

**Goal:** Fix the yaw-on-roll bug in `OrchestraEngine.applyConducting()` and add the gyro→brightness cross-coupling. Gated by `ENABLE_GYRO_ENERGY_COUPLING`.

### Task 6.1: Switch facingDeg from pan-derived to yaw-derived (the bug fix)

**Files:**
- Modify: `src/orchestra/OrchestraEngine.js`

- [ ] **Step 1: Read the current `applyConducting()` to locate the bug**

Open `src/orchestra/OrchestraEngine.js` and find lines 328–395. The relevant lines are 336–337 (`panOffset = (pan - 0.5) * 2; facingDeg = panOffset * 90`).

- [ ] **Step 2: Update `applyConducting()` to consume `yaw` when the flag is on**

Replace the early lines of `applyConducting(params)` (currently at 328–337):

```js
applyConducting(params) {
  if (!params) return
  const now = this.ctx.currentTime
  const t = this._lastT
  const { pan, filterNorm, gestureGain, articulation, downbeat, yaw, rotationRate } = params

  // facingDeg = which direction the user is "facing". Research §3.5 says
  // this should come from compass heading (alpha/yaw), not roll. Gate
  // behind ENABLE_GYRO_ENERGY_COUPLING so legacy behavior is recoverable.
  let facingDeg
  if (ENABLE_GYRO_ENERGY_COUPLING && yaw != null) {
    // alpha is 0..360°. Map to -180..180° so spatial math works.
    facingDeg = yaw > 180 ? yaw - 360 : yaw
  } else {
    const panOffset = (pan - 0.5) * 2
    facingDeg = panOffset * 90
  }
```

Add the import at the top of `OrchestraEngine.js`:

```js
import { ENABLE_GYRO_ENERGY_COUPLING } from '../conducting/index.js'
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all pass — no test currently covers OrchestraEngine directly.

- [ ] **Step 4: Smoke test on device (flag still off, so behavior unchanged)**

Run: `npm run dev`
On iOS device, go through Orchestra phase — should feel identical to step 5 result (because `ENABLE_GYRO_ENERGY_COUPLING` is still `false`).

- [ ] **Step 5: Commit**

```bash
git add src/orchestra/OrchestraEngine.js
git commit -m "feat(orchestra): switch facingDeg to yaw-derived when gyro coupling enabled

Previously OrchestraEngine.applyConducting computed facingDeg from 'pan',
which is derived from gamma (roll). This collapsed the yaw-spotlight onto
the same axis as the per-stem pan — tilting and turning produced identical
audio effects, violating the perceptual-macro-dimensions design from
research §3.5.

Behind ENABLE_GYRO_ENERGY_COUPLING (currently false), facingDeg now comes
from yaw (alpha). Legacy behavior preserved when flag is off, so this
commit is a no-op for users until the flag flip.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6.2: Add gyro→brightness cross-coupling

**Files:**
- Modify: `src/orchestra/OrchestraEngine.js`

- [ ] **Step 1: In the per-stem loop, add gyro influence on the conducting filter cutoff**

Find the existing line in `applyConducting()`:

```js
// Per-stem conducting filter cutoff
const cutoff = 200 + filterNorm * 3800
stem.conductingFilter.frequency.setTargetAtTime(cutoff, now, CONDUCTING.FILTER_FREQ_TC)
```

Replace with:

```js
// Per-stem conducting filter cutoff. Base cutoff comes from pitch (filterNorm).
// When gyro coupling is on, fast rotational motion brightens the spectrum —
// implements the "Energy/Brightness" macro-dimension from research §3.1.
const gyroMag = (rotationRate && rotationRate.mag) || 0
const gyroBoost = ENABLE_GYRO_ENERGY_COUPLING
  ? Math.min(2000, gyroMag * 4)   // 500°/s gyro → +2 kHz cutoff lift
  : 0
const cutoff = 200 + filterNorm * 3800 + gyroBoost
stem.conductingFilter.frequency.setTargetAtTime(cutoff, now, CONDUCTING.FILTER_FREQ_TC)
```

- [ ] **Step 2: Also cross-couple gyro into the reverb send (research §3.1: gyro reduces reverb to feel "present")**

Right after the cutoff change inside the per-stem loop, add:

```js
// Reverb send modulation: fast gyro = drier/more present, slow = wetter.
if (ENABLE_GYRO_ENERGY_COUPLING) {
  const baseReverb = STEMS[name].reverbSend
  const drier = clamp(1 - gyroMag / 600, 0, 1)
  stem.reverbSend.gain.setTargetAtTime(baseReverb * drier, now, CONDUCTING.FILTER_FREQ_TC)
}
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: still pass.

- [ ] **Step 4: Commit (with flag still off)**

```bash
git add src/orchestra/OrchestraEngine.js
git commit -m "feat(orchestra): add gyro→brightness cross-coupling (gated)

Implements the 'Energy/Brightness' macro-dimension from research §3.1:
rotationRate.mag cross-couples into the per-stem conducting filter cutoff
(+2 kHz lift at fast gyro) and reduces the reverb send proportionally
(faster gyro → drier sound, slower gyro → wetter).

Gated by ENABLE_GYRO_ENERGY_COUPLING — no behavioral change until step 6.3
flips the flag.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6.3: Flip the gyro coupling flag + final smoke test

**Files:**
- Modify: `src/conducting/constants.js`

- [ ] **Step 1: Flip the flag**

In `src/conducting/constants.js`, change:

```js
export const ENABLE_GYRO_ENERGY_COUPLING = false
```

to:

```js
export const ENABLE_GYRO_ENERGY_COUPLING = true
```

- [ ] **Step 2: Rebuild the relay bundle**

Run: `npm run build:relay-phone`

- [ ] **Step 3: Final smoke test on iOS device**

Run: `npm run dev`

In Orchestra phase, verify:
- [ ] Yaw-spotlight now responds to **turning the phone** (rotating around vertical axis), not to **tilting**. Turn left → drums emphasis; turn right → bass; turn around → "other" stem from behind.
- [ ] Tilting left/right still pans the stereo image but no longer changes which stem is spotlit (decoupled).
- [ ] Fast wrist flicks brighten the filter cutoff audibly and reduce reverb.
- [ ] Slow gestures sound wetter/more distant.
- [ ] None of the legacy behaviors regress (downbeat accents, gesture-size dynamics, pan-on-tilt).

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all 142+ tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/conducting/constants.js
git commit -m "feat(orchestra): activate yaw-spotlight + gyro-brightness coupling

Flips ENABLE_GYRO_ENERGY_COUPLING to true. Effects:
  - Yaw-spotlight now responds to compass heading (alpha), not roll. Turning
    the phone left emphasizes drums; right = bass; behind = 'other'.
  - Tilt (roll) and turn (yaw) are now perceptually independent — fixes the
    one-axis collapse identified in CLAUDE.md §'Parked for later → §2 Conducting gaps'.
  - Fast rotational motion brightens spectrum (+2 kHz lift, drier reverb),
    implementing the 'Energy/Brightness' macro-dimension from research §3.1.

Completes the conducting refactor. Both feature flags are now on; both
pipelines (Orchestra phone-native + /conduct-glb relay) share a single
GestureCore source of truth.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6.4: Update CLAUDE.md to reflect what's now done

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Find the "Parked for later → §2 Conducting gaps" section**

Run: `grep -n "Conducting gaps" CLAUDE.md`
Expected: one match in the "Parked for later" section.

- [ ] **Step 2: Replace that section with a "Done" note pointing to this plan**

Edit `CLAUDE.md` — change the §2 table to a single short paragraph:

```markdown
### 2. Conducting gaps — addressed 2026-05-13

The yaw-on-roll bug, missing One Euro Filter, low downbeat threshold, and
gesture-size gain floor identified in `Research/gesture-felt-agency-phone-as-baton.md`
were fixed in the conducting refactor (`docs/superpowers/plans/2026-05-13-conducting-refactor.md`).
Both the Orchestra phone-native path and the `/conduct-glb` relay path now share
a single `src/conducting/GestureCore.js` source of truth, with research-aligned
thresholds and 1€ filtering active. The four-axis input (pan/filterNorm/yaw/
gestureGain) and gyro-cross-coupling are exposed to `OrchestraEngine.applyConducting`.
```

- [ ] **Step 3: Add a brief note to the "Tech Stack → Web Audio API" subsection**

In the section that describes `src/orchestra/OrchestraEngine.js`, add at the end:

```markdown
- Gesture extraction lives in `src/conducting/GestureCore.js` (shared with the relay phone bundle); `ConductingEngine.js` is a thin DOM-binding wrapper.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): mark conducting gaps as addressed by refactor

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Verification checklist (end of plan)

Run through these once everything is committed:

- [ ] `npm test` — all tests pass (142+ tests)
- [ ] `npm run lint` — clean
- [ ] `npm run build` — production build succeeds
- [ ] `npm run build:relay-phone` — relay bundle builds cleanly
- [ ] `npm run dev` + iOS device → Orchestra phase works with research-aligned conducting
- [ ] `npm run relay` + iOS device → `/conduct-glb` works with research-aligned conducting
- [ ] `git log --oneline` shows ~14 commits, one per task
- [ ] No remaining import of `conduct-relay/public/phone.js` anywhere (verify with `grep -rn "public/phone.js"`)
- [ ] No duplicate gesture-extraction code remains (verify with `grep -rn "DOWNBEAT_ACCEL_THRESHOLD"` — should only appear in `src/conducting/constants.js`)

## Rollback procedure

If research-mode behavior is worse than legacy in real-world testing, revert by setting both flags back to `false` in `src/conducting/constants.js`:

```js
export const USE_RESEARCH_CONDUCTING_PARAMS = false
export const ENABLE_GYRO_ENERGY_COUPLING    = false
```

Rebuild the relay bundle (`npm run build:relay-phone`) and the system reverts to legacy behavior without losing the refactor benefits. The flags can later be removed entirely once research mode has been validated in production.
