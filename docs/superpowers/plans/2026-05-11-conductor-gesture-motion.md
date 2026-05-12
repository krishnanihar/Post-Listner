# Conductor Gesture-Driven Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken per-axis Euler-decomposition motion in `ConductorView.jsx` with a research-grounded pipeline (1€ filter → swing-twist decomposition → anatomical clamps → bone-local rotation application) so the 3D conductor figure responds to phone gestures realistically — head tilts subtly with phone pitch, chest leans subtly with phone roll, right upper arm follows phone orientation as if it is the baton.

**Architecture:** Three new pure-JS utility modules (`oneEuroFilter.js`, `swingTwist.js`, `boneLocal.js`), each unit-tested in isolation, plus an anatomical-limits constants file. Then a single rewrite of `Conductor`'s `useFrame` that composes them in this order: phone quaternion → 1€ filter (already in `usePhoneOrientation`) → swing-twist decompose around vertical → extract pitch/roll/yaw scalars → clamp each to anatomical limits → apply per-bone with proper world-to-bone-local conversion. The bone-driving order is non-overlapping: head gets pitch+yaw, chest gets roll, upper-arm gets the full quaternion in world-space (converted to local). No driver compounds with another.

**Tech Stack:** Vitest (already configured), three.js (`^0.184.0`), `@react-three/fiber` (`^9.6.1`), `@react-three/drei` (`^10.7.7`). All new code is pure-JS — no new runtime dependencies.

**Background — why we're doing this:**
- `Research/gesture-felt-agency-phone-as-baton.md` explicitly names the 1€ Filter as the "gold standard" for IMU smoothing and notes the project does not yet use it
- Current `setFromQuaternion(q, 'ZXY')` decomposition produces three coupled scalars, and applying them to multiple bones in a parent chain compounds rotations (chest leans, then head leans on top of an already-leaning chest = double tilt)
- Current "full quaternion to upper arm" includes the yaw component, which made the arm spin around its long axis (not realistic conducting motion)
- Bone rotations in three.js are in parent-local space; applying a world-frame quaternion directly without converting causes the bone's world orientation to drift further from intent the deeper it sits in the hierarchy

**References:**
- Casiez, Roussel, Vogel — "1€ Filter: A Simple Speed-based Low-pass Filter" (CHI 2012). Reference impl: http://cristal.univ-lille.fr/~casiez/1euro/
- Allen Chou — "Game Math: Swing-Twist Interpolation" — https://allenchou.net/2018/05/game-math-swing-twist-interpolation-sterp/
- three.js forum: "apply global quaternion value for bone" — https://discourse.threejs.org/t/question-about-apply-global-based-quaternion-value-for-bone/72536

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/conductor/oneEuroFilter.js` | Create | `OneEuroFilter` (scalar) and `OneEuroQuaternion` (4-component + continuity + normalize) |
| `src/conductor/swingTwist.js` | Create | `swingTwistDecompose(q, axis)` returning `{ swing, twist }` quaternions |
| `src/conductor/boneLocal.js` | Create | `worldQuatToBoneLocal(bone, worldQuat)` for setting a bone such that its world orientation equals `worldQuat` |
| `src/conductor/conductorAnatomy.js` | Create | Constants: max head pitch/yaw, max chest roll, arm damping factor |
| `src/conductor/__tests__/oneEuroFilter.test.js` | Create | Unit tests for both filter classes |
| `src/conductor/__tests__/swingTwist.test.js` | Create | Unit tests for swing-twist decomposition |
| `src/conductor/__tests__/boneLocal.test.js` | Create | Unit test on synthetic 2-bone hierarchy |
| `src/conductor/__tests__/conductorMotion.test.js` | Create | Integration test: load GLB, apply known phone quat, assert each driven bone's world rotation |
| `src/conductor/usePhoneOrientation.js` | Modify | Insert 1€ filter step on the WS message handler before storing into `targetQuat` |
| `src/conductor/ConductorView.jsx` | Modify | Replace `useFrame` body with the new pipeline; remove the `spine` driver entirely |

Each utility is pure JS (no React, no DOM) and operates on plain numbers / `THREE.Quaternion` / `THREE.Vector3`. They're unit-testable in Node without jsdom.

---

## Task 1: 1€ Filter

**Files:**
- Create: `src/conductor/oneEuroFilter.js`
- Create: `src/conductor/__tests__/oneEuroFilter.test.js`

The 1€ Filter is a scalar adaptive low-pass filter with speed-dependent cutoff. We implement the scalar form first, then a 4-component wrapper for quaternions that:
1. Ensures consecutive quaternions are in the same hemisphere (avoids 360° flips)
2. Filters each component independently
3. Renormalizes the result to keep it a valid unit quaternion

- [ ] **Step 1.1: Write the failing scalar-filter test**

Create `src/conductor/__tests__/oneEuroFilter.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { OneEuroFilter, OneEuroQuaternion } from '../oneEuroFilter'

describe('OneEuroFilter (scalar)', () => {
  it('passes the first sample through unchanged', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.0 })
    expect(f.filter(0.5, 0)).toBe(0.5)
  })

  it('returns a smoothed value when given a stable signal with jitter', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.0 })
    let out = 0
    // 60Hz for 1 second of small noise around 1.0
    const seed = 12345
    let rng = seed
    for (let i = 0; i < 60; i++) {
      rng = (rng * 1664525 + 1013904223) >>> 0
      const noise = ((rng / 0xffffffff) - 0.5) * 0.2
      out = f.filter(1.0 + noise, i * 1000 / 60)
    }
    // After 1s of filtering, output should be much closer to 1.0 than the raw noise
    expect(Math.abs(out - 1.0)).toBeLessThan(0.05)
  })

  it('tracks fast motion with bounded lag when beta > 0', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.1 })
    let out = 0
    // Step input from 0 to 1.0 at t=500ms; sample at 60Hz for 1s
    for (let i = 0; i < 60; i++) {
      const t = i * 1000 / 60
      const x = t < 500 ? 0 : 1.0
      out = f.filter(x, t)
    }
    // Should have caught up to within 5% by end
    expect(out).toBeGreaterThan(0.95)
  })
})

