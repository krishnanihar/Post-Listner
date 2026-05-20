# Build A — Shared Room Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the Admirer's voice through a Web-Audio HRTF "room" during the conversation, let the phone's motion place that voice and draw a calm glyph, and make the room audibly expand into the orchestra as the phase-1 → phase-2 transition.

**Architecture:** A new self-contained `AdmirerRoom` audio class mirrors `OrchestraEngine`'s per-source signal chain (mono → HRTF panner + pre-HRTF reverb send → 6 image-source early reflections + binaural hall-IR convolver → master lowpass → output) for the single Admirer voice. It interpolates between the `INTIMATE` and `EXPANDED` presets already shipped in `roomPresets.js` via `setExpansion(t)`; `beginExpansion()` animates `t` 0→1 over ~3.5 s. The agent's voice is captured from the ElevenLabs SDK's hidden `<audio>` element (the SDK exposes no output node — see the spike) via `createMediaStreamSource`. Phone orientation is read through the existing `GestureCore`, feeding a gentle azimuth offset to the room and a faint ink-trail glyph on the reflection surface. A `useAdmirerRoom` hook owns the lifecycle so `Admirer.jsx` stays lean.

**Tech Stack:** React 19 + Vite, Web Audio API (`PannerNode` HRTF, `ConvolverNode`, `DelayNode`, `BiquadFilterNode`, `MediaStreamAudioSourceNode`), `@elevenlabs/react` Conversational AI, `src/conducting/GestureCore.js`, Framer Motion, Vitest.

---

## Context & baseline

This plan is the follow-on to `docs/superpowers/plans/2026-05-20-five-minute-admirer-shared-world.md`, whose Phase 3 explicitly deferred the Build-A audio integration to a spike-gated follow-on. **All 11 tasks of that plan have shipped.** Confirm before starting with `git log --oneline`:

- `d5113ad` — `src/lib/roomPresets.js` (the `INTIMATE`/`EXPANDED`/`roomAt` pure model — this plan consumes it).
- `c2ae0a7` — `docs/admirer-spatial-spike.md` (the capture-method spike — this plan implements its finding).
- `ReflectionSurface.jsx`, `liveSession.js`, `Admirer.jsx`, `useAdmirerAgent.js` all exist in their post-plan state.

The four tasks below correspond to Tasks 13–16 in the parent plan's Phase 3 integration outline; they are renumbered 1–4 here because this is a self-contained plan.

## Research grounding

- **`docs/admirer-spatial-spike.md`** resolved the capture method: the `@elevenlabs/react` SDK exposes **no** output `AudioContext`, output node, or `MediaStream` getter. It appends a hidden `<audio>` element (`srcObject` = a `MediaStream`) to `document.body`. The room taps that stream with `createMediaStreamSource`. Cross-checked against current ElevenLabs docs via Context7: the `useConversation` return surface is `startSession, endSession, status, mode, isSpeaking, isListening, isMuted, setMuted, canSendFeedback, sendFeedback, sendUserMessage, setVolume, getId` — `setVolume` is the only output-audio control, confirming there is no node-level output API. The capture-via-element approach is necessary, not a shortcut.
- **`Research/spatial-audio-hrtf-externalization.md`** gives the signal-chain order this plan mirrors: per-source `Source → Volume → EQ → distance lowpass → HRTF Panner`, with a pre-HRTF mono send to a reverb bus feeding early reflections + a binaural-IR convolver. Room simulation (early reflections + reverb), not HRTF quality alone, is what externalises sound — so the room is the point.
- **`src/orchestra/OrchestraEngine.js`** is the reference implementation. `AdmirerRoom` mirrors its node patterns for one source instead of four; it does **not** import or subclass it (the two engines run in different phases). Web Audio APIs used were confirmed current via Context7: `PanningModelType` is `"equalpower" | "HRTF"`; HRTF panners take a mono input and render stereo; `createMediaStreamSource(mediaStream)` returns a `MediaStreamAudioSourceNode`.
- **`src/conducting/GestureCore.js`** is the existing, 1€-filtered orientation reader. This plan uses its pure functions (`createState`, `processOrientation`, `read`) rather than re-deriving orientation handling.

## File structure

| File | Task | Created/Modified | Responsibility |
|---|---|---|---|
| `src/orchestra/AdmirerRoom.js` | 1 | Create | Web-Audio HRTF room for one voice: capture helper, graph, `setExpansion`, `beginExpansion`, `dispose`; plus the pure `rollToAzimuthOffset` mapping |
| `src/orchestra/__tests__/AdmirerRoom.test.js` | 1 | Create | Vitest tests for the pure `rollToAzimuthOffset` function |
| `src/hooks/usePhoneMotion.js` | 2 | Create | React hook: `deviceorientation` → `GestureCore` → a stable `read()` returning the latest orientation snapshot |
| `src/phases/Entry.score.jsx` | 2 | Modify | Request iOS device-motion permission inside the `begin` user gesture |
| `src/phases/GlyphCanvas.jsx` | 3 | Create | The calm ink-trail glyph `<canvas>`, drawn from phone orientation |
| `src/phases/ReflectionSurface.jsx` | 3 | Modify | Render `GlyphCanvas` behind the existing transcript/lexicon strip |
| `src/hooks/useAdmirerRoom.js` | 4 | Create | Owns the `AdmirerRoom` lifecycle: build, capture voice on connect, feed roll → azimuth, expose `beginExpansion` |
| `src/phases/Admirer.jsx` | 4 | Modify | Wire `useAdmirerRoom`; trigger `beginExpansion` when the agent commits a direction |

