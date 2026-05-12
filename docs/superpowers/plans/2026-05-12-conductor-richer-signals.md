# Conductor Celestial Field — Richer Phone Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use all phone sensor data — not just orientation — to drive the celestial-field conducting experience on `/conduct-glb`. Right now only `pitch` and `roll` are consumed; this plan adds `rotationRate` (gyro angular velocity), `energy` (accel RMS), `articulation` (jerk), `downbeat` events, and per-axis `acceleration` as drivers for trail width, ink character, star bursts, and directional motion.

**Architecture:** Three-layer pipeline:
1. **Phone side** ([conduct-relay/public/phone.js](conduct-relay/public/phone.js)) collects `DeviceMotionEvent` + `DeviceOrientationEvent`, computes derived signals, sends WebSocket payload at ~60 Hz.
2. **Desktop parser** ([src/conductor-codex/motion.js](src/conductor-codex/motion.js)) normalizes the payload into a `controls` object exposed via `usePhone()`.
3. **Consumer** ([src/conductor-glb/ConductorCelestialField.jsx](src/conductor-glb/ConductorCelestialField.jsx)) reads `controls` each frame and drives the canvas.

This plan adds **two new fields to the phone payload** (`rotationRate`, `acceleration` vector), **two new parsed signals** in `motion.js` (`controls.angularSpeed`, `controls.accel`), and **five new visual behaviors** in the celestial field.

**Tech Stack:** Browser DeviceMotion/Orientation APIs, vanilla JS on the phone side, React + Canvas 2D on the desktop, Vitest for unit tests.

**Reference docs (Context7-verified):**
- `DeviceMotionEvent.rotationRate.{alpha,beta,gamma}` — degrees per second around each device axis. Per MDN: alpha ≈ around Z (screen-perpendicular), beta ≈ around X (left-right), gamma ≈ around Y (bottom-top).
- `DeviceMotionEvent.acceleration.{x,y,z}` — m/s², gravity removed; falls back to `accelerationIncludingGravity` on browsers that don't supply linear acceleration.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| [conduct-relay/public/phone.js](conduct-relay/public/phone.js) | Phone sensor capture + WS send | Modify: capture `rotationRate`, capture per-axis `acceleration`, include both in payload |
| [src/conductor-codex/motion.js](src/conductor-codex/motion.js) | Desktop payload → `controls` parser | Modify: parse `rotationRate` → `controls.angularSpeed` + `controls.angularRate`; parse `acceleration` → `controls.accel` |
| `src/conductor-codex/__tests__/motion.test.js` | Vitest unit tests for parser | Create: cover new field parsing |
| [src/conductor-glb/ConductorCelestialField.jsx](src/conductor-glb/ConductorCelestialField.jsx) | Canvas conducting experience | Modify: replace screen-velocity ribbon width with `angularSpeed`; modulate glow with `energy`; pulse stars on `downbeat`; modulate ink wet/dry by `articulation`; nudge cursor by `accel` |
| [scripts/snap-glb-v2.mjs](scripts/snap-glb-v2.mjs) | Playwright visual snap harness | Modify: synthesize the new fields in test messages so visual verification works |

---

## Task 1: Use `controls.energy` to drive trail glow (quick win, no phone-side change)

**Why first:** `energy` already arrives in `controls`. No phone-side work needed. Ship visible response immediately so we have a baseline before the bigger payload changes.

**Files:**
- Modify: [src/conductor-glb/ConductorCelestialField.jsx](src/conductor-glb/ConductorCelestialField.jsx) around `drawTrail()` glow halo pass
- Modify: [scripts/snap-glb-v2.mjs](scripts/snap-glb-v2.mjs) to send `gestureGain` in synthetic messages

- [ ] **Step 1.1: Verify current trail glow pass**