describe('OneEuroQuaternion', () => {
  it('passes the first quaternion through (normalized)', () => {
    const f = new OneEuroQuaternion({ minCutoff: 1.0, beta: 0.0 })
    const out = f.filter(0, 0, 0, 1, 0)
    expect(out.x).toBeCloseTo(0)
    expect(out.y).toBeCloseTo(0)
    expect(out.z).toBeCloseTo(0)
    expect(out.w).toBeCloseTo(1)
  })

  it('output is always a unit quaternion', () => {
    const f = new OneEuroQuaternion({ minCutoff: 1.0, beta: 0.007 })
    let out
    for (let i = 0; i < 30; i++) {
      const a = i * 0.05
      out = f.filter(Math.sin(a) * 0.3, 0, 0, Math.cos(a) * 0.7 + 0.5, i * 16.6)
      const len = Math.sqrt(out.x*out.x + out.y*out.y + out.z*out.z + out.w*out.w)
      expect(len).toBeCloseTo(1.0, 5)
    }
  })

  it('handles hemisphere flip without snapping', () => {
    const f = new OneEuroQuaternion({ minCutoff: 1.0, beta: 0.0 })
    f.filter(0, 0, 0, 1, 0)
    // Identity flipped: -0,-0,-0,-1 represents the same rotation
    const out = f.filter(0, 0, 0, -1, 16.6)
    // Should not produce a wild swing — output stays near identity
    const dot = Math.abs(out.w)
    expect(dot).toBeGreaterThan(0.99)
  })
})
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run: `npx vitest run src/conductor/__tests__/oneEuroFilter.test.js`
Expected: FAIL with "Cannot find module" or similar.

- [ ] **Step 1.3: Implement `oneEuroFilter.js`**

Create `src/conductor/oneEuroFilter.js`:

```javascript
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
```

- [ ] **Step 1.4: Run the test to verify it passes**

Run: `npx vitest run src/conductor/__tests__/oneEuroFilter.test.js`
Expected: PASS, 5 tests passing.

- [ ] **Step 1.5: Commit**

```bash
git add src/conductor/oneEuroFilter.js src/conductor/__tests__/oneEuroFilter.test.js
git commit -m "feat(conductor): add 1€ filter for IMU smoothing

Scalar OneEuroFilter and OneEuroQuaternion variant with hemisphere
continuity and renormalization. Used to smooth the phone orientation
stream in usePhoneOrientation. Reference: Casiez/Roussel/Vogel CHI 2012."
```

- [ ] **Step 1.6: Integrate into `usePhoneOrientation.js`**

Modify `src/conductor/usePhoneOrientation.js`. Replace the file's contents with:

```javascript
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OneEuroQuaternion } from './oneEuroFilter'

const SMOOTH_TIME_CONST = 0.08      // seconds; smaller = snappier
const RECONNECT_DELAY_MS = 1000

// 1€ filter parameters tuned per gesture-felt-agency-phone-as-baton.md §3:
// "The tuning procedure: set beta to zero, reduce min_cutoff until jitter at
// rest is acceptable, then increase beta until lag during fast movement is
// acceptable. Recommended starting values: min_cutoff = 1.0 Hz, beta = 0.007."
const FILTER_MIN_CUTOFF = 1.0
const FILTER_BETA = 0.007

function defaultRelayUrl() {
  if (typeof window === 'undefined') return ''
  const host = window.location.hostname || 'localhost'
  return `wss://${host}:8443/?role=desktop`
}

export function usePhoneOrientation(url) {
  const relayUrl = url ?? defaultRelayUrl()

  const [connected, setConnected] = useState(false)
  const [calibrated, setCalibrated] = useState(false)

  const targetQuat = useRef(new THREE.Quaternion())
  const currentQuat = useRef(new THREE.Quaternion())
  const lastRaw = useRef({ alpha: 0, beta: 0, gamma: 0, t: 0 })
  const filter = useRef(new OneEuroQuaternion({
    minCutoff: FILTER_MIN_CUTOFF,
    beta: FILTER_BETA,
  }))

  useEffect(() => {
    let ws = null
    let cancelled = false
    let reconnectTimer = null

    function connect() {
      if (cancelled) return
      try {
        ws = new WebSocket(relayUrl)
      } catch {
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
        return
      }

      ws.addEventListener('open', () => {
        if (!cancelled) setConnected(true)
      })

      ws.addEventListener('close', () => {
        if (cancelled) return
        setConnected(false)
        // Reset the filter so a long gap doesn't poison the next stream
        filter.current.reset()
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      })

      ws.addEventListener('error', () => {})

      ws.addEventListener('message', (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'orientation' && Array.isArray(msg.q) && msg.q.length === 4) {
            const t = typeof msg.t === 'number' ? msg.t : performance.now()
            const f = filter.current.filter(msg.q[0], msg.q[1], msg.q[2], msg.q[3], t)
            targetQuat.current.set(f.x, f.y, f.z, f.w)
            if (msg.raw) lastRaw.current = { ...msg.raw, t }
            if (typeof msg.calibrated === 'boolean' && msg.calibrated !== calibrated) {
              setCalibrated(msg.calibrated)
            }
          }
        } catch {}
      })
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws) ws.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayUrl])

  function advance(delta) {
    const factor = 1 - Math.exp(-delta / SMOOTH_TIME_CONST)
    currentQuat.current.slerp(targetQuat.current, factor)
  }

  return {
    connected,
    calibrated,
    targetQuat,
    currentQuat,
    lastRaw,
    advance,
  }
}
```

- [ ] **Step 1.7: Run build to verify the hook still compiles**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built in ...s` and the dist asset line.