**Testing approach.** Only `rollToAzimuthOffset` is a pure function — it gets Vitest TDD (Task 1). Everything else is Web Audio, React hooks, `<canvas>`, and DOM-event glue that cannot be meaningfully unit-tested without a real `AudioContext`, real device-motion events, and a real ElevenLabs session. Those are verified by `npx eslint`, `npm run build`, and explicit manual see/hear checklists — the same approach the parent plan and the rest of the codebase use for Web-Audio/UI work. The big integration checklist is in Task 4.

---

## Task 1: The `AdmirerRoom` audio module

**Files:**
- Create: `src/orchestra/AdmirerRoom.js`
- Test: `src/orchestra/__tests__/AdmirerRoom.test.js`

`AdmirerRoom` is a standalone Web-Audio class for spatialising one source — the Admirer's voice. It is unused until Task 4 wires it in; like `roomPresets.js` before it, it ships as a complete, reviewable module on its own. It also exports the pure `rollToAzimuthOffset` mapping (Task 4 consumes it) and the `captureAdmirerVoice` helper (the spike's finding).

- [ ] **Step 1: Write the failing test**

Create `src/orchestra/__tests__/AdmirerRoom.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { rollToAzimuthOffset, MAX_AZIMUTH_OFFSET_DEG } from '../AdmirerRoom.js'

describe('rollToAzimuthOffset', () => {
  it('returns 0 at neutral roll', () => {
    expect(rollToAzimuthOffset(0)).toBe(0)
  })

  it('returns 0 inside the deadzone', () => {
    expect(rollToAzimuthOffset(3)).toBe(0)
    expect(rollToAzimuthOffset(-3)).toBe(0)
  })

  it('reaches the max offset at full roll', () => {
    expect(rollToAzimuthOffset(90)).toBeCloseTo(MAX_AZIMUTH_OFFSET_DEG, 5)
    expect(rollToAzimuthOffset(-90)).toBeCloseTo(-MAX_AZIMUTH_OFFSET_DEG, 5)
  })

  it('clamps roll beyond ±90°', () => {
    expect(rollToAzimuthOffset(180)).toBeCloseTo(MAX_AZIMUTH_OFFSET_DEG, 5)
    expect(rollToAzimuthOffset(-180)).toBeCloseTo(-MAX_AZIMUTH_OFFSET_DEG, 5)
  })

  it('is signed and strictly between 0 and the max in the active range', () => {
    expect(rollToAzimuthOffset(45)).toBeGreaterThan(0)
    expect(rollToAzimuthOffset(45)).toBeLessThan(MAX_AZIMUTH_OFFSET_DEG)
    expect(rollToAzimuthOffset(-45)).toBeLessThan(0)
    expect(rollToAzimuthOffset(-45)).toBeGreaterThan(-MAX_AZIMUTH_OFFSET_DEG)
  })

  it('treats null and NaN as 0', () => {
    expect(rollToAzimuthOffset(null)).toBe(0)
    expect(rollToAzimuthOffset(undefined)).toBe(0)
    expect(rollToAzimuthOffset(NaN)).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- AdmirerRoom`
Expected: FAIL — `Cannot find module '../AdmirerRoom.js'`.

- [ ] **Step 3: Create the `AdmirerRoom` module**

Create `src/orchestra/AdmirerRoom.js` with exactly this content:

```js
// AdmirerRoom — a small Web-Audio HRTF "room" for the Admirer's voice during
// the conversation phase. It mirrors the per-source signal chain of
// OrchestraEngine (mono → HRTF panner + pre-HRTF reverb send → 6 image-source
// early reflections + binaural hall-IR convolver → master lowpass → output),
// but for one source instead of four. setExpansion(t) interpolates the room
// between the INTIMATE (t=0) and EXPANDED (t=1) presets in roomPresets.js, so
// the closed conversation room can audibly open into the orchestra.
//
// Voice capture: the ElevenLabs SDK exposes no output node (see
// docs/admirer-spatial-spike.md). It appends a hidden <audio> element whose
// srcObject is a MediaStream to document.body; captureAdmirerVoice() taps it.

import { EARLY_REFLECTIONS } from './constants.js'
import { sphericalToCartesian } from '../chamber/utils/math.js'
import { roomAt } from '../lib/roomPresets.js'

const HALL_IR_URL = '/chamber/hall-ir.wav'
const VOICE_ELEVATION_DEG = 5
const VOICE_DISTANCE_M = 1.6

// Largest azimuth swing the phone's roll can give the voice. Small on
// purpose — the voice has a place; the phone turns you within the room,
// it is not a video-game pan.
export const MAX_AZIMUTH_OFFSET_DEG = 20
const ROLL_DEADZONE_DEG = 4

function dbToLinear(db) {
  return Math.pow(10, db / 20)
}

// Map device roll (gamma, degrees, nominally -90..90) to a gentle azimuth
// offset for the voice. A small deadzone keeps a still hand from nudging it.
// Pure — unit-tested.
export function rollToAzimuthOffset(gamma) {
  if (gamma == null || Number.isNaN(gamma)) return 0
  const clamped = Math.max(-90, Math.min(90, gamma))
  const mag = Math.abs(clamped)
  if (mag < ROLL_DEADZONE_DEG) return 0
  const sign = clamped < 0 ? -1 : 1
  const past = (mag - ROLL_DEADZONE_DEG) / (90 - ROLL_DEADZONE_DEG)
  return sign * past * MAX_AZIMUTH_OFFSET_DEG
}

// Find the hidden <audio> element the ElevenLabs SDK appends to document.body
// and tap its MediaStream. Throws if it is not present yet — the caller
// retries briefly after the session connects. Muting the element kills its
// direct-to-speaker path; it does not affect the MediaStream the source node
// reads, so the room becomes the only thing rendering the voice.
export function captureAdmirerVoice(ctx) {
  const el = [...document.querySelectorAll('audio')]
    .find(a => a.srcObject instanceof MediaStream && a.src === '')
  if (!el || !el.srcObject) {
    throw new Error('[admirer-room] SDK audio element not found')
  }
  el.muted = true
  return ctx.createMediaStreamSource(el.srcObject)
}

export default class AdmirerRoom {
  constructor(ctx) {
    this.ctx = ctx
    this._t = 0
    this._rafId = null
    this._disposed = false
    this.voiceSource = null
    this.convolver = null
    this.hallWetGain = null
    this.reflections = []
    this._build()
  }

  // Build the full graph synchronously EXCEPT the hall-IR convolver (which
  // needs an async fetch — see loadReverb). The graph is live and connectable
  // the instant the constructor returns, so there is no capture race.
  _build() {
    const ctx = this.ctx
    const r = roomAt(0)

    // Master: directBus → masterLowpass → destination
    this.directBus = ctx.createGain()
    this.directBus.gain.value = 1.0
    this.masterLowpass = ctx.createBiquadFilter()
    this.masterLowpass.type = 'lowpass'
    this.masterLowpass.frequency.value = r.dampingHz
    this.masterLowpass.Q.value = 0.7
    this.directBus.connect(this.masterLowpass)
    this.masterLowpass.connect(ctx.destination)

    // Voice entry — fold to mono so the HRTF panner spatialises one signal.
    this.monoGain = ctx.createGain()
    this.monoGain.channelCount = 1
    this.monoGain.channelCountMode = 'explicit'
    this.monoGain.channelInterpretation = 'speakers'

    // Direct path: monoGain → directGain → HRTF panner → directBus
    this.directGain = ctx.createGain()
    this.directGain.gain.value = r.directGain
    this.panner = ctx.createPanner()
    this.panner.panningModel = 'HRTF'
    this.panner.distanceModel = 'inverse'
    this.panner.refDistance = 1
    this.panner.maxDistance = 20
    this.panner.rolloffFactor = 1
    const vp = sphericalToCartesian(0, VOICE_ELEVATION_DEG, VOICE_DISTANCE_M)
    this.panner.positionX.value = vp.x
    this.panner.positionY.value = vp.y
    this.panner.positionZ.value = vp.z
    this.monoGain.connect(this.directGain)
    this.directGain.connect(this.panner)
    this.panner.connect(this.directBus)

    // Reverb bus — a mono pre-HRTF send; wetness is shaped downstream.
    this.reverbBus = ctx.createGain()
    this.reverbBus.gain.value = 1.0
    this.monoGain.connect(this.reverbBus)

    // Early reflections — 6 image-source walls, reusing the Orchestra room
    // geometry (EARLY_REFLECTIONS). Each: delay → wall lowpass → gain → HRTF.
    for (const er of EARLY_REFLECTIONS) {
      const baseDelaySec = er.delayMs / 1000
      const baseGainLin = dbToLinear(er.gainDb)

      const delay = ctx.createDelay(0.05)
      delay.delayTime.value = baseDelaySec * r.reflectionDelayScale
      const wallFilter = ctx.createBiquadFilter()
      wallFilter.type = 'lowpass'
      wallFilter.frequency.value = er.lpHz
      wallFilter.Q.value = 0.7
      const erGain = ctx.createGain()
      erGain.gain.value = baseGainLin * r.reflectionGain
      const erPanner = ctx.createPanner()
      erPanner.panningModel = 'HRTF'
      erPanner.distanceModel = 'inverse'
      erPanner.refDistance = 1
      erPanner.maxDistance = 20
      erPanner.rolloffFactor = 1
      const ep = sphericalToCartesian(er.azimuth, er.elevation, 1.5)
      erPanner.positionX.value = ep.x
      erPanner.positionY.value = ep.y
      erPanner.positionZ.value = ep.z

      this.reverbBus.connect(delay)
      delay.connect(wallFilter)
      wallFilter.connect(erGain)
      erGain.connect(erPanner)
      erPanner.connect(this.directBus)

      this.reflections.push({ delay, wallFilter, erGain, erPanner, baseDelaySec, baseGainLin })
    }
  }

  // Fetch + decode the binaural hall IR and attach the late-reverb convolver.
  // Best-effort: the room still runs (drier) without it.
  async loadReverb() {
    if (this._disposed) return
    let irBuffer
    try {
      const res = await fetch(HALL_IR_URL)
      const arr = await res.arrayBuffer()
      irBuffer = await this.ctx.decodeAudioData(arr)
    } catch (e) {
      console.warn('[admirer-room] hall IR load failed — running without late reverb', e)
      return
    }
    if (this._disposed) return
    this.convolver = this.ctx.createConvolver()
    this.convolver.buffer = irBuffer
    this.hallWetGain = this.ctx.createGain()
    this.hallWetGain.gain.value = roomAt(this._t).reverbWet
    this.reverbBus.connect(this.convolver)
    this.convolver.connect(this.hallWetGain)
    this.hallWetGain.connect(this.directBus)
  }

  // Connect a captured voice source node into the room's mono entry.
  connectVoice(sourceNode) {
    if (!sourceNode || !this.monoGain) return
    this.voiceSource = sourceNode
    try {
      sourceNode.connect(this.monoGain)
    } catch (e) {
      console.warn('[admirer-room] connectVoice failed', e)
    }
  }

  // Phone roll → a gentle azimuth swing of the voice within the room.
  setAzimuthOffset(offsetDeg) {
    if (this._disposed || !this.panner) return
    const pos = sphericalToCartesian(offsetDeg, VOICE_ELEVATION_DEG, VOICE_DISTANCE_M)
    const now = this.ctx.currentTime
    this.panner.positionX.setTargetAtTime(pos.x, now, 0.08)
    this.panner.positionY.setTargetAtTime(pos.y, now, 0.08)
    this.panner.positionZ.setTargetAtTime(pos.z, now, 0.08)
  }

  // Apply the room preset at expansion t (0 intimate … 1 expanded).
  setExpansion(t) {
    if (this._disposed || !this.directBus) return
    this._t = Math.max(0, Math.min(1, t))
    const r = roomAt(this._t)
    const now = this.ctx.currentTime
    this.directGain.gain.setTargetAtTime(r.directGain, now, 0.1)
    this.masterLowpass.frequency.setTargetAtTime(r.dampingHz, now, 0.1)
    if (this.hallWetGain) {
      this.hallWetGain.gain.setTargetAtTime(r.reverbWet, now, 0.1)
    }
    for (const ref of this.reflections) {
      ref.delay.delayTime.setTargetAtTime(ref.baseDelaySec * r.reflectionDelayScale, now, 0.1)
      ref.erGain.gain.setTargetAtTime(ref.baseGainLin * r.reflectionGain, now, 0.1)
    }
  }

  // Animate the room open from its current t to 1 over durationMs.
  beginExpansion(durationMs = 3500) {
    if (this._disposed) return
    if (this._rafId) cancelAnimationFrame(this._rafId)
    const fromT = this._t
    const start = performance.now()
    const step = (nowMs) => {
      if (this._disposed) return
      const p = Math.min(1, (nowMs - start) / durationMs)
      this.setExpansion(fromT + (1 - fromT) * p)
      if (p < 1) {
        this._rafId = requestAnimationFrame(step)
      } else {
        this._rafId = null
      }
    }
    this._rafId = requestAnimationFrame(step)
  }

  // Tear down: stop the ramp, disconnect every node.
  dispose() {
    this._disposed = true
    if (this._rafId) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    const nodes = [
      this.voiceSource, this.monoGain, this.directGain, this.panner,
      this.reverbBus, this.convolver, this.hallWetGain,
      this.directBus, this.masterLowpass,
    ]
    for (const n of nodes) {
      try { if (n) n.disconnect() } catch { /* ignore */ }
    }
    for (const ref of this.reflections) {
      try {
        ref.delay.disconnect()
        ref.wallFilter.disconnect()
        ref.erGain.disconnect()
        ref.erPanner.disconnect()
      } catch { /* ignore */ }
    }
    this.reflections = []
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- AdmirerRoom`
Expected: PASS — all 6 `rollToAzimuthOffset` tests green.