Open [src/conductor-glb/ConductorCelestialField.jsx](src/conductor-glb/ConductorCelestialField.jsx). Locate the glow halo pass inside `drawTrail()` — the line:
```js
tCtx.fillStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},${lf * 0.16})`
```
This is the gold-tinted halo around the trail. The opacity is fixed at `0.16 × lifetime fade`.

- [ ] **Step 1.2: Modulate halo opacity with `controls.energy`**

Inside the `useEffect`, the `update(dt, t)` function reads `stateRef.current.controls`. Hoist `energy` into a closure-scoped variable that `drawTrail` can read:

In `update`, after reading `pitch` and `roll`, add:
```js
const energy = controls.energy || 0
```

Above `update`, declare a closure variable:
```js
let energySmoothed = 0
```

In `update`, smooth energy with the same `0.22` lerp the cursor uses:
```js
energySmoothed += (energy - energySmoothed) * 0.22
```

In `drawTrail`, change the halo opacity line to:
```js
const haloOpacity = 0.10 + energySmoothed * 0.28
tCtx.fillStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},${lf * haloOpacity})`
```

- [ ] **Step 1.3: Update the snap harness to send `gestureGain`**

Open [scripts/snap-glb-v2.mjs](scripts/snap-glb-v2.mjs). In the per-pose message-sending loop, add `gestureGain: 0.7` to the JSON:

```js
ws.send(JSON.stringify({
  type: 'orientation',
  q,
  raw: { alpha: pose.alpha, beta: pose.beta, gamma: pose.gamma },
  gestureGain: 0.7,
  calibrated: true,
  t: performance.now()
}))
```

- [ ] **Step 1.4: Visual verify**

```bash
npm run dev > /tmp/dev.log 2>&1 &
sleep 3
node scripts/snap-glb-v2.mjs
```

Open `tmp/conduct-glb-screens/03-pitch-fwd-30.png`. The ink ribbon should now have a visibly stronger gold halo than the previous run (where `gestureGain` was 0).

- [ ] **Step 1.5: Commit**

```bash
git add src/conductor-glb/ConductorCelestialField.jsx scripts/snap-glb-v2.mjs
git commit -m "feat(conduct-glb): modulate trail glow halo with phone energy

The gold halo around the ink ribbon now intensifies with the phone's
accelerometer RMS (controls.energy). Quiet phone → faint halo;
energetic gesture → bright halo. No phone-side changes required —
gestureGain was already in the payload."
```

---

## Task 2: Use `controls.articulation` for ink wet/dry character

**Why:** Articulation is jerk-normalized — high values mean a sharp, snappy movement. Conducting tradition: ictus is sharp, legato is smooth. Modulating ink saturation by articulation makes the trail *feel* responsive to gesture quality, not just position.

**Files:**
- Modify: [src/conductor-glb/ConductorCelestialField.jsx](src/conductor-glb/ConductorCelestialField.jsx) — ink color pass in `drawTrail()`
- Modify: [scripts/snap-glb-v2.mjs](scripts/snap-glb-v2.mjs) — send `articulation`

- [ ] **Step 2.1: Identify the ink color pass**

In `drawTrail()`, the second pass blends `INK` (solid dark) with `INK_WET` (slightly different dark) based on `wet`:
```js
const wet = Math.max(0, 1 - age / 450)
const r = INK[0] * (1 - wet) + INK_WET[0] * wet
const gC = INK[1] * (1 - wet) + INK_WET[1] * wet
const b = INK[2] * (1 - wet) + INK_WET[2] * wet
const a = lf * (0.62 + wet * 0.28)
```

Today `wet` decays linearly from 1 → 0 over 450 ms. We'll bias it by articulation: high articulation pushes wet toward 0 (drier, sharper); low articulation lets it stay at 1 longer (wet, soft).

- [ ] **Step 2.2: Add articulation smoothing and bias**

In `update`, after `energySmoothed`, add:
```js
const articulation = controls.articulation || 0
articulationSmoothed += (articulation - articulationSmoothed) * 0.18
```

Above `update`, declare:
```js
let articulationSmoothed = 0
```

In `drawTrail` ink pass, replace the `wet` line:
```js
const wetRaw = Math.max(0, 1 - age / 450)
// Articulation biases drying: a snappy stroke (high jerk) drops wet fast.
const wet = wetRaw * (1 - articulationSmoothed * 0.7)
```

And bump the alpha for sharp strokes so they read as more saturated:
```js
const a = lf * (0.62 + wet * 0.28 + articulationSmoothed * 0.10)
```