- [ ] **Step 1.8: Commit**

```bash
git add src/conductor/usePhoneOrientation.js
git commit -m "feat(conductor): apply 1€ filter to phone quaternion stream

Smooths jitter in the WebSocket-relayed phone orientation before it
reaches targetQuat. Filter parameters (minCutoff=1.0Hz, beta=0.007)
follow the recommendation in Research/gesture-felt-agency-phone-as-baton.md."
```

---

## Task 2: Swing-Twist Decomposition

**Files:**
- Create: `src/conductor/swingTwist.js`
- Create: `src/conductor/__tests__/swingTwist.test.js`

Decomposes a quaternion `q` into `swing` (rotation perpendicular to a chosen axis) and `twist` (rotation around the axis). The two recombine via `swing.multiply(twist) ≈ q`. We use this to extract the *yaw* component (rotation around vertical) cleanly from the phone quaternion, free of pitch/roll contamination, and vice versa.

- [ ] **Step 2.1: Write the failing test**

Create `src/conductor/__tests__/swingTwist.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { swingTwistDecompose } from '../swingTwist'

const Y_AXIS = new THREE.Vector3(0, 1, 0)

function quatFromAxisAngle(axis, angle) {
  return new THREE.Quaternion().setFromAxisAngle(axis, angle)
}

function quatsClose(a, b, eps = 1e-5) {
  // Quaternions q and -q represent the same rotation; compare via abs(dot).
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)
  return Math.abs(dot - 1) < eps
}

describe('swingTwistDecompose around Y axis', () => {
  it('pure rotation around Y → twist=q, swing=identity', () => {
    const q = quatFromAxisAngle(Y_AXIS, Math.PI / 3)
    const { swing, twist } = swingTwistDecompose(q, Y_AXIS)
    expect(quatsClose(twist, q)).toBe(true)
    expect(quatsClose(swing, new THREE.Quaternion())).toBe(true)
  })

  it('pure rotation around X → swing=q, twist=identity', () => {
    const q = quatFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 4)
    const { swing, twist } = swingTwistDecompose(q, Y_AXIS)
    expect(quatsClose(twist, new THREE.Quaternion())).toBe(true)
    expect(quatsClose(swing, q)).toBe(true)
  })

  it('pure rotation around Z → swing=q, twist=identity', () => {
    const q = quatFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 5)
    const { swing, twist } = swingTwistDecompose(q, Y_AXIS)
    expect(quatsClose(twist, new THREE.Quaternion())).toBe(true)
    expect(quatsClose(swing, q)).toBe(true)
  })

  it('combined rotation → swing.multiply(twist) reconstructs q', () => {
    const yaw = quatFromAxisAngle(Y_AXIS, Math.PI / 6)
    const pitch = quatFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 8)
    const combined = pitch.clone().multiply(yaw)  // first yaw, then pitch
    const { swing, twist } = swingTwistDecompose(combined, Y_AXIS)
    const reconstructed = swing.clone().multiply(twist)
    expect(quatsClose(reconstructed, combined)).toBe(true)
  })

  it('zero rotation → both swing and twist are identity', () => {
    const q = new THREE.Quaternion()
    const { swing, twist } = swingTwistDecompose(q, Y_AXIS)
    expect(quatsClose(swing, new THREE.Quaternion())).toBe(true)
    expect(quatsClose(twist, new THREE.Quaternion())).toBe(true)
  })
})
```

- [ ] **Step 2.2: Run the test to verify it fails**

Run: `npx vitest run src/conductor/__tests__/swingTwist.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 2.3: Implement `swingTwist.js`**

Create `src/conductor/swingTwist.js`:

```javascript
import * as THREE from 'three'

/**
 * Decompose a quaternion `q` into swing and twist around `axis`.
 *
 * Returns `{ swing, twist }` such that `swing.multiply(twist) ≈ q`,
 * where:
 *   - `twist` is the rotation around `axis`
 *   - `swing` is the rotation perpendicular to `axis`
 *
 * Reference: Allen Chou, "Game Math: Swing-Twist Interpolation".
 *
 * @param {THREE.Quaternion} q
 * @param {THREE.Vector3} axis  Should be a unit vector.
 * @returns {{ swing: THREE.Quaternion, twist: THREE.Quaternion }}
 */
export function swingTwistDecompose(q, axis) {
  // Project the vector part of q onto the axis.
  const projDot = q.x * axis.x + q.y * axis.y + q.z * axis.z
  const projX = axis.x * projDot
  const projY = axis.y * projDot
  const projZ = axis.z * projDot

  // Twist = normalize(quat(projection.xyz, q.w)).
  const tx = projX, ty = projY, tz = projZ, tw = q.w
  const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz + tw * tw)

  const twist = new THREE.Quaternion()
  if (tlen < 1e-9) {
    // Singular case: q is a 180° rotation perpendicular to axis. Twist is identity.
    twist.set(0, 0, 0, 1)
  } else {
    twist.set(tx / tlen, ty / tlen, tz / tlen, tw / tlen)
  }

  // swing = q * conjugate(twist).
  const twistConj = twist.clone().conjugate()
  const swing = q.clone().multiply(twistConj)

  return { swing, twist }
}
```

- [ ] **Step 2.4: Run the test to verify it passes**

Run: `npx vitest run src/conductor/__tests__/swingTwist.test.js`
Expected: PASS, 5 tests passing.

- [ ] **Step 2.5: Commit**

```bash
git add src/conductor/swingTwist.js src/conductor/__tests__/swingTwist.test.js
git commit -m "feat(conductor): add swing-twist quaternion decomposition