- [ ] **Step 5: Lint and build**

Run: `npx eslint src/orchestra/AdmirerRoom.js src/orchestra/__tests__/AdmirerRoom.test.js`
Expected: clean (this module imports no JSX, so the project-wide `motion` false positive does not apply — any output is a real error to fix).

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: **265 passed** (259 before this plan + 6 new).

- [ ] **Step 7: Commit**

```bash
git add src/orchestra/AdmirerRoom.js src/orchestra/__tests__/AdmirerRoom.test.js
git commit -m "feat(musicking): AdmirerRoom — HRTF room for the Admirer's voice

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Phone-motion hook + iOS permission request

**Files:**
- Create: `src/hooks/usePhoneMotion.js`
- Modify: `src/phases/Entry.score.jsx`

`usePhoneMotion` wraps the existing `GestureCore` orientation path in a React hook. iOS gates `DeviceMotionEvent` behind a permission prompt that must be requested inside a user gesture — the Entry "begin" tap is that gesture.

- [ ] **Step 1: Create the `usePhoneMotion` hook**

Create `src/hooks/usePhoneMotion.js` with exactly this content:

```js
import { useEffect, useRef, useCallback } from 'react'
import { createState, processOrientation, read } from '../conducting/GestureCore.js'
import { activeParams } from '../conducting/index.js'