- [ ] **Step 2.3: Update snap harness to send `articulation`**

In the message JSON, add:
```js
articulation: 0.5,
```

- [ ] **Step 2.4: Visual verify**

```bash
node scripts/snap-glb-v2.mjs
```

Open `tmp/conduct-glb-screens/03-pitch-fwd-30.png`. Compare against the previous run: at `articulation: 0.5` the trail should look sharper / less soft-edged than at `articulation: 0`.

- [ ] **Step 2.5: Commit**

```bash
git add src/conductor-glb/ConductorCelestialField.jsx scripts/snap-glb-v2.mjs
git commit -m "feat(conduct-glb): drive ink wet/dry character with articulation

Jerk-derived controls.articulation now biases the wet→dry decay of the
ink ribbon. Sharp, snappy gestures produce a drier, more saturated trail;
smooth legato gestures stay wet/soft for longer. No phone-side change."
```

---

## Task 3: Star bursts on `downbeat` events

**Why:** The phone already detects negative-Y zero-crossings as downbeats and sends `{ downbeat: { fired, intensity } }`. Currently `/conduct-glb` ignores them entirely. Making the cosmos *flash* on every detected beat gives the gesture a visible ictus.

**Files:**
- Modify: [src/conductor-glb/ConductorCelestialField.jsx](src/conductor-glb/ConductorCelestialField.jsx) — listen for new `lastDownbeatAt`, activate nearby stars
- Modify: [scripts/snap-glb-v2.mjs](scripts/snap-glb-v2.mjs) — fire a downbeat message in at least one pose

- [ ] **Step 3.1: Track the last consumed downbeat timestamp**

In the `useEffect` body, add a closure variable above the `update` function:
```js
let lastConsumedBeat = 0
const BURST_RADIUS = 180   // viewBox px around cursor
```

- [ ] **Step 3.2: Detect new downbeat in `update`**

Inside `update`, after the trace-push logic and before the star activation loop, add:
```js
const beatAt = controls.lastDownbeatAt || 0
const beatNew = beatAt && beatAt !== lastConsumedBeat
if (beatNew) {
  lastConsumedBeat = beatAt
  const intensity = controls.downbeatIntensity || 1
  // Burst: any star within BURST_RADIUS of the cursor activates to full.
  // Pick the two closest to inscribe a constellation line.
  const near = []
  for (const s of stars) {
    const d = Math.hypot(s.x - sm.x, s.y - sm.y)
    if (d < BURST_RADIUS) {
      s.act = Math.min(1, s.act + 0.6 * intensity)
      near.push({ s, d })
    }
  }
  near.sort((a, b) => a.d - b.d)
  if (near.length >= 2) {
    inscribed.push({
      x1: near[0].s.x, y1: near[0].s.y,
      x2: near[1].s.x, y2: near[1].s.y,
      t: performance.now(),
    })
  }
}
```

- [ ] **Step 3.3: Update snap harness to fire a downbeat**

In the per-pose loop, on a specific pose (say `04-pitch-back-15`), bump the downbeat:
```js
const includeDownbeat = pose.label === '04-pitch-back-15'
ws.send(JSON.stringify({
  type: 'orientation',
  q,
  raw: { alpha: pose.alpha, beta: pose.beta, gamma: pose.gamma },
  gestureGain: 0.7,
  articulation: 0.5,
  downbeat: includeDownbeat ? { fired: true, intensity: 0.9 } : null,
  calibrated: true,
  t: performance.now()
}))
```

- [ ] **Step 3.4: Visual verify**

```bash
node scripts/snap-glb-v2.mjs
```

Open `tmp/conduct-glb-screens/04-pitch-back-15.png`. Should see multiple stars near the cursor position lit gold, with at least one inscribed line connecting two of them.

- [ ] **Step 3.5: Commit**

```bash
git add src/conductor-glb/ConductorCelestialField.jsx scripts/snap-glb-v2.mjs
git commit -m "feat(conduct-glb): burst nearby stars on detected downbeat

Phone-side downbeat events (negative-Y zero-crossings) now trigger a
burst of star activations within 180px of the cursor, plus an
inscribed constellation line between the two closest stars. Every
detected beat produces a visible ictus in the cosmos."
```