Lets us extract just the yaw component (rotation around vertical) from
the phone quaternion without contamination from pitch/roll, and vice
versa. Used by the per-bone driver to avoid axis compounding."
```

---

## Task 3: Bone-Local Conversion Helper

**Files:**
- Create: `src/conductor/boneLocal.js`
- Create: `src/conductor/__tests__/boneLocal.test.js`

Given a target world-space rotation, returns the bone-local rotation that achieves it (accounting for the parent chain). Required for "the right upper arm follows the phone in world space" — without this conversion, the chest's rotation compounds onto the arm's rotation.

- [ ] **Step 3.1: Write the failing test**

Create `src/conductor/__tests__/boneLocal.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { worldQuatToBoneLocal } from '../boneLocal'

function quatsClose(a, b, eps = 1e-5) {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)
  return Math.abs(dot - 1) < eps
}

describe('worldQuatToBoneLocal', () => {
  it('returns the world quat unchanged when bone has no parent', () => {
    const bone = new THREE.Bone()
    const world = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), Math.PI / 4
    )
    const local = worldQuatToBoneLocal(bone, world)
    expect(quatsClose(local, world)).toBe(true)
  })

  it('inverts the parent rotation so the child reaches the world target', () => {
    // Build a 2-level hierarchy: parent rotated 90° around Y; child stub.
    const parent = new THREE.Bone()
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    const child = new THREE.Bone()
    parent.add(child)
    parent.updateMatrixWorld(true)

    // Want child to face 45° pitch up around world X.
    const target = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), Math.PI / 4
    )
    const local = worldQuatToBoneLocal(child, target)

    // Apply the local rotation, recompute world matrix, and check world quat.
    child.quaternion.copy(local)
    parent.updateMatrixWorld(true)
    const worldOut = new THREE.Quaternion()
    child.getWorldQuaternion(worldOut)

    expect(quatsClose(worldOut, target)).toBe(true)
  })

  it('handles a 3-level chain', () => {
    const grandparent = new THREE.Bone()
    grandparent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 6)
    const parent = new THREE.Bone()
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4)
    const child = new THREE.Bone()
    grandparent.add(parent)
    parent.add(child)
    grandparent.updateMatrixWorld(true)

    const target = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), -Math.PI / 8
    )
    const local = worldQuatToBoneLocal(child, target)

    child.quaternion.copy(local)
    grandparent.updateMatrixWorld(true)
    const worldOut = new THREE.Quaternion()
    child.getWorldQuaternion(worldOut)

    expect(quatsClose(worldOut, target)).toBe(true)
  })
})
```

- [ ] **Step 3.2: Run the test to verify it fails**

Run: `npx vitest run src/conductor/__tests__/boneLocal.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3.3: Implement `boneLocal.js`**

Create `src/conductor/boneLocal.js`:

```javascript
import * as THREE from 'three'

const _parentWorld = new THREE.Quaternion()
const _result = new THREE.Quaternion()

/**
 * Compute the bone-local quaternion that makes `bone`'s world orientation
 * equal `worldQuat`, given its parent chain.
 *
 * If the bone has no parent, the local frame == world frame, so we just
 * return a clone of `worldQuat`.
 *
 * Caller must ensure `bone.parent.updateMatrixWorld(true)` has been called
 * for the current frame before invoking this. (`useFrame` runs after R3F's
 * automatic matrix update, so this is satisfied by default.)
 *
 * @param {THREE.Bone | THREE.Object3D} bone
 * @param {THREE.Quaternion} worldQuat
 * @returns {THREE.Quaternion}  A new quaternion (the caller may mutate freely).
 */
export function worldQuatToBoneLocal(bone, worldQuat) {
  if (!bone.parent) return worldQuat.clone()
  bone.parent.getWorldQuaternion(_parentWorld)
  // localTarget = parentWorld^-1 * worldQuat
  _result.copy(_parentWorld).invert().multiply(worldQuat)
  return _result.clone()
}
```

- [ ] **Step 3.4: Run the test to verify it passes**

Run: `npx vitest run src/conductor/__tests__/boneLocal.test.js`
Expected: PASS, 3 tests passing.

- [ ] **Step 3.5: Commit**

```bash
git add src/conductor/boneLocal.js src/conductor/__tests__/boneLocal.test.js
git commit -m "feat(conductor): add world-quat-to-bone-local helper

Inverts the parent chain rotation so that setting bone.quaternion to the
returned value places the bone at the requested world orientation. Used
to drive the right upper arm with the phone's world-space orientation
without compounding the chest/spine rotations above it."
```

---

## Task 4: Anatomical Constants

**Files:**
- Create: `src/conductor/conductorAnatomy.js`

Anatomical clamps so the conductor never hits unrealistic poses. Numbers chosen from typical biomechanical comfort ranges (head pitch 20–25° comfortable, head yaw 30–45°, lateral spine flexion 10–15°). Centralized so they're tunable from one place.

- [ ] **Step 4.1: Create `conductorAnatomy.js`**

Create `src/conductor/conductorAnatomy.js`:

```javascript
// Anatomical limits for conductor figure motion.
// Magnitudes are gain factors applied to the phone signal, NOT raw bone angles —
// the resulting bone angle is signal × gain, then clamped to the corresponding
// max. Tune the gain to make the figure responsive; tune the max to keep poses
// believable.

const DEG = Math.PI / 180

export const ANATOMICAL = {
  // Head — gentle nods + turns
  HEAD_PITCH_GAIN: 0.40,        // phone forward/back tilt → head pitch
  HEAD_PITCH_MAX:  25 * DEG,    // ~25° comfortable nod range
  HEAD_YAW_GAIN:   0.50,        // phone yaw (twist) → head turn
  HEAD_YAW_MAX:    35 * DEG,    // ~35° comfortable turn range

  // Chest — subtle lean only; head + chest yaw are NOT both driven (would compound)
  CHEST_ROLL_GAIN: 0.40,        // phone side tilt → chest lean
  CHEST_ROLL_MAX:  15 * DEG,    // ~15° lateral flexion

  // Right upper arm — the "baton arm"
  // No gain on individual axes; we apply the *full* phone rotation in world
  // space (converted to bone-local), then clamp the resulting angular distance
  // from rest to ARM_MAX. The arm follows the phone but never folds backwards.
  ARM_DAMPING: 0.70,            // 0.0 = no influence, 1.0 = full mirror
  ARM_MAX:     90 * DEG,        // hard ceiling on world-space rotation from rest
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/conductor/conductorAnatomy.js
git commit -m "feat(conductor): centralize anatomical motion limits

Single source of truth for head/chest/arm gain factors and max angles,
based on biomechanical comfort ranges (head pitch ±25°, head yaw ±35°,
chest roll ±15°). Used by the per-bone driver in ConductorView."
```

---

## Task 5: Integration Test (red phase)

**Files:**
- Create: `src/conductor/__tests__/conductorMotion.test.js`

This test loads the GLB via three.js's GLTFLoader (Node-compatible), constructs a synthetic phone quaternion, drives the figure through one frame of the new pipeline, and asserts each driven bone ends up at the expected world rotation. We write it BEFORE the rewrite so it acts as the spec: tasks 6 are done when this passes.

The driver pipeline is exposed as a pure function `applyGesturePose(bones, baseRotations, phoneQuat)` that we'll extract into `ConductorView.jsx` (or its own module) in Task 6. The test imports that function directly, no React, no Canvas.

- [ ] **Step 5.1: Write the failing integration test**

Create `src/conductor/__tests__/conductorMotion.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { applyGesturePose, captureBaseRotations, findDrivenBones } from '../gesturePose'
import { ANATOMICAL } from '../conductorAnatomy'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const GLB_PATH = path.resolve(__dirname, '../../../public/conductor/conductor.glb')

function loadGLB() {
  return new Promise((resolve, reject) => {
    const buf = readFileSync(GLB_PATH)
    // Convert Buffer -> ArrayBuffer for parser
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    new GLTFLoader().parse(ab, '', resolve, reject)
  })
}

describe('applyGesturePose', () => {
  it('zero phone rotation produces no bone change beyond rest', async () => {
    const gltf = await loadGLB()
    const bones = findDrivenBones(gltf.scene)
    const base = captureBaseRotations(bones)
    const phone = new THREE.Quaternion()  // identity
    applyGesturePose(bones, base, phone)
    for (const key of Object.keys(bones)) {
      expect(
        bones[key].quaternion.angleTo(base[key]),
        `bone ${key} drifted from rest with identity input`
      ).toBeLessThan(0.01)  // ~0.6°
    }
  })

  it('pure pitch input produces head pitch within anatomical limit', async () => {
    const gltf = await loadGLB()
    const bones = findDrivenBones(gltf.scene)
    const base = captureBaseRotations(bones)
    // 30° pitch around world X.
    const phone = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), 30 * Math.PI / 180
    )
    applyGesturePose(bones, base, phone)
    const headDelta = base.head.clone().invert().multiply(bones.head.quaternion)
    const headAngle = 2 * Math.acos(Math.min(1, Math.abs(headDelta.w)))
    // Expect roughly pitch_signal × HEAD_PITCH_GAIN, clamped to HEAD_PITCH_MAX.
    expect(headAngle).toBeGreaterThan(0.05)            // moved
    expect(headAngle).toBeLessThanOrEqual(ANATOMICAL.HEAD_PITCH_MAX + 0.01)
  })

  it('pure roll input produces chest lean, not head pitch', async () => {
    const gltf = await loadGLB()
    const bones = findDrivenBones(gltf.scene)
    const base = captureBaseRotations(bones)
    // 30° roll around world Z (tilt sideways).
    const phone = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1), 30 * Math.PI / 180
    )
    applyGesturePose(bones, base, phone)
    const chestDelta = base.chest.clone().invert().multiply(bones.chest.quaternion)
    const chestAngle = 2 * Math.acos(Math.min(1, Math.abs(chestDelta.w)))
    expect(chestAngle).toBeGreaterThan(0.03)
    expect(chestAngle).toBeLessThanOrEqual(ANATOMICAL.CHEST_ROLL_MAX + 0.01)
    // Head should NOT have leaned sideways from a pure-roll input
    const headDelta = base.head.clone().invert().multiply(bones.head.quaternion)
    const headAngle = 2 * Math.acos(Math.min(1, Math.abs(headDelta.w)))
    expect(headAngle).toBeLessThan(0.02)
  })

  it('extreme phone rotation never drives bones past anatomical max', async () => {
    const gltf = await loadGLB()
    const bones = findDrivenBones(gltf.scene)
    const base = captureBaseRotations(bones)
    // 180° around an arbitrary axis — far beyond comfortable conducting motion
    const phone = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 1, 0).normalize(), Math.PI
    )
    applyGesturePose(bones, base, phone)
    const headDelta = base.head.clone().invert().multiply(bones.head.quaternion)
    const headAngle = 2 * Math.acos(Math.min(1, Math.abs(headDelta.w)))
    const chestDelta = base.chest.clone().invert().multiply(bones.chest.quaternion)
    const chestAngle = 2 * Math.acos(Math.min(1, Math.abs(chestDelta.w)))
    // Allow 1° tolerance on the clamp boundary
    expect(headAngle).toBeLessThanOrEqual(
      Math.max(ANATOMICAL.HEAD_PITCH_MAX, ANATOMICAL.HEAD_YAW_MAX) + 0.02
    )
    expect(chestAngle).toBeLessThanOrEqual(ANATOMICAL.CHEST_ROLL_MAX + 0.02)
  })
})
```