// React hook: subscribes to DeviceOrientation and exposes the latest
// GestureCore snapshot via a stable read() function. read() returns
// { pan, filterNorm, gamma, beta, yaw, ... } — pan/filterNorm are 0..1
// (roll/pitch normalised), gamma/beta/yaw are degrees, all 1€-filtered.
//
// iOS permission must already have been granted — Entry requests it inside
// the "begin" tap. It is safe to call this hook from more than one component:
// each instance keeps its own lightweight GestureCore state, and the window
// event fans out to every listener. (Phase 1 has at most two callers — the
// room azimuth feed and the glyph — so the duplication cost is negligible.)
export function usePhoneMotion() {
  const stateRef = useRef(null)
  if (stateRef.current === null) {
    stateRef.current = createState({ params: activeParams() })
  }

  useEffect(() => {
    const state = stateRef.current
    const onOrient = (e) => processOrientation(state, e, performance.now())
    window.addEventListener('deviceorientation', onOrient, { passive: true })
    return () => window.removeEventListener('deviceorientation', onOrient)
  }, [])

  return useCallback(() => read(stateRef.current, performance.now()), [])
}
```

- [ ] **Step 2: Lint the new hook**

Run: `npx eslint src/hooks/usePhoneMotion.js`
Expected: clean.

- [ ] **Step 3: Add the iOS permission request to the Entry tap**

In `src/phases/Entry.score.jsx`, find the start of the `beginIntro` callback:

```js
    // 60 Hz felt anchor under the rite, started inside the user gesture.
    audioEngine.init()
    audioEngine.resume()
```

Replace it with:

```js
    // 60 Hz felt anchor under the rite, started inside the user gesture.
    audioEngine.init()
    audioEngine.resume()

    // iOS gates device-motion behind a permission prompt that must be
    // requested inside a user gesture — this tap is that gesture. Phase 1
    // uses orientation to place the Admirer's voice in the room and to draw
    // the glyph. Fire-and-forget: if denied, both simply stay centred.
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().catch(() => { /* denied — fine */ })
    }
```

- [ ] **Step 4: Lint and build**

Run: `npx eslint src/phases/Entry.score.jsx`
Expected: clean except possibly the known project-wide `'motion' is defined but never used` false positive — any other error must be fixed.

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: **265 passed** (no new tests; regression check).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/usePhoneMotion.js src/phases/Entry.score.jsx
git commit -m "feat(musicking): usePhoneMotion hook + iOS motion permission on Entry tap

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The glyph layer of the reflection surface

**Files:**
- Create: `src/phases/GlyphCanvas.jsx`
- Modify: `src/phases/ReflectionSurface.jsx`

The glyph is Build B's third element: a faint ink trail that forms from the phone's orientation, drawn behind the existing transcript/lexicon strip. It is driven by `usePhoneMotion`, which reads device orientation — meaningful in *both* the admirer phase (the user holding/tilting the phone) and the orchestra phase (the user conducting). No phase-specific code is needed; the same trail follows the same device motion throughout. Calm and ignorable by design: `pointer-events: none`, `aria-hidden`, very low opacity.

- [ ] **Step 1: Create the `GlyphCanvas` component**

Create `src/phases/GlyphCanvas.jsx` with exactly this content:

```jsx
import { useEffect, useRef } from 'react'
import { usePhoneMotion } from '../hooks/usePhoneMotion.js'

// A calm, peripheral glyph: a faint ink trail that forms from the phone's
// orientation. Part of Build B — ignorable by design (pointer-events: none,
// low opacity). The tapered-trail idea is borrowed from conductor-glb's
// ConductorCelestialField, much simplified: one fading stroke, no geometry,
// no audio reactivity. The cursor is roll (pan) → x, pitch (filterNorm) → y.
const TRACE_LIFE_MS = 4200
const MAX_POINTS = 160