---

## Task 4: Add `rotationRate` to phone payload + parser + use for trail width

**Why:** Trail width is currently computed from on-screen cursor velocity. That's indirect — the cursor only moves when the phone *orientation* changes, so a fast wrist-flick that doesn't change pitch much produces no trail-width change. Direct gyro readout solves this.

**Files:**
- Modify: [conduct-relay/public/phone.js](conduct-relay/public/phone.js) — capture `rotationRate`, include in payload
- Modify: [src/conductor-codex/motion.js](src/conductor-codex/motion.js) — parse into `controls.angularSpeed`
- Create: `src/conductor-codex/__tests__/motion.test.js` — Vitest tests for parser
- Modify: [src/conductor-glb/ConductorCelestialField.jsx](src/conductor-glb/ConductorCelestialField.jsx) — replace screen-velocity in ribbon width with `angularSpeed`
- Modify: [scripts/snap-glb-v2.mjs](scripts/snap-glb-v2.mjs) — synthesize `rotationRate`

### 4a — Capture and send rotationRate from the phone

- [ ] **Step 4.1: Add rotationRate state to phone.js**

In [conduct-relay/public/phone.js](conduct-relay/public/phone.js), near the other top-level state variables:
```js
let rotationRateAlpha = 0
let rotationRateBeta = 0
let rotationRateGamma = 0
let rotationRateMag = 0
```

- [ ] **Step 4.2: Capture rotationRate in `onMotion`**

In `onMotion(e)`, after the existing `prevRms = rms` line, before the `now = performance.now()` line, add:
```js
const rr = e.rotationRate || {}
rotationRateAlpha = rr.alpha || 0
rotationRateBeta  = rr.beta  || 0
rotationRateGamma = rr.gamma || 0
rotationRateMag = Math.hypot(rotationRateAlpha, rotationRateBeta, rotationRateGamma)
```

- [ ] **Step 4.3: Include rotationRate in the WebSocket message**

In `onOrientation`, inside the `msg` object literal, add:
```js
rotationRate: {
  alpha: rotationRateAlpha,
  beta: rotationRateBeta,
  gamma: rotationRateGamma,
  mag: rotationRateMag,
},
```

- [ ] **Step 4.4: Verify phone payload locally**

```bash
npm run relay > /tmp/relay.log 2>&1 &
# Open https://localhost:8443/phone on a phone, Start, watch the relay log.
# Should see messages with "rotationRate":{"alpha":...,"beta":...,"gamma":...,"mag":...}
```

(If no phone available, defer to Step 4.10 visual verify.)

### 4b — Parse rotationRate in motion.js

- [ ] **Step 4.5: Write failing test for rotationRate parsing**

Create `src/conductor-codex/__tests__/motion.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { mapRelayMessage } from '../motion.js'

describe('mapRelayMessage rotationRate', () => {
  it('extracts angular speed magnitude from rotationRate.mag', () => {
    const msg = {
      raw: { alpha: 0, beta: 0, gamma: 0 },
      rotationRate: { alpha: 0, beta: 30, gamma: 40, mag: 50 },
      calibrated: true,
    }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.angularSpeed).toBeCloseTo(50 / 360, 5)
  })

  it('falls back to 0 when rotationRate missing', () => {
    const msg = {
      raw: { alpha: 0, beta: 0, gamma: 0 },
      calibrated: true,
    }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.angularSpeed).toBe(0)
  })

  it('clamps angular speed at 1.0 for very fast rotations', () => {
    const msg = {
      raw: { alpha: 0, beta: 0, gamma: 0 },
      rotationRate: { mag: 720 },
      calibrated: true,
    }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.angularSpeed).toBe(1)
  })
})
```

- [ ] **Step 4.6: Run test, verify it fails**

```bash
npx vitest run src/conductor-codex/__tests__/motion.test.js
```
Expected: 3 FAIL (`controls.angularSpeed` is undefined).

- [ ] **Step 4.7: Add rotationRate parsing in mapRelayMessage**