- [ ] **Step 5.2: Run the test to verify it fails**

Run: `npx vitest run src/conductor/__tests__/conductorMotion.test.js`
Expected: FAIL with "Cannot find module '../gesturePose'".

This is the red phase. Task 6 will make it green.

- [ ] **Step 5.3: Commit (test fixture only)**

```bash
git add src/conductor/__tests__/conductorMotion.test.js
git commit -m "test(conductor): add failing integration test for gesture-driven pose

Loads the rigged GLB, applies known phone quaternions, and asserts that
each driven bone ends up at an angle within anatomical limits and along
the correct axis. Currently red — Task 6 implements gesturePose to make
it pass."
```

---

## Task 6: Gesture-Pose Module + ConductorView Rewrite

**Files:**
- Create: `src/conductor/gesturePose.js`
- Modify: `src/conductor/ConductorView.jsx`

The gesture-pose pipeline is extracted into a pure module so the integration test from Task 5 can exercise it. `ConductorView` becomes a thin React shell that calls into it each frame.

- [ ] **Step 6.1: Implement `gesturePose.js`**

Create `src/conductor/gesturePose.js`:

```javascript
import * as THREE from 'three'
import { swingTwistDecompose } from './swingTwist'
import { worldQuatToBoneLocal } from './boneLocal'
import { ANATOMICAL } from './conductorAnatomy'

// World-space axes used for swing-twist decomposition.
const Y_AXIS = new THREE.Vector3(0, 1, 0)

// Bone names verified by src/conductor/__tests__/conductor-glb.test.js.
// Same keys are used by the integration test in conductorMotion.test.js.
const DRIVEN_BONE_NAMES = {
  head:      'DEF-spine.006',
  chest:     'DEF-spine.004',
  upperArmR: 'DEF-upper_arm.R',
}

/**
 * Walk the loaded scene and return a map of the driven bones we care about.
 * Uses SkinnedMesh.skeleton.bones[] (the only bones that deform the mesh on
 * the GPU) and applies the same name sanitization three.js's GLTFLoader uses.
 */
export function findDrivenBones(scene) {
  const skinBones = new Map()
  scene.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton && o.skeleton.bones) {
      for (const b of o.skeleton.bones) {
        if (b && b.name) skinBones.set(b.name, b)
      }
    }
  })

  const out = {}
  for (const [key, name] of Object.entries(DRIVEN_BONE_NAMES)) {
    const sanitized = THREE.PropertyBinding.sanitizeNodeName(name)
    const bone = skinBones.get(sanitized) || skinBones.get(name)
    if (bone) out[key] = bone
  }
  return out
}

/**
 * Snapshot each driven bone's current local quaternion as the rest pose
 * deltas will be applied on top of.
 */
export function captureBaseRotations(bones) {
  const base = {}
  for (const [key, bone] of Object.entries(bones)) {
    base[key] = bone.quaternion.clone()
  }
  return base
}

// Pre-allocated workspace to keep useFrame allocation-free.
const _swing = new THREE.Quaternion()
const _twist = new THREE.Quaternion()
const _delta = new THREE.Quaternion()
const _axisX = new THREE.Vector3(1, 0, 0)
const _axisY = new THREE.Vector3(0, 1, 0)
const _axisZ = new THREE.Vector3(0, 0, 1)

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Build a clamped delta quaternion: rotate around `axis` by
 * `clamp(signal × gain, -max, +max)`.
 */
function clampedAxisDelta(signal, gain, max, axis, out = new THREE.Quaternion()) {
  const angle = clamp(signal * gain, -max, max)
  return out.setFromAxisAngle(axis, angle)
}

/**
 * Apply a smoothed, calibrated phone quaternion to the driven bones.
 *
 * Pipeline:
 *   1. Decompose the phone quaternion around world Y → swing + twist.
 *      twist  = pure rotation around vertical (yaw)
 *      swing  = pure rotation around the horizontal plane (pitch + roll)
 *   2. From swing, extract pitch (around X) and roll (around Z) using ZXY
 *      Euler order (which is how phone.js originally constructed the quat
 *      from alpha/beta/gamma — round-trips cleanly).
 *   3. Drive each bone independently. No bone receives the same axis as
 *      another, so rotations cannot compound through the parent chain.
 *
 * This function is pure — it mutates `bones[*].quaternion` only. Safe to
 * call every frame and from outside React.
 *
 * @param {Record<string, THREE.Bone>} bones        from findDrivenBones
 * @param {Record<string, THREE.Quaternion>} base   from captureBaseRotations
 * @param {THREE.Quaternion} phoneQuat              calibrated, smoothed
 */
export function applyGesturePose(bones, base, phoneQuat) {
  // 1. Swing-twist around vertical.
  const { swing, twist } = swingTwistDecompose(phoneQuat, _axisY)
  _swing.copy(swing)
  _twist.copy(twist)

  // 2. Extract scalar pitch + roll from swing using ZXY order.
  const swingEuler = new THREE.Euler().setFromQuaternion(_swing, 'ZXY')
  const pitchSignal = swingEuler.x
  const rollSignal  = swingEuler.y

  // Yaw scalar from twist: twist is a rotation around Y, so its angle is
  // the yaw signal we want.
  const yawSignal = 2 * Math.atan2(_twist.y, _twist.w)

  // 3. Per-bone application.

  // 3a. Head: pitch (around X) + yaw (around Y), each clamped, applied as a
  //     local-space delta on top of the rest pose.
  if (bones.head && base.head) {
    const pitchDelta = clampedAxisDelta(
      pitchSignal, ANATOMICAL.HEAD_PITCH_GAIN, ANATOMICAL.HEAD_PITCH_MAX,
      _axisX, new THREE.Quaternion(),
    )
    const yawDelta = clampedAxisDelta(
      yawSignal, ANATOMICAL.HEAD_YAW_GAIN, ANATOMICAL.HEAD_YAW_MAX,
      _axisY, new THREE.Quaternion(),
    )
    _delta.copy(yawDelta).multiply(pitchDelta)  // yaw first, then pitch
    bones.head.quaternion.copy(base.head).multiply(_delta)
  }

  // 3b. Chest: roll only (around Z), clamped.
  if (bones.chest && base.chest) {
    const rollDelta = clampedAxisDelta(
      rollSignal, ANATOMICAL.CHEST_ROLL_GAIN, ANATOMICAL.CHEST_ROLL_MAX,
      _axisZ, _delta,
    )
    bones.chest.quaternion.copy(base.chest).multiply(rollDelta)
  }

  // 3c. Right upper arm: full phone quaternion in world space, slerped from
  //     identity by ARM_DAMPING, then converted to bone-local so it doesn't
  //     compound with chest/spine rotations above it.
  if (bones.upperArmR && base.upperArmR) {
    const dampedWorld = new THREE.Quaternion().slerp(phoneQuat, ANATOMICAL.ARM_DAMPING)

    // Clamp angular distance from rest to ARM_MAX.
    const angle = 2 * Math.acos(clamp(Math.abs(dampedWorld.w), 0, 1))
    if (angle > ANATOMICAL.ARM_MAX) {
      dampedWorld.slerp(new THREE.Quaternion(), 1 - ANATOMICAL.ARM_MAX / angle)
    }

    // Make sure the parent matrices are current. The integration test calls
    // updateMatrixWorld manually (no React); R3F does it automatically before
    // useFrame, so this is cheap if redundant.
    let p = bones.upperArmR.parent
    while (p && !p.matrixWorldNeedsUpdate && p.parent) p = p.parent
    if (bones.upperArmR.parent) bones.upperArmR.parent.updateMatrixWorld(true)

    const localTarget = worldQuatToBoneLocal(bones.upperArmR, dampedWorld)
    bones.upperArmR.quaternion.copy(base.upperArmR).multiply(localTarget)
  }
}
```