export default function GlyphCanvas() {
  const canvasRef = useRef(null)
  const readMotion = usePhoneMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let w = 0
    let h = 0

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const trace = []
    const cursor = { x: 0, y: 0, init: false }
    let raf = 0
    let mounted = true

    const frame = () => {
      if (!mounted) return
      const now = performance.now()
      const m = readMotion()

      // roll (pan, 0..1) → x; pitch (filterNorm, 0..1) → y. Gentle: the
      // cursor reaches ±40% of the surface from centre at full tilt.
      const pan = m.pan == null ? 0.5 : m.pan
      const tilt = m.filterNorm == null ? 0.5 : m.filterNorm
      const tx = w / 2 + (pan - 0.5) * 2 * (w * 0.4)
      const ty = h / 2 + (tilt - 0.5) * 2 * (h * 0.4)
      if (!cursor.init) {
        cursor.x = tx
        cursor.y = ty
        cursor.init = true
      }
      cursor.x += (tx - cursor.x) * 0.18
      cursor.y += (ty - cursor.y) * 0.18

      const last = trace[trace.length - 1]
      if (!last || Math.hypot(cursor.x - last.x, cursor.y - last.y) > 1.5) {
        trace.push({ x: cursor.x, y: cursor.y, t: now })
      }
      while (trace.length && now - trace[0].t > TRACE_LIFE_MS) trace.shift()
      if (trace.length > MAX_POINTS) trace.splice(0, trace.length - MAX_POINTS)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (let i = 1; i < trace.length; i++) {
        const p0 = trace[i - 1]
        const p1 = trace[i]
        const life = 1 - (now - p1.t) / TRACE_LIFE_MS
        if (life <= 0) continue
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.lineWidth = 0.6 + life * 2.0
        ctx.strokeStyle = `rgba(150, 120, 70, ${life * 0.16})`
        ctx.stroke()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      mounted = false
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [readMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  )
}
```

- [ ] **Step 2: Lint the new component**

Run: `npx eslint src/phases/GlyphCanvas.jsx`
Expected: clean (no `motion` import here, so no false positive).

- [ ] **Step 3: Render `GlyphCanvas` inside the reflection surface**

`src/phases/ReflectionSurface.jsx` currently positions its root `<div>` as a bottom strip. Replace the **entire file** with this version, which makes the root a full-screen ignorable container holding the glyph and the existing bottom strip:

```jsx
import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { subscribeLiveSession, getLiveSession } from '../lib/liveSession.js'
import GlyphCanvas from './GlyphCanvas.jsx'

// A calm, peripheral surface, unbroken across the admirer and orchestra
// phases. Three quiet things: a glyph that forms from the phone's motion
// (GlyphCanvas), the words the user has given, and the Admirer's most recent
// line. It must be ignorable — a user who never looks at it loses nothing.
// Theme-neutral so it reads on both the cream Admirer phase and the dark
// Orchestra phase.
export default function ReflectionSurface() {
  const { transcript, lexicon } = useSyncExternalStore(subscribeLiveSession, getLiveSession)

  const lastAgentLine = [...transcript].reverse().find(l => l.role === 'agent')?.text || ''

  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
    >
      {/* the glyph — a faint ink trail drawn from phone motion */}
      <GlyphCanvas />

      {/* transcript + lexicon — a quiet strip along the bottom */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 10,
          padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 14px)',
        }}
      >
        {/* accumulating lexicon — the words the user gave */}
        {lexicon.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 10px',
            maxWidth: 420,
          }}>
            {lexicon.map((w, i) => (
              <motion.span
                key={`${w}-${i}`}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 0.4, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{
                  fontFamily: 'Iowan Old Style, Palatino, serif',
                  fontStyle: 'italic', fontSize: 12, letterSpacing: 0.2,
                  color: 'currentColor',
                }}
              >
                {w}
              </motion.span>
            ))}
          </div>
        )}

        {/* the Admirer's current line — faint, slow */}
        <AnimatePresence mode="wait">
          {lastAgentLine && (
            <motion.div
              key={lastAgentLine}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
              style={{
                fontFamily: 'Iowan Old Style, Palatino, serif',
                fontStyle: 'italic', fontSize: 13, lineHeight: 1.5,
                textAlign: 'center', maxWidth: 420, color: 'currentColor',
              }}
            >
              {lastAgentLine}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Lint and build**

Run: `npx eslint src/phases/ReflectionSurface.jsx`
Expected: clean except the known project-wide `'motion' is defined but never used` false positive — any other error must be fixed.

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: **265 passed** (no new tests; regression check).

- [ ] **Step 6: Commit**

```bash
git add src/phases/GlyphCanvas.jsx src/phases/ReflectionSurface.jsx
git commit -m "feat(musicking): glyph layer — phone-motion ink trail on the reflection surface

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire the room into the Admirer phase + the expansion transition

**Files:**
- Create: `src/hooks/useAdmirerRoom.js`
- Modify: `src/phases/Admirer.jsx`

`useAdmirerRoom` owns the `AdmirerRoom` lifecycle so `Admirer.jsx` stays lean: it builds the room on mount, captures the agent's voice once the session connects, feeds phone roll → room azimuth every frame, and exposes `beginExpansion()`. `Admirer.jsx` calls the hook and triggers the expansion when the agent commits a direction (`onStartGeneration`) — the room opens under the agent's closing words, and that opening *is* the phase-1 → phase-2 transition.

- [ ] **Step 1: Create the `useAdmirerRoom` hook**

Create `src/hooks/useAdmirerRoom.js` with exactly this content:

```js
import { useEffect, useRef, useCallback } from 'react'
import AdmirerRoom, { captureAdmirerVoice, rollToAzimuthOffset } from '../orchestra/AdmirerRoom.js'
import { usePhoneMotion } from './usePhoneMotion.js'

// Owns the AdmirerRoom audio graph for the Admirer phase. Builds the room on
// mount, captures the agent's voice once the session connects, feeds phone
// roll → room azimuth every frame, and returns beginExpansion() for the
// phase-1 → phase-2 handoff. Degrades gracefully: if voice capture fails the
// conversation still plays (just not spatialised) — the room is an
// enhancement, never a gate.
export function useAdmirerRoom({ getAudioCtx, status }) {
  const roomRef = useRef(null)
  const capturedRef = useRef(false)
  const readMotion = usePhoneMotion()

  // Build the room once, on mount. The graph is live synchronously; the hall
  // IR loads in the background.
  useEffect(() => {
    const ctx = getAudioCtx?.()
    if (!ctx) {
      console.warn('[admirer-room] no audio context — voice stays unspatialised')
      return undefined
    }
    const room = new AdmirerRoom(ctx)
    roomRef.current = room
    room.loadReverb().catch((e) => console.warn('[admirer-room] reverb load failed', e))
    return () => {
      roomRef.current = null
      capturedRef.current = false
      room.dispose()
    }
  }, [getAudioCtx])

  // Capture the agent's voice once the session connects. The SDK appends its
  // hidden <audio> element around onConnect time — retry briefly if it is not
  // there on the first attempt. captureAdmirerVoice throws (before muting
  // anything) when the element is absent, so a failed attempt is harmless.
  useEffect(() => {
    if (status !== 'connected' || capturedRef.current) return undefined
    let tries = 0
    let timer = null
    const attempt = () => {
      const room = roomRef.current
      const ctx = getAudioCtx?.()
      if (!room || !ctx) return
      try {
        room.connectVoice(captureAdmirerVoice(ctx))
        capturedRef.current = true
      } catch {
        if (tries++ < 20) {
          timer = setTimeout(attempt, 150)
        } else {
          console.warn('[admirer-room] voice capture gave up — voice stays unspatialised')
        }
      }
    }
    attempt()
    return () => { if (timer) clearTimeout(timer) }
  }, [status, getAudioCtx])

  // Feed phone roll → room azimuth each frame.
  useEffect(() => {
    let raf = 0
    let mounted = true
    const tick = () => {
      if (!mounted) return
      const room = roomRef.current
      if (room) {
        const m = readMotion()
        room.setAzimuthOffset(rollToAzimuthOffset(m.gamma))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { mounted = false; cancelAnimationFrame(raf) }
  }, [readMotion])

  return useCallback(() => {
    if (roomRef.current) roomRef.current.beginExpansion(3500)
  }, [])
}
```

- [ ] **Step 2: Lint the new hook**

Run: `npx eslint src/hooks/useAdmirerRoom.js`
Expected: clean.

- [ ] **Step 3: Import the hook in `Admirer.jsx`**

In `src/phases/Admirer.jsx`, find:

```js
import FragmentControls from './FragmentControls'
```

Replace it with:

```js
import FragmentControls from './FragmentControls'
import { useAdmirerRoom } from '../hooks/useAdmirerRoom.js'
```

- [ ] **Step 4: Add the `generationStarted` state**

In `Admirer.jsx`, find the state declarations at the top of `AdmirerInner`:

```js
  const [hasError, setHasError] = useState(false)
  const [fragmentPlaying, setFragmentPlaying] = useState(false)
  const [awaitingRating, setAwaitingRating] = useState(false)
```

Replace with:

```js
  const [hasError, setHasError] = useState(false)
  const [fragmentPlaying, setFragmentPlaying] = useState(false)
  const [awaitingRating, setAwaitingRating] = useState(false)
  const [generationStarted, setGenerationStarted] = useState(false)
```

- [ ] **Step 5: Raise the flag when the agent commits a direction**

In `Admirer.jsx`, find the start of the `onStartGeneration` callback:

```js
  const onStartGeneration = useCallback(async (bundle) => {
    // The listening run is over — kill any fragment still playing and any
    // pending rating prompt.
    clearFragmentPlayback()
    setFragmentPlaying(false)
    setAwaitingRating(false)
    stemsBundleRef.current = bundle
```

Replace with:

```js
  const onStartGeneration = useCallback(async (bundle) => {
    // The listening run is over — kill any fragment still playing and any
    // pending rating prompt.
    clearFragmentPlayback()
    setFragmentPlaying(false)
    setAwaitingRating(false)
    // The conversation has resolved — let the room begin to open.
    setGenerationStarted(true)
    stemsBundleRef.current = bundle
```

- [ ] **Step 6: Call the hook and trigger the expansion**

In `Admirer.jsx`, find the `useAdmirerAgent` destructure block:

```js
  const {
    connect,
    status,
    isSpeaking,
    isMuted,
    setMuted,
    sendUserMessage,
  } = useAdmirerAgent({
    sessionStage: 'opening',
    callbacks: { onPlayFragment, onStartGeneration, onCommitEntry, onRecordLexicon },
  })
```

Immediately after that block (after its closing `})`), insert:

```js

  // Build A — the spatial room. Routes the agent's voice through an HRTF
  // room and opens it at the phase-1 → phase-2 handoff.
  const beginExpansion = useAdmirerRoom({ getAudioCtx, status })

  // When the agent commits a direction, open the room. The room's expansion
  // is the phase-1 → phase-2 transition — the closed conversation room
  // audibly widening into the orchestra under the agent's closing words.
  useEffect(() => {
    if (generationStarted) beginExpansion()
  }, [generationStarted, beginExpansion])
```

- [ ] **Step 7: Lint and build**

Run: `npx eslint src/phases/Admirer.jsx src/hooks/useAdmirerRoom.js`
Expected: for `Admirer.jsx`, only the two known pre-existing items (`'motion' is defined but never used`; the `react-hooks/exhaustive-deps` warning on the pre-existing unmount effect). For `useAdmirerRoom.js`, clean. Any other error/warning means an edit is wrong — fix it.

Run: `npm run build`
Expected: success.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: **265 passed**.

- [ ] **Step 9: Commit**

```bash
git add src/phases/Admirer.jsx src/hooks/useAdmirerRoom.js
git commit -m "feat(musicking): route the Admirer voice through the room; expand at the handoff

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 10: Manual verification — the full integration**

This step needs a real device with headphones (and ideally a phone, for motion). It cannot be automated. Run `npm run dev`, open on a phone with headphones, and walk Entry → Admirer → Orchestra:

1. **Permission.** Tapping "begin" on Entry shows the iOS motion-permission prompt (on iOS). Grant it.
2. **Voice is in the room.** When the Admirer speaks, the voice is *externalised* — it sounds like it comes from a point in front of you, slightly above, not from inside your head. It is heard once, not doubled.
3. **Voice is not silent.** If you hear nothing when the Admirer should be speaking, capture over-muted the element — see the troubleshooting note below.
4. **Phone places the voice.** Tilting the phone left/right (roll) swings the voice gently within the room (a small ±20° swing, not a hard pan).
5. **The glyph follows.** A faint ink trail forms on screen, following the phone's tilt — calm, low-opacity, never demanding attention.
6. **The room opens.** When the conversation resolves (the agent gives its closing "it's coming…" line), the room audibly *widens* — more reverb, a longer, brighter space — over ~3.5 s, under the agent's last words.
7. **The handoff is unbroken.** Crossing into the Orchestra phase: no click, no gap, no silence; the matched track blooms into the now-expanded room.
8. **Graceful degradation.** If you test on desktop (no device motion): the voice still plays (centred), the glyph stays near centre, everything else works.

**Troubleshooting note (single known browser-variance point).** The voice routing depends on one line — `el.muted = true` in `captureAdmirerVoice` (`AdmirerRoom.js`). The spike chose `createMediaStreamSource` precisely because muting the `<audio>` element reliably kills its direct output without affecting the tapped `MediaStream`. If verification step 2 shows **doubled** audio, the mute did not take — confirm the element matched by the selector is the right one. If step 3 shows **silence**, the element's stream is the only path and muting killed it — in that case the SDK build differs from the spike's; fall back to the spike's documented `onAudio` PCM path (`docs/admirer-spatial-spike.md` §1.6). Record the outcome either way.

Record the verification result in `todo.md` or the next commit message.

---

## Parked — still deferred after this plan

- **The Orchestra-phase guidance voice.** Unchanged from the parent plan: the Orchestra phase will later get a spatial conducting-guidance voice, personalised from Phase 1. It belongs with the broader voice redesign parked in `CLAUDE.md`. The room built here is ready to host it — a second source through `AdmirerRoom`-style routing — but it is not built now.
- **Reconnect handling.** `docs/admirer-spatial-spike.md` §4 notes that if the Admirer session reconnects mid-conversation the SDK swaps its `<audio>` element. `useAdmirerRoom` captures once (`capturedRef`) and does not re-capture on a reconnect within the same mount. Mid-conversation reconnects are rare and the conversation degrades to unspatialised voice, not silence (the old source node simply goes inert). If reconnects prove common in testing, add a re-capture on the `status` `connected→…→connected` cycle as a small follow-up.

---

## Self-review

- **Spec coverage.** Task 1 builds the `AdmirerRoom` audio module (parent Task 13). Task 2 adds phone-motion reading + the iOS permission (parent Task 14). Task 3 adds the glyph layer (parent Task 15). Task 4 wires the room in and makes its expansion the phase transition (parent Task 16). All four parent-plan integration tasks are covered.
- **Placeholders.** None. Every file is given in full; every modification is an exact find/replace against the current source; every command has an expected result. The one "if X, do Y" — the troubleshooting note in Task 4 Step 10 — is a deliberate, documented fallback for a single genuine browser-variance point the spike already flagged, not a gap in the code (the code is complete and concrete).
- **Type/name consistency.** `AdmirerRoom` exports `default` (the class), `captureAdmirerVoice`, `rollToAzimuthOffset`, `MAX_AZIMUTH_OFFSET_DEG` — all consumed exactly as exported by `useAdmirerRoom.js` and `AdmirerRoom.test.js`. `usePhoneMotion` returns a `read()` function; `useAdmirerRoom` and `GlyphCanvas` both call it and read `.gamma` / `.pan` / `.filterNorm`, which `GestureCore.read()` returns. `useAdmirerRoom({ getAudioCtx, status })` is called with exactly the `getAudioCtx` prop and the `status` value `Admirer.jsx` already has in scope.
- **Decomposition.** `AdmirerRoom.js` is pure audio (no React); `usePhoneMotion.js` / `useAdmirerRoom.js` are hooks; `GlyphCanvas.jsx` is one presentational canvas; `Admirer.jsx` only orchestrates. The heavy room logic lives in the hook, so `Admirer.jsx` grows by ~8 lines — keeping it off the size watch-point the parent plan's final review raised.
- **Honest testing.** The one pure function (`rollToAzimuthOffset`) is TDD'd. The Web-Audio / hook / canvas / DOM code is verified by lint, build, the full suite, and an explicit see/hear checklist — matching the parent plan and the codebase's established practice for non-pure code.
- **Graceful degradation.** Every failure path is non-fatal: no audio context, failed voice capture, denied motion permission, missing hall IR — each degrades to a working (if less spatial) experience. The voice is never gated on the room.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-build-a-room-integration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review (spec compliance, then code quality) between tasks, fast iteration.

**2. Inline Execution** — execute the tasks in this session with checkpoints for review.

Note: Task 4 Step 10 (the see/hear checklist) requires a real device with headphones and is the project lead's manual step regardless of which execution mode is chosen.