In [src/conductor-codex/motion.js](src/conductor-codex/motion.js), inside `mapRelayMessage(message, rawZero)`, after the existing `yaw` computation block, add:
```js
const rrMag = (message.rotationRate && Number(message.rotationRate.mag)) || 0
// 360 deg/s is "very fast" — a brisk wrist flick. Normalize to 0..1.
const angularSpeed = clamp(rrMag / 360, 0, 1)
```

Then in the returned `controls` object literal, add:
```js
angularSpeed,
```

Also update `DEFAULT_CONTROLS`:
```js
angularSpeed: 0,
```

- [ ] **Step 4.8: Re-run test, verify it passes**

```bash
npx vitest run src/conductor-codex/__tests__/motion.test.js
```
Expected: 3 PASS.

### 4c — Use angularSpeed for trail width in ConductorCelestialField

- [ ] **Step 4.9: Replace screen-velocity ribbon width with angularSpeed**

In [src/conductor-glb/ConductorCelestialField.jsx](src/conductor-glb/ConductorCelestialField.jsx), the `wid(v)` function takes velocity (px/s) and returns ribbon half-width. Its callers compute `v` in `update`:
```js
const dx = sm.x - last.x, dy = sm.y - last.y
const dist = Math.hypot(dx, dy)
vel = dist / tdt
```
And `trace.push({ x, y, t, v: vel })`. Later `buildRibbon` calls `wid(trace[i].v) / 2`.

Add a smoothed angular speed alongside the existing energy/articulation:
```js
let angularSpeedSmoothed = 0
```
In `update`, after the existing smoothing block:
```js
const angularSpeed = controls.angularSpeed || 0
angularSpeedSmoothed += (angularSpeed - angularSpeedSmoothed) * 0.30
```

In `update`, replace the existing `trace.push({ x: sm.x, y: sm.y, t: now, v: vel })` with:
```js
// Width source: blend phone-gyro angular speed (direct, no lag) with
// screen-cursor velocity (fallback when gyro data unavailable, e.g.
// on browsers without rotationRate). angularSpeed is 0..1; scale to
// the existing px/s domain of the original wid() function.
const widthSignal = Math.max(vel, angularSpeedSmoothed * V_SAT)
trace.push({ x: sm.x, y: sm.y, t: now, v: widthSignal })
```

- [ ] **Step 4.10: Update snap harness to send rotationRate**

In [scripts/snap-glb-v2.mjs](scripts/snap-glb-v2.mjs) message JSON, add:
```js
rotationRate: { alpha: 0, beta: 0, gamma: 0, mag: 250 },
```

- [ ] **Step 4.11: Visual verify**

```bash
node scripts/snap-glb-v2.mjs
```