- [ ] **Step 6.2: Run the integration test to verify it now passes**

Run: `npx vitest run src/conductor/__tests__/conductorMotion.test.js`
Expected: PASS, 4 tests passing.

- [ ] **Step 6.3: Run the full conductor test suite**

Run: `npx vitest run src/conductor/__tests__/`
Expected: PASS, all tests across `oneEuroFilter`, `swingTwist`, `boneLocal`, `conductor-glb`, `conductorMotion` (15+ tests total).

- [ ] **Step 6.4: Replace `ConductorView.jsx`**

Replace the entire contents of `src/conductor/ConductorView.jsx` with:

```jsx
import { Suspense, createContext, useContext, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { applyEngravingShader } from './engravingShader'
import { usePhoneOrientation } from './usePhoneOrientation'
import { applyGesturePose, captureBaseRotations, findDrivenBones } from './gesturePose'

const PAPER_CREAM = '#F2EBD8'

const PhoneContext = createContext(null)

function PhoneProvider({ children }) {
  const phone = usePhoneOrientation()
  return <PhoneContext.Provider value={phone}>{children}</PhoneContext.Provider>
}

function usePhone() {
  const ctx = useContext(PhoneContext)
  if (!ctx) throw new Error('usePhone must be used inside PhoneProvider')
  return ctx
}

// Bake the conducting pose into bones via a one-shot AnimationMixer, then
// never tick the mixer again. This frees us to drive the bones from
// useFrame without the mixer overwriting our changes every frame.
function bakeClipToScene(scene, clip) {
  if (!clip) return false
  const mixer = new THREE.AnimationMixer(scene)
  const action = mixer.clipAction(clip)
  action.play()
  mixer.update(0)
  mixer.update(clip.duration)
  return true
}

function Conductor() {
  const groupRef = useRef()
  const { scene, animations } = useGLTF('/conductor/conductor.glb')
  const phone = usePhone()

  const drivenBones = useRef({})
  const baseRotations = useRef({})

  useEffect(() => {
    // Materials
    scene.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        const mat = new THREE.MeshToonMaterial({ color: 0x080706 })
        applyEngravingShader(mat)
        obj.material = mat
        obj.frustumCulled = false
      }
    })

    // Apply the conducting pose, then capture the resulting bone state as base.
    const baked = bakeClipToScene(scene, animations?.[0])
    const bones = findDrivenBones(scene)
    drivenBones.current = bones
    baseRotations.current = captureBaseRotations(bones)

    if (typeof window !== 'undefined' && !window.__conductorBonesLogged) {
      console.log(`[Conductor] baked=${baked}; driven bones:`,
        Object.fromEntries(Object.entries(bones).map(([k, b]) => [k, b.name])))
      window.__conductorBonesLogged = true
    }
  }, [scene, animations])

  useFrame((_, delta) => {
    phone.advance(delta)
    if (!phone.calibrated) return
    applyGesturePose(drivenBones.current, baseRotations.current, phone.currentQuat.current)
  })

  return <primitive ref={groupRef} object={scene} />
}

useGLTF.preload('/conductor/conductor.glb')

function StatusOverlay() {
  const phone = usePhone()
  let label, color
  if (!phone.connected) { label = 'relay offline · npm run relay'; color = '#a23a2a' }
  else if (!phone.calibrated) { label = 'phone connected · waiting for calibration'; color = '#806020' }
  else { label = 'conducting · live'; color = '#205028' }

  return (
    <div
      style={{
        position: 'absolute', top: 14, right: 14,
        padding: '6px 12px',
        background: 'rgba(28, 24, 20, 0.06)',
        color,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        letterSpacing: 0.3,
        borderRadius: 4,
        pointerEvents: 'none',
      }}
    >
      {label}
    </div>
  )
}

export default function ConductorView() {
  return (
    <PhoneProvider>
      <div className="h-full w-full relative" style={{ background: PAPER_CREAM }}>
        <Canvas
          camera={{ position: [0, 1.55, 2.6], fov: 35 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={1.4} />
          <Suspense fallback={null}>
            <Conductor />
          </Suspense>
          <OrbitControls
            target={[0, 1.45, 0]}
            enablePan={false}
            minDistance={1.5}
            maxDistance={5}
          />
        </Canvas>
        <StatusOverlay />
      </div>
    </PhoneProvider>
  )
}
```