The trail should be visibly thinner now in screenshots where `angularSpeed = 250/360 ≈ 0.69`, because high angular speed → narrow trail (per `wid()`'s formula).

- [ ] **Step 4.12: Commit**

```bash
git add conduct-relay/public/phone.js \
        src/conductor-codex/motion.js \
        src/conductor-codex/__tests__/motion.test.js \
        src/conductor-glb/ConductorCelestialField.jsx \
        scripts/snap-glb-v2.mjs
git commit -m "feat(conduct-glb): use phone gyro angular speed for trail width

DeviceMotionEvent.rotationRate is now collected by the phone, sent
over the relay, parsed into controls.angularSpeed (0..1 normalized
against 360 deg/s), and used as the primary ribbon-width input in
the celestial field. Falls back to screen-cursor velocity on browsers
that don't expose rotationRate. Adds Vitest coverage for the parser."
```

---

## Task 5: Add per-axis `acceleration` to payload + parser + use for cursor nudge

**Why:** We have a phone *acceleration vector* available but only ship its magnitude (`gestureGain`). Adding the direction lets the cursor *drift* in the direction the phone is being pushed — adds inertia and physicality. Subtle by design.

**Files:**
- Modify: [conduct-relay/public/phone.js](conduct-relay/public/phone.js)
- Modify: [src/conductor-codex/motion.js](src/conductor-codex/motion.js)
- Modify: `src/conductor-codex/__tests__/motion.test.js`
- Modify: [src/conductor-glb/ConductorCelestialField.jsx](src/conductor-glb/ConductorCelestialField.jsx)
- Modify: [scripts/snap-glb-v2.mjs](scripts/snap-glb-v2.mjs)

### 5a — Capture and send acceleration vector

- [ ] **Step 5.1: Track per-axis acceleration in phone.js state**

Near the other state, add:
```js
let accelX = 0, accelY = 0, accelZ = 0
```

- [ ] **Step 5.2: Update them in `onMotion`**

In the existing acceleration block where `ax`, `ay`, `az` are derived, immediately after `const az = a.z || 0`:
```js
accelX = ax
accelY = ay
accelZ = az
```

- [ ] **Step 5.3: Include in payload**

In the `msg` object inside `onOrientation`, alongside `rotationRate`:
```js
accel: { x: accelX, y: accelY, z: accelZ },
```

### 5b — Parse the acceleration vector

- [ ] **Step 5.4: Write failing test**

Append to `src/conductor-codex/__tests__/motion.test.js`:
```js
describe('mapRelayMessage accel vector', () => {
  it('passes through accel x/y/z normalized against 10 m/s^2', () => {
    const msg = {
      raw: { alpha: 0, beta: 0, gamma: 0 },
      accel: { x: 5, y: -3, z: 0 },
      calibrated: true,
    }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.accel.x).toBeCloseTo(0.5, 5)
    expect(out.controls.accel.y).toBeCloseTo(-0.3, 5)
    expect(out.controls.accel.z).toBe(0)
  })

  it('defaults accel to zeros when missing', () => {
    const msg = { raw: { alpha: 0, beta: 0, gamma: 0 }, calibrated: true }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.accel).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('clamps accel components to ±1', () => {
    const msg = {
      raw: { alpha: 0, beta: 0, gamma: 0 },
      accel: { x: 50, y: -50, z: 50 },
      calibrated: true,
    }
    const out = mapRelayMessage(msg, { alpha: 0, beta: 0, gamma: 0 })
    expect(out.controls.accel.x).toBe(1)
    expect(out.controls.accel.y).toBe(-1)
    expect(out.controls.accel.z).toBe(1)
  })
})
```

- [ ] **Step 5.5: Run test, verify failure**

```bash
npx vitest run src/conductor-codex/__tests__/motion.test.js
```
Expected: 3 new FAIL.

- [ ] **Step 5.6: Parse accel in mapRelayMessage**

In [src/conductor-codex/motion.js](src/conductor-codex/motion.js), inside `mapRelayMessage`, after the `angularSpeed` block:
```js
const accelRaw = message.accel || {}
const accel = {
  x: clamp(Number(accelRaw.x) / 10 || 0, -1, 1),
  y: clamp(Number(accelRaw.y) / 10 || 0, -1, 1),
  z: clamp(Number(accelRaw.z) / 10 || 0, -1, 1),
}
```

In the `controls` return literal:
```js
accel,
```

In `DEFAULT_CONTROLS`:
```js
accel: { x: 0, y: 0, z: 0 },
```

- [ ] **Step 5.7: Re-run tests, verify all pass**

```bash
npx vitest run src/conductor-codex/__tests__/motion.test.js
```
Expected: 6 PASS total.

### 5c — Use accel for directional cursor nudge

- [ ] **Step 5.8: Add small directional offset to cursor in ConductorCelestialField**

In `update`, after the existing `cur.x`/`cur.y` assignment block (the `if (phoneActive)` branch), add a subtle nudge that biases the cursor in the direction of physical acceleration:
```js
// Directional momentum from phone-frame acceleration. Subtle — adds
// physicality without overpowering the orientation-driven cursor.
const accel = controls.accel || { x: 0, y: 0, z: 0 }
cur.x += accel.x * 40  // viewBox px per (1g normalized) push
cur.y -= accel.y * 40  // phone +Y is up; SVG Y grows down → invert
```

- [ ] **Step 5.9: Update snap harness**

In the message JSON:
```js
accel: { x: 0, y: 0, z: 0 },
```

Also add a new pose in `POSES` to exercise it:
```js
{ label: '12-accel-shake', alpha: 0, beta: 0, gamma: 0,
  overrideAccel: { x: 4, y: -4, z: 0 } },
```

And in the message-sending loop, when `pose.overrideAccel` is set, use it for the `accel` field instead of the default.

- [ ] **Step 5.10: Visual verify**

```bash
node scripts/snap-glb-v2.mjs
```

`tmp/conduct-glb-screens/12-accel-shake.png` should show the cursor offset from center by about (160, -160) viewBox units worth of trail tail.

- [ ] **Step 5.11: Commit**

```bash
git add conduct-relay/public/phone.js \
        src/conductor-codex/motion.js \
        src/conductor-codex/__tests__/motion.test.js \
        src/conductor-glb/ConductorCelestialField.jsx \
        scripts/snap-glb-v2.mjs
git commit -m "feat(conduct-glb): nudge cursor by phone acceleration vector

Per-axis DeviceMotionEvent.acceleration is now sent and parsed into
controls.accel (each component normalized to ±1 against 10 m/s²).
The celestial field cursor receives a small directional offset
proportional to accel.{x,y}, adding inertia/physicality on top of
the orientation-driven position. Tests cover normalization,
defaults, and clamping."
```

---

## Self-Review Checklist

- **Spec coverage:** All 5 items from the research recommendations covered:
  1. ✓ rotationRate → trail width (Task 4)
  2. ✓ energy → trail glow (Task 1)
  3. ✓ downbeats → star bursts (Task 3)
  4. ✓ articulation → ink character (Task 2)
  5. ✓ per-axis accel → directional nudge (Task 5)
- **No placeholders:** every step has explicit code or commands.
- **Type consistency:** `controls.angularSpeed`, `controls.accel`, `controls.energy`, `controls.articulation`, `controls.downbeatIntensity`, `controls.lastDownbeatAt` used consistently across motion.js, snap harness, and ConductorCelestialField.
- **Test path consistency:** tests live in `src/conductor-codex/__tests__/motion.test.js` throughout.
- **Field names:** payload uses `rotationRate.{alpha,beta,gamma,mag}` and `accel.{x,y,z}` in all three layers (phone.js, motion.js, snap harness).
- **DEFAULT_CONTROLS:** updated in Task 4 and Task 5 so destructuring + early-render paths don't crash before first phone message.

---

## Test Strategy Summary

| Layer | Test Approach |
|---|---|
| Phone-side (`phone.js`) | Manual: open `/phone` on device, watch relay log for new fields |
| Parser (`motion.js`) | Vitest unit tests (`src/conductor-codex/__tests__/motion.test.js`) — pure-function coverage |
| Canvas consumer (`ConductorCelestialField.jsx`) | Visual via `scripts/snap-glb-v2.mjs` + Playwright screenshots in `tmp/conduct-glb-screens/` |

Run the full test suite after each task:
```bash
npx vitest run src/conductor-codex/__tests__/
```

Run the visual snap after each Canvas-touching task:
```bash
node scripts/snap-glb-v2.mjs
```

Total of **6 unit tests** added; **6 commits** at task boundaries.

---

## Risks & Notes

- **Browser variance for `rotationRate`:** iOS Safari and Chrome both expose it after `DeviceMotionEvent.requestPermission()`. Some older Android browsers may return `null` for the `rotationRate` property. The parser defaults to 0 in that case, and the celestial field falls back to screen-velocity ribbon width — so the experience degrades gracefully.
- **Phone permission flow:** acceleration + rotationRate share the same `DeviceMotionEvent` permission, which `phone.js` already requests. No additional permission prompt.
- **Calibration drift:** raw acceleration includes gravity on some browsers. `phone.js` already prefers `e.acceleration` (gravity-removed) and falls back to `accelerationIncludingGravity`. The per-axis vector inherits this behavior — acceptable for a nudge effect but not for absolute physics.
- **Magic numbers:** `360 deg/s` for angularSpeed normalization, `10 m/s²` for accel normalization, `40 px` nudge — all tuned for an intuitive baseline. If the user reports that motion feels too damped or too jittery, these are the dials.