- [ ] **Step 6.5: Run the production build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built in ...s`.

- [ ] **Step 6.6: Run all tests one more time as a regression check**

Run: `npm test`
Expected: All passing — vitest reports the full suite green.

- [ ] **Step 6.7: Commit**

```bash
git add src/conductor/gesturePose.js src/conductor/ConductorView.jsx
git commit -m "refactor(conductor): rewrite gesture-driven motion pipeline

Replaces the per-axis Euler decomposition + full-quat-on-arm motion with
a research-grounded pipeline:
  1. 1€ filter on the phone quaternion stream (Casiez et al., CHI 2012)
  2. Swing-twist decomposition around vertical (Chou)
  3. Anatomical clamping (head ±25° pitch, ±35° yaw; chest ±15° roll)
  4. World-to-bone-local conversion for the upper-arm baton mapping

Per-bone driving is non-overlapping: head gets pitch+yaw, chest gets
roll, upper arm gets the full phone quaternion in world space (converted
to local). No bone shares an axis with another, eliminating compounding.

Spine driver removed — it was duplicating the chest signal.

The pipeline lives in gesturePose.js as a pure function so it can be
unit-tested directly (see conductorMotion.test.js)."
```

---

## How to Run Everything After Implementation

```bash
# Two terminals:
npm run dev      # Vite — desktop /conduct on http://localhost:5174/conduct
npm run relay    # WS+HTTPS sidecar — phone on https://<lan-ip>:8443/phone

# Tests:
npx vitest run src/conductor/__tests__/    # all conductor unit + integration tests
npm run build                              # production build, smoke check
```

Open `/conduct` on desktop, `/phone` on phone (after accepting the cert), tap Start → grant motion permission → tap Calibrate. The figure should respond:
- Tilt phone forward/back: head pitches gently
- Tilt phone left/right: chest leans gently, head yaw stays at zero
- Twist phone left/right (yaw): head turns
- Wave phone around: right upper arm follows in world space

Status overlay (top-right) shows: `relay offline` → `phone connected · waiting for calibration` → `conducting · live`.

---

## Self-Review

**Spec coverage:**
- (1) 1€ Filter → Task 1 (creates `oneEuroFilter.js`, integrates in usePhoneOrientation).
- (2) Swing-twist decomposition → Task 2.
- (3) World-to-bone-local conversion → Task 3.
- (4) Anatomical clamp constants → Task 4.
- (5) Rewrite Conductor useFrame → Task 6 (`gesturePose.js` + ConductorView).
- (6) Node-side verification tests → distributed across Tasks 1, 2, 3, 5; Task 5 is the integration test that asserts the math is right against the real GLB.
All six covered.

**Placeholder scan:** No "TBD", "TODO", "implement later", "similar to Task N", or unspecified validation. Each step has full code or an exact command. ✓

**Type consistency:**
- `OneEuroQuaternion.filter(x, y, z, w, t)` returns `{x,y,z,w}` plain object — used identically in usePhoneOrientation Step 1.6.
- `swingTwistDecompose(q, axis)` returns `{ swing, twist }` THREE.Quaternion — consumed in `gesturePose.js` Step 6.1 with the same destructuring.
- `worldQuatToBoneLocal(bone, worldQuat)` returns a fresh `THREE.Quaternion` — used in `gesturePose.js` Step 6.1 by `.copy(...).multiply(...)`.
- `ANATOMICAL.HEAD_PITCH_GAIN` etc. defined in Task 4, referenced in Task 5 test, applied in Task 6 implementation. Names match across all three.
- `findDrivenBones`, `captureBaseRotations`, `applyGesturePose` exports introduced in Task 6 Step 6.1, imported in test Step 5.1. Same names. ✓

No issues found.
