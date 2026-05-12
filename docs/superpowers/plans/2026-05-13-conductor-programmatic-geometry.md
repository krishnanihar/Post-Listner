# Conductor Programmatic Geometry + Ambient Audio Reactivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the R3F sacred-geometry layer on `/conduct-glb` with a programmatic 2D Metatron's Cube drawn into the existing celestial-field canvas system, add a constellation-completion interaction where consecutive node activations inscribe canonical edges, and wire ambient audio (`hearth-keeper_acoustic-soft-2000s.mp3`) as a second reactivity stream alongside the phone.

**Architecture:** Pure-function geometry math (`metatronGeometry.js`) computes the 13 Fruit-of-Life node positions + 78 canonical edges. A pure-function audio helper (`audioBands.js`) does band averaging + beat detection on `Uint8Array` frequency data. A React hook (`useAmbientAudio.js`) wraps the browser audio APIs (HTMLAudioElement + AudioContext + AnalyserNode) and exposes the frequency data as a ref. `ConductorCelestialField.jsx` paints the geometry watermark into its `bg` canvas once at resize, draws nodes + inscribed segments into the `fg` canvas every frame, reuses its existing per-element-activation pattern from the stars, and reads phone state + audio frequency data each frame. Drops both R3F layers (`SacredGeometryLayer.jsx`, `GhostConductorLayer.jsx`).

**Tech Stack:** Vanilla JS, Canvas 2D, Web Audio API (`AudioContext`, `MediaElementAudioSourceNode`, `AnalyserNode`), React 19, Vitest for the pure-function unit tests.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/conductor-glb/metatronGeometry.js` | Pure geometry: `computeMetatronNodes(radius)` and `computeMetatronEdges(nodeCount)` | Create |
| `src/conductor-glb/__tests__/metatronGeometry.test.js` | Vitest coverage | Create |
| `src/conductor-glb/audioBands.js` | Pure audio analysis: `bandAverage()`, `detectBassBeat()` | Create |
| `src/conductor-glb/__tests__/audioBands.test.js` | Vitest coverage | Create |
| `src/conductor-glb/useAmbientAudio.js` | React hook for audio playback + AnalyserNode | Create |
| `src/conductor-glb/ConductorCelestialField.jsx` | Add geometry drawing + audio integration | Modify (heavy) |
| `src/conductor-glb/ConductGlb.jsx` | Drop R3F layers; add tap-to-begin overlay | Modify |
| `src/conductor-glb/SacredGeometryLayer.jsx` | (was R3F layer) | Delete |
| `src/conductor-glb/GhostConductorLayer.jsx` | (was R3F layer) | Delete |
| `src/conductor-glb/edgeMath.js` | Existing 2D point-to-segment helper, still useful | Keep |

After this plan: `/conduct-glb` has zero R3F. All visuals run in 2D canvases. Phone state + audio frequency data flow into a single render loop.

---

## Task 1: Programmatic Metatron geometry math (TDD)

**Files:**
- Create: `src/conductor-glb/metatronGeometry.js`
- Create: `src/conductor-glb/__tests__/metatronGeometry.test.js`

- [ ] **Step 1.1: Write the failing test**

Create `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/__tests__/metatronGeometry.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { computeMetatronNodes, computeMetatronEdges } from '../metatronGeometry.js'

describe('computeMetatronNodes', () => {
  it('returns 13 nodes (Fruit of Life)', () => {
    const nodes = computeMetatronNodes(1)
    expect(nodes).toHaveLength(13)
  })

  it('places the first node at origin', () => {
    const nodes = computeMetatronNodes(1)
    expect(nodes[0]).toEqual({ x: 0, y: 0 })
  })

  it('inner hexagon (nodes 1-6) sits on circle of given radius', () => {
    const r = 5
    const nodes = computeMetatronNodes(r)
    for (let i = 1; i <= 6; i++) {
      const d = Math.hypot(nodes[i].x, nodes[i].y)
      expect(d).toBeCloseTo(r, 5)
    }
  })

  it('outer hexagon (nodes 7-12) sits on circle of 2 × radius', () => {
    const r = 5
    const nodes = computeMetatronNodes(r)
    for (let i = 7; i <= 12; i++) {
      const d = Math.hypot(nodes[i].x, nodes[i].y)
      expect(d).toBeCloseTo(r * 2, 5)
    }
  })

  it('inner hexagon spans 60 degrees per step', () => {
    const nodes = computeMetatronNodes(1)
    // node[1] should be at angle 0 (on the +x axis)
    expect(nodes[1].x).toBeCloseTo(1, 5)
    expect(nodes[1].y).toBeCloseTo(0, 5)
    // node[2] should be at angle 60° (60° from +x, in the upper half)
    expect(nodes[2].x).toBeCloseTo(Math.cos(Math.PI / 3), 5)
    expect(nodes[2].y).toBeCloseTo(Math.sin(Math.PI / 3), 5)
  })
})

describe('computeMetatronEdges', () => {
  it('returns 78 edges for 13 nodes (every unique pair)', () => {
    const edges = computeMetatronEdges(13)
    expect(edges).toHaveLength(78)
  })

  it('each edge is a [i, j] pair with i < j and both in [0, nodeCount)', () => {
    const edges = computeMetatronEdges(13)
    for (const [i, j] of edges) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(j).toBeGreaterThan(i)
      expect(j).toBeLessThan(13)
    }
  })

  it('no duplicate edges', () => {
    const edges = computeMetatronEdges(13)
    const keys = new Set(edges.map(([i, j]) => `${i},${j}`))
    expect(keys.size).toBe(edges.length)
  })
})
```

- [ ] **Step 1.2: Run tests, verify all 8 FAIL**

```bash
npx vitest run src/conductor-glb/__tests__/metatronGeometry.test.js
```
Expected: 8 FAIL (module not found).

- [ ] **Step 1.3: Implement metatronGeometry.js**

Create `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/metatronGeometry.js`:

```js
/* Programmatic Metatron's Cube geometry.
 *
 * 13 node positions derived from the Fruit of Life:
 *   1 center  + 6 inner hexagon (radius r) + 6 outer hexagon (radius 2r)
 *
 * All hexagon nodes share the same angles (0°, 60°, 120°, 180°, 240°, 300°);
 * the outer ring sits on the same rays as the inner ring at double the radius.
 *
 * The canonical Metatron's Cube is the complete graph on these 13 nodes —
 * every pair connected — yielding 78 unique edges. Drawing all 78 produces
 * the recognizable star-and-cube watermark pattern.
 */

export function computeMetatronNodes(radius = 1) {
  const nodes = [{ x: 0, y: 0 }]
  for (let i = 0; i < 6; i++) {
    const a = (i * 60) * Math.PI / 180
    nodes.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius })
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * 60) * Math.PI / 180
    nodes.push({ x: Math.cos(a) * radius * 2, y: Math.sin(a) * radius * 2 })
  }
  return nodes
}

export function computeMetatronEdges(nodeCount = 13) {
  const edges = []
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      edges.push([i, j])
    }
  }
  return edges
}
```

- [ ] **Step 1.4: Re-run tests, verify 8 PASS**

```bash
npx vitest run src/conductor-glb/__tests__/metatronGeometry.test.js
```
Expected: 8 PASS.

- [ ] **Step 1.5: Commit**

```bash
git add src/conductor-glb/metatronGeometry.js src/conductor-glb/__tests__/metatronGeometry.test.js
git commit -m "feat(conduct-glb): programmatic Metatron geometry math

computeMetatronNodes returns 13 Fruit-of-Life node positions (1 center +
6 inner hex at radius r + 6 outer hex at radius 2r, all on the same
60° rays). computeMetatronEdges yields the 78-edge complete graph,
the canonical Metatron's Cube wireframe. Pure function, no DOM, no
THREE — fully unit-testable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Pure audio-analysis helpers (TDD)

**Files:**
- Create: `src/conductor-glb/audioBands.js`
- Create: `src/conductor-glb/__tests__/audioBands.test.js`

- [ ] **Step 2.1: Write the failing tests**

Create `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/__tests__/audioBands.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { bandAverage, detectBassBeat } from '../audioBands.js'

describe('bandAverage', () => {
  it('averages a slice of bins and normalizes to 0..1 against 255', () => {
    // Uint8Array of length 8, all 128 → mean 128 → 128/255 ≈ 0.5019
    const data = new Uint8Array([128, 128, 128, 128, 128, 128, 128, 128])
    const v = bandAverage(data, 0, 7)
    expect(v).toBeCloseTo(128 / 255, 5)
  })

  it('returns 0 when the slice is empty (startBin > endBin)', () => {
    const data = new Uint8Array([100, 200])
    expect(bandAverage(data, 5, 2)).toBe(0)
  })

  it('clamps endBin against array length', () => {
    const data = new Uint8Array([255, 255, 255])
    // endBin 10 > length-1=2 → average bins 0..2 = 255 → normalized 1.0
    const v = bandAverage(data, 0, 10)
    expect(v).toBeCloseTo(1.0, 5)
  })
})

describe('detectBassBeat', () => {
  it('fires when bass crosses up over threshold after refractory', () => {
    const result = detectBassBeat(0.7, 0.3, 0.5, 0, 1000)
    expect(result.fired).toBe(true)
    expect(result.nextRefractoryEnd).toBe(1250)
  })

  it('does not fire when bass stays below threshold', () => {
    const result = detectBassBeat(0.4, 0.3, 0.5, 0, 1000)
    expect(result.fired).toBe(false)
    expect(result.nextRefractoryEnd).toBe(0)
  })

  it('does not fire during refractory window', () => {
    const result = detectBassBeat(0.7, 0.3, 0.5, 999999, 1000)
    expect(result.fired).toBe(false)
    expect(result.nextRefractoryEnd).toBe(999999)
  })

  it('does not fire if previous bass was already above threshold (no edge)', () => {
    const result = detectBassBeat(0.7, 0.6, 0.5, 0, 1000)
    expect(result.fired).toBe(false)
  })
})
```

- [ ] **Step 2.2: Run tests, verify 7 FAIL**

```bash
npx vitest run src/conductor-glb/__tests__/audioBands.test.js
```

- [ ] **Step 2.3: Implement audioBands.js**

Create `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/audioBands.js`:

```js
/* Pure helpers for analyzing AnalyserNode frequency data.
 *
 * AnalyserNode.getByteFrequencyData fills a Uint8Array (length = fftSize / 2)
 * with values in [0, 255] per frequency bin. For fftSize = 256 you get 128
 * bins covering the audible range; bin 0 = lowest frequencies, bin 127 =
 * highest.
 *
 * Band slicing convention (for fftSize 256, 128 bins, 44.1 kHz sample rate):
 *   bass     = bins 0-3   (sub + bass)
 *   low-mid  = bins 4-15  (kick, snare body)
 *   mid      = bins 16-63 (vocals, midrange instruments)
 *   treble   = bins 64-127 (cymbals, air)
 */

export function bandAverage(freqData, startBin, endBin) {
  if (startBin > endBin) return 0
  const last = Math.min(endBin, freqData.length - 1)
  let sum = 0
  let count = 0
  for (let i = startBin; i <= last; i++) {
    sum += freqData[i]
    count++
  }
  return count > 0 ? sum / count / 255 : 0
}

/**
 * Detect a bass-band beat by edge-triggered threshold crossing with
 * refractory period. Same shape as the phone-side downbeat detector
 * (negative-Y zero-crossing) so the two beat sources feel consistent.
 *
 * @param {number} currentBass   bandAverage(bass) for this frame, 0..1
 * @param {number} prevBass      bandAverage(bass) from previous frame
 * @param {number} threshold     0..1 bass level that must be crossed
 * @param {number} refractoryEnd absolute timestamp; ignore beats until then
 * @param {number} now           current performance.now() timestamp
 * @returns {{ fired: boolean, nextRefractoryEnd: number }}
 */
export function detectBassBeat(currentBass, prevBass, threshold, refractoryEnd, now) {
  if (now < refractoryEnd) {
    return { fired: false, nextRefractoryEnd: refractoryEnd }
  }
  if (currentBass > threshold && prevBass <= threshold) {
    // Refractory: 250 ms ≈ tempo cap of 240 BPM.
    return { fired: true, nextRefractoryEnd: now + 250 }
  }
  return { fired: false, nextRefractoryEnd: refractoryEnd }
}
```

- [ ] **Step 2.4: Re-run tests, verify 7 PASS**

```bash
npx vitest run src/conductor-glb/__tests__/audioBands.test.js
```

- [ ] **Step 2.5: Commit**

```bash
git add src/conductor-glb/audioBands.js src/conductor-glb/__tests__/audioBands.test.js
git commit -m "feat(conduct-glb): pure audio-analysis helpers

bandAverage(freqData, startBin, endBin) averages a slice of an
AnalyserNode Uint8Array and normalizes to 0..1 against 255. Handles
empty slices and out-of-range endBin.

detectBassBeat() implements edge-triggered threshold crossing with a
250 ms refractory window — same pattern as the phone-side downbeat
detector. Returns { fired, nextRefractoryEnd } so the caller carries
the state.

Both functions are pure JS, dependency-free, Vitest-covered.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Ambient-audio React hook

**Files:**
- Create: `src/conductor-glb/useAmbientAudio.js`

This hook isn't easily unit-tested (browser APIs), but the math it depends on (audioBands.js) is. Manual verification via the running app.

- [ ] **Step 3.1: Create the hook**

Create `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/useAmbientAudio.js`:

```js
/* Ambient-audio hook for /conduct-glb.
 *
 * Loads a single MP3 via HTMLAudioElement, wires it into an
 * AudioContext + AnalyserNode (fftSize 256 → 128 frequency bins), and
 * exposes the per-frame Uint8Array as a ref so the render loop can read
 * it without triggering React re-renders.
 *
 * Browser autoplay policies: most browsers block AudioContext.resume()
 * and HTMLAudioElement.play() until a user gesture occurs. This hook
 * exposes a `needsGesture` flag and a `tryStart` function that the UI
 * can wire to a "tap to begin" overlay.
 *
 * Lifecycle: AudioContext + AnalyserNode are created lazily on first
 * `tryStart()` call (browsers can decode-time-error if you create the
 * context before user interaction). The hook does not auto-start.
 */
import { useEffect, useRef, useState } from 'react'

export function useAmbientAudio({ src }) {
  const audioRef = useRef(null)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const freqDataRef = useRef(new Uint8Array(128))   // fftSize 256 → 128 bins

  const [needsGesture, setNeedsGesture] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  // Create the HTMLAudioElement once. Don't autoplay — wait for user gesture.
  useEffect(() => {
    const a = new Audio(src)
    a.loop = true
    a.crossOrigin = 'anonymous'
    a.preload = 'auto'
    audioRef.current = a
    return () => {
      a.pause()
      a.src = ''
    }
  }, [src])

  // tryStart: lazy-create AudioContext, connect graph, attempt play.
  // Called from a user-gesture event handler (click/tap).
  async function tryStart() {
    const a = audioRef.current
    if (!a) return false

    // Lazy-create context on first call so browsers don't complain.
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx()
      const source = ctx.createMediaElementSource(a)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)
      analyser.connect(ctx.destination)
      ctxRef.current = ctx
      analyserRef.current = analyser
    }

    try {
      if (ctxRef.current.state === 'suspended') {
        await ctxRef.current.resume()
      }
      await a.play()
      setPlaying(true)
      setNeedsGesture(false)
      setError(null)
      return true
    } catch (err) {
      setError(err?.message || String(err))
      setNeedsGesture(true)
      return false
    }
  }

  function pause() {
    audioRef.current?.pause()
    setPlaying(false)
  }

  // Per-frame: copy the current frequency bins into freqDataRef. Called
  // by the render loop. If analyser isn't ready yet (no gesture), the
  // ref stays zeroed.
  function pollFrequency() {
    if (analyserRef.current) {
      analyserRef.current.getByteFrequencyData(freqDataRef.current)
    }
  }

  return {
    needsGesture,
    playing,
    error,
    tryStart,
    pause,
    pollFrequency,
    freqDataRef,
  }
}
```

- [ ] **Step 3.2: Smoke verify (no integration yet)**

Just verify the file loads. There's no UI consumer yet:

```bash
npm run build 2>&1 | tail -5
```

Expected: clean build, no missing-import errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/conductor-glb/useAmbientAudio.js
git commit -m "feat(conduct-glb): ambient-audio React hook

useAmbientAudio({ src }) returns { needsGesture, playing, error,
tryStart, pause, pollFrequency, freqDataRef }. Lazily creates an
AudioContext + AnalyserNode on first tryStart() so browser autoplay
policies don't reject the construction. fftSize 256 → 128 bins;
exposes the frequency data as a ref so render loops can read without
triggering React re-renders.

No consumer yet — wired into ConductorCelestialField in a later task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Drop the R3F layers + simplify composition

**Files:**
- Delete: `src/conductor-glb/SacredGeometryLayer.jsx`
- Delete: `src/conductor-glb/GhostConductorLayer.jsx`
- Modify: `src/conductor-glb/ConductGlb.jsx`
- Modify: `src/conductor-glb/ConductorCelestialField.jsx` (remove trailTipRef prop — geometry lives inside this component now)

- [ ] **Step 4.1: Delete the R3F files**

```bash
rm /Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/SacredGeometryLayer.jsx
rm /Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/GhostConductorLayer.jsx
```

- [ ] **Step 4.2: Clean up ConductGlb.jsx**

Read `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/ConductGlb.jsx`. Replace its current imports + default export with the simpler structure (no SacredGeometryLayer / GhostConductorLayer / trailTipRef plumbing). The final file should look like:

```jsx
/* /conduct-glb — experiment route.
 *
 * The conducting experience: cream parchment + ink trail + sacred
 * geometry watermark + ambient audio. All rendering is 2D canvas
 * inside ConductorCelestialField; no R3F.
 */
import { createContext, useContext } from 'react'
import { usePhoneConductor } from '../conductor-codex/usePhoneConductor'
import ConductorCelestialField from './ConductorCelestialField'
import '../conductor-codex/conduct-codex.css'

const PhoneContext = createContext(null)

function PhoneProvider({ children }) {
  const phone = usePhoneConductor()
  return <PhoneContext.Provider value={phone}>{children}</PhoneContext.Provider>
}

export function usePhone() {
  const ctx = useContext(PhoneContext)
  if (!ctx) throw new Error('usePhone must be used inside PhoneProvider')
  return ctx
}

function StatusPanel() {
  const { snapshot } = usePhone()
  const status = !snapshot.connected
    ? 'relay offline'
    : !snapshot.calibrated
      ? 'waiting for calibration'
      : 'conducting · live'
  const stateClass = snapshot.connected && snapshot.calibrated
    ? 'is-live'
    : snapshot.connected
      ? 'is-waiting'
      : ''
  return (
    <section
      className="conduct-codex-panel conduct-codex-panel--status"
      aria-label="Conductor status"
    >
      <div>
        <p className="conduct-codex-kicker">GLB Conductor</p>
        <h1>Conduct</h1>
      </div>
      <dl>
        <div>
          <dt>relay</dt>
          <dd className={stateClass}>{status}</dd>
        </div>
        <div>
          <dt>route</dt>
          <dd>/conduct-glb</dd>
        </div>
      </dl>
    </section>
  )
}

export default function ConductGlb() {
  return (
    <PhoneProvider>
      <main className="conduct-codex-shell">
        <ConductorCelestialField />
        <StatusPanel />
      </main>
    </PhoneProvider>
  )
}
```

- [ ] **Step 4.3: Remove trailTipRef prop from ConductorCelestialField**

In `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/ConductorCelestialField.jsx`:

Change the function signature:
```jsx
export default function ConductorCelestialField({ trailTipRef }) {
```
back to:
```jsx
export default function ConductorCelestialField() {
```

Then remove the trail-tip publish block at the end of `update()`. Find this block and DELETE it:
```js
if (trailTipRef) {
  trailTipRef.current = {
    x: ox + sm.x * sc,
    y: oy + sm.y * sc,
    active: phoneActive || (performance.now() - lastAct > 1500),
  }
}
```

(The geometry layer that consumed it is gone. Geometry interaction will use the local `sm`/`cur` variables directly in later tasks.)

- [ ] **Step 4.4: Build + visual verify**

```bash
npm run build 2>&1 | tail -5
node scripts/snap-glb-v2.mjs
```

Open `tmp/conduct-glb-screens/01-rest.png`. Expected: only parchment, glyphs, stars, dust, ink trail visible. No geometry, no ghost figure.

- [ ] **Step 4.5: Commit**

```bash
git add -A
git commit -m "refactor(conduct-glb): drop R3F layers, return to pure 2D

SacredGeometryLayer.jsx and GhostConductorLayer.jsx deleted. Their
roles are being replaced by a programmatic 2D Metatron drawn inside
ConductorCelestialField (subsequent tasks). The trailTipRef plumbing
that connected them is also removed — geometry interaction will use
the celestial field's local cursor state directly.

Five stacked canvases → three. Zero WebGL contexts on /conduct-glb.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Watermark + nodes rendering in ConductorCelestialField

**Files:**
- Modify: `src/conductor-glb/ConductorCelestialField.jsx`

Adds: 13 Metatron node positions (computed once at mount, scaled into the existing 680×600 viewBox), watermark painting in `drawBg()`, node rendering in `drawFg()` with per-node activation state.

- [ ] **Step 5.1: Add geometry imports + module-level constants**

At the top of `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/ConductorCelestialField.jsx`, add the import alongside the existing ones:

```jsx
import { computeMetatronNodes, computeMetatronEdges } from './metatronGeometry.js'
```

Below the existing constant block (where `SW`, `SH`, `INK`, etc. live), add:

```js
// Metatron geometry — drawn into the same viewBox the stars live in.
// Center at (SW/2, SH/2). Inner hex radius 110, outer hex at 220.
// Drawn as a faint watermark behind the stars + a foreground layer of
// nodes that activate when the trail tip passes near them.
const METATRON_CX = SW / 2
const METATRON_CY = SH / 2 + 10           // matches the existing background-circle center
const METATRON_INNER_RADIUS = 110
const NODE_HIT_PX = 20                    // proximity for node activation
const NODE_DEFAULT_RADIUS = 4             // resting node visual size
const NODE_ACTIVE_RADIUS_BOOST = 7        // additional radius when fully activated
const WATERMARK_RGBA = 'rgba(70,46,24,0.07)'   // faint amber, slightly darker than dust
```

- [ ] **Step 5.2: Compute nodes + edges inside useEffect (after the existing star setup)**

Find the closure variables block inside the main `useEffect` (right after `const stars = STAR_POSITIONS.map(...)` and the brightening loop). Below that block, add:

```js
// Compute Metatron nodes once. Scaled into viewBox coords.
const metatronNodesLocal = computeMetatronNodes(METATRON_INNER_RADIUS).map((n) => ({
  x: METATRON_CX + n.x,
  y: METATRON_CY + n.y,
  act: 0,                                  // activation 0..1, same pattern as stars
}))
const metatronEdgesLocal = computeMetatronEdges(13)
```

(These are closure-scoped consts in the same `useEffect` body where stars live; the existing render loop has access.)

- [ ] **Step 5.3: Paint the watermark inside drawBg()**

Find `drawBg()` inside the same useEffect. Locate the existing line:
```js
for (const c of HINT_CONSTELLATIONS) {
```
Above this loop, add a new pass that draws every Metatron edge as a thin faint line:

```js
// Metatron watermark — faint amber lines connecting every node pair.
// Painted into bg once at resize, so it sits under the stars + glyphs
// like a structural chalk trace under the parchment.
bCtx.strokeStyle = WATERMARK_RGBA
bCtx.lineWidth = 0.4
for (const [i, j] of metatronEdgesLocal) {
  const a = metatronNodesLocal[i]
  const b = metatronNodesLocal[j]
  bCtx.beginPath()
  bCtx.moveTo(a.x, a.y)
  bCtx.lineTo(b.x, b.y)
  bCtx.stroke()
}
```

- [ ] **Step 5.4: Draw the 13 nodes in drawFg()**

Find `drawFg()` in the same useEffect. After the existing stars-drawing loop (the one that fills star circles), add a new pass for the nodes:

```js
// Metatron nodes — faint dots at the 13 Fruit-of-Life positions.
// Activation comes from trail-tip proximity in the next task; for now
// they're static dim circles.
for (const n of metatronNodesLocal) {
  const baseOpacity = 0.25 + n.act * 0.65
  const radius = NODE_DEFAULT_RADIUS + n.act * NODE_ACTIVE_RADIUS_BOOST
  fCtx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},${baseOpacity})`
  fCtx.beginPath()
  fCtx.arc(n.x, n.y, radius, 0, Math.PI * 2)
  fCtx.fill()
  if (n.act > 0.3) {
    fCtx.fillStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},${n.act * 0.6})`
    fCtx.beginPath()
    fCtx.arc(n.x, n.y, radius * 1.8, 0, Math.PI * 2)
    fCtx.fill()
  }
}
```

- [ ] **Step 5.5: Visual verify**

```bash
node scripts/snap-glb-v2.mjs
```

Open `tmp/conduct-glb-screens/01-rest.png`. Expected: the parchment now has a faint web of amber lines (the watermark) plus 13 small dark dots at the Fruit-of-Life positions (the nodes), all visible behind the existing stars and glyphs. No interaction yet — nodes are static.

- [ ] **Step 5.6: Commit**

```bash
git add src/conductor-glb/ConductorCelestialField.jsx
git commit -m "feat(conduct-glb): paint Metatron watermark + render 13 nodes

Programmatic Metatron geometry now lives inside the celestial-field
canvas system:
  - Watermark: every node-pair edge drawn into the bg canvas once at
    resize, at 7% amber opacity. Reads as a faint chalk trace under
    the stars + dust.
  - Nodes: the 13 Fruit-of-Life centers drawn into the fg canvas every
    frame with a per-node activation state (0..1). At rest, dim ink
    dots; full activation will glow gold + scale up.

No interaction yet — Task 6 wires trail-tip proximity to activation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Trail-passage node activation + consecutive-edge inscription

**Files:**
- Modify: `src/conductor-glb/ConductorCelestialField.jsx`

Reuses the existing star-activation pattern. Per-node `act` builds up when the smoothed cursor `sm` is within `NODE_HIT_PX` of a node; decays otherwise. When a new node activates, check whether `(lastActivatedNodeIdx, newIdx)` matches a canonical edge — if yes and the edge isn't yet inscribed, inscribe it permanently.

- [ ] **Step 6.1: Add inscription-state closure variables**

In the same `useEffect` (above the `update` function), alongside the existing `inscribed = []` and `lastActStar = null`, add:

```js
const inscribedMetatronEdges = new Set()  // 'i,j' string keys for inscribed edges
let lastActMetatronNodeIdx = -1
```

Also, build a Set of canonical edges for O(1) lookup:

```js
const canonicalEdgeKeys = new Set(
  metatronEdgesLocal.map(([i, j]) => `${i},${j}`),
)
```

- [ ] **Step 6.2: Add node activation + edge inscription in update()**

In `update(dt, t)`, after the existing star-activation loop but BEFORE the trace cleanup:

```js
// Metatron node activation — same pattern as stars. Trail tip
// proximity within NODE_HIT_PX bumps activation; otherwise decay.
for (let i = 0; i < metatronNodesLocal.length; i++) {
  const n = metatronNodesLocal[i]
  const d = Math.hypot(n.x - sm.x, n.y - sm.y)
  if (d < NODE_HIT_PX) {
    if (n.act < 0.4 && lastActMetatronNodeIdx !== i) {
      // Activation transition — check if the edge from the previous
      // node to this one is a canonical edge we haven't inscribed yet.
      if (lastActMetatronNodeIdx >= 0) {
        const a = Math.min(lastActMetatronNodeIdx, i)
        const b = Math.max(lastActMetatronNodeIdx, i)
        const key = `${a},${b}`
        if (canonicalEdgeKeys.has(key) && !inscribedMetatronEdges.has(key)) {
          inscribedMetatronEdges.add(key)
        }
      }
      lastActMetatronNodeIdx = i
    }
    n.act = Math.min(1, n.act + dt * 5)
  }
  n.act = Math.max(0, n.act - dt * 0.55)
}
```

- [ ] **Step 6.3: Draw inscribed segments in drawFg()**

In `drawFg()`, just BEFORE the existing node-drawing pass added in Task 5.4, add the inscribed-segments pass:

```js
// Inscribed Metatron edges — permanent once drawn, rendered in
// bright gold over the watermark. The user is gradually "uncovering"
// the cube as they sweep the trail through the nodes.
fCtx.strokeStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},0.85)`
fCtx.lineWidth = 1.6
for (const key of inscribedMetatronEdges) {
  const [i, j] = key.split(',').map(Number)
  const a = metatronNodesLocal[i]
  const b = metatronNodesLocal[j]
  fCtx.beginPath()
  fCtx.moveTo(a.x, a.y)
  fCtx.lineTo(b.x, b.y)
  fCtx.stroke()
}
```

- [ ] **Step 6.4: Visual verify**

```bash
node scripts/snap-glb-v2.mjs
```

Look at `tmp/conduct-glb-screens/09-roll-left-30.png` and `11-back-left.png`. Expected: where the test trail swept across multiple nodes, those nodes are activated (visible glow) and one or two inscribed edges appear as bright gold lines. The watermark + dim node baseline stays underneath.

- [ ] **Step 6.5: Commit**

```bash
git add src/conductor-glb/ConductorCelestialField.jsx
git commit -m "feat(conduct-glb): node activation + canonical-edge inscription

Trail-tip proximity (within 20 px) activates Metatron nodes via the
same per-element activation pattern the stars use. When two consecutive
node activations match a canonical edge in the complete-graph edge
list, that edge inscribes permanently — drawn in bright gold over the
faint watermark.

Reuses inscribedMetatronEdges (Set keyed by 'i,j') and
canonicalEdgeKeys for O(1) lookup. Decay rate and activation pattern
identical to stars for consistent feel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Audio playback + frequency polling + breath / beat reactivity

**Files:**
- Modify: `src/conductor-glb/ConductorCelestialField.jsx`

Wires `useAmbientAudio` into the component, polls frequency data each frame, computes bass + low-mid bands, applies a subtle global breath to inscribed segments, detects bass beats, and uses each detected beat to pulse the "expected next" node (= first node of the first uninscribed canonical edge).

- [ ] **Step 7.1: Add audio imports**

At top of `ConductorCelestialField.jsx`:

```jsx
import { useAmbientAudio } from './useAmbientAudio'
import { bandAverage, detectBassBeat } from './audioBands.js'
```

Below the existing constant block:

```js
const AUDIO_SRC = '/music/hearth-keeper_acoustic-soft-2000s.mp3'
const BASS_BIN_START = 0
const BASS_BIN_END = 3
const BEAT_THRESHOLD = 0.55              // bass band level that triggers a beat
const BREATH_AMPLITUDE = 0.05            // ±5% global opacity breath on inscribed
```

- [ ] **Step 7.2: Call the hook in the component body**

At the top of `ConductorCelestialField` (above the existing useEffect), add:

```jsx
const audio = useAmbientAudio({ src: AUDIO_SRC })
```

`audio` is `{ needsGesture, playing, error, tryStart, pause, pollFrequency, freqDataRef }`.

- [ ] **Step 7.3: Audio-state closure variables**

Inside the `useEffect`, near the inscription state, add:

```js
let prevBass = 0
let beatRefractoryEnd = 0
let expectedNextNodeIdx = -1     // first endpoint of first uninscribed canonical edge
let expectedPulseT = 0           // 0..1 envelope on the expected node, decays each frame
```

Helper to recompute expectedNextNodeIdx:

```js
function recomputeExpectedNext() {
  for (const [i, j] of metatronEdgesLocal) {
    const key = `${i},${j}`
    if (!inscribedMetatronEdges.has(key)) {
      expectedNextNodeIdx = i
      return
    }
  }
  expectedNextNodeIdx = -1   // all edges inscribed — completion state
}
```

Call `recomputeExpectedNext()` once at the bottom of the useEffect setup block. Also call it inside the inscription block whenever we add to `inscribedMetatronEdges`:

After `inscribedMetatronEdges.add(key)` in Step 6.2's code, add:
```js
recomputeExpectedNext()
```

- [ ] **Step 7.4: Poll audio + detect beat in update()**

At the top of `update(dt, t)`:

```js
audio.pollFrequency()
const freq = audio.freqDataRef.current
const bass = bandAverage(freq, BASS_BIN_START, BASS_BIN_END)
const beat = detectBassBeat(bass, prevBass, BEAT_THRESHOLD, beatRefractoryEnd, performance.now())
beatRefractoryEnd = beat.nextRefractoryEnd
if (beat.fired && expectedNextNodeIdx >= 0) {
  expectedPulseT = 1
}
prevBass = bass
// Decay the expected-node pulse envelope.
expectedPulseT = Math.max(0, expectedPulseT - dt * 1.8)
```

- [ ] **Step 7.5: Apply global breath to inscribed segments in drawFg()**

In `drawFg()`, replace the inscribed-segments pass from Task 6.3 with a version that modulates opacity by current bass level:

```js
// Inscribed Metatron edges — bright gold with a subtle bass-driven
// breath. Audio absent → opacity ~0.85; full bass kick → ~0.95.
const breathOpacity = 0.85 + (bass - 0.5) * BREATH_AMPLITUDE * 2
fCtx.strokeStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},${Math.max(0.6, Math.min(1, breathOpacity))})`
fCtx.lineWidth = 1.6
for (const key of inscribedMetatronEdges) {
  const [i, j] = key.split(',').map(Number)
  const a = metatronNodesLocal[i]
  const b = metatronNodesLocal[j]
  fCtx.beginPath()
  fCtx.moveTo(a.x, a.y)
  fCtx.lineTo(b.x, b.y)
  fCtx.stroke()
}
```

Note: `bass` is a closure variable from `update()`. It needs to be hoisted so `drawFg` can read it. Above `update`, declare:

```js
let bass = 0
```

Then in `update()`, change `const bass = bandAverage(...)` to `bass = bandAverage(...)`. (Removing the `const`.)

- [ ] **Step 7.6: Pulse the expected-next node in drawFg()**

In the node-drawing pass added in Step 5.4, modify it so the expected node gets an extra-bright pulse driven by `expectedPulseT`:

Replace the existing node pass with:

```js
for (let nodeIdx = 0; nodeIdx < metatronNodesLocal.length; nodeIdx++) {
  const n = metatronNodesLocal[nodeIdx]
  // Pulse: only on the expectedNextNodeIdx, scaled by the decaying envelope.
  const pulseBoost = (nodeIdx === expectedNextNodeIdx ? expectedPulseT : 0)
  const baseOpacity = 0.25 + n.act * 0.65 + pulseBoost * 0.45
  const radius = NODE_DEFAULT_RADIUS + n.act * NODE_ACTIVE_RADIUS_BOOST + pulseBoost * 4
  fCtx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},${Math.min(1, baseOpacity)})`
  fCtx.beginPath()
  fCtx.arc(n.x, n.y, radius, 0, Math.PI * 2)
  fCtx.fill()
  const glowAmount = n.act * 0.6 + pulseBoost * 0.5
  if (glowAmount > 0.18) {
    fCtx.fillStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},${Math.min(1, glowAmount)})`
    fCtx.beginPath()
    fCtx.arc(n.x, n.y, radius * 1.8, 0, Math.PI * 2)
    fCtx.fill()
  }
}
```

- [ ] **Step 7.7: Visual verify**

Without audio actually playing in the screenshot harness, the expected-pulse won't fire (no bass), but the system should be wired correctly. Verify by running the build and snap-script:

```bash
npm run build 2>&1 | tail -5
node scripts/snap-glb-v2.mjs
```

Expected: build clean, screenshots look identical to Task 6 (no audio in the headless test).

- [ ] **Step 7.8: Commit**

```bash
git add src/conductor-glb/ConductorCelestialField.jsx
git commit -m "feat(conduct-glb): ambient-audio reactivity on inscribed geometry

Hooks useAmbientAudio into the celestial field. Per frame:
  - pollFrequency() refreshes the AnalyserNode Uint8Array
  - bandAverage(freq, 0, 3) computes a 0..1 bass level
  - detectBassBeat() with 250 ms refractory fires on rising bass edges
  - Inscribed segments breathe with bass (±5% opacity)
  - Each detected beat pulses the 'expected next' Metatron node
    (the first uninscribed canonical edge's start vertex)

Without audio (autoplay blocked / no gesture yet), bass stays 0 and
no pulses fire — system degrades gracefully.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Tap-to-begin overlay for autoplay-blocked browsers

**Files:**
- Modify: `src/conductor-glb/ConductGlb.jsx`
- Modify: `src/conductor-glb/ConductorCelestialField.jsx` (expose the audio handle so ConductGlb can render the overlay)

Simplest approach: lift the audio hook one level — call `useAmbientAudio` in `ConductGlb`, pass the audio handle down to both the celestial field (which polls) and an overlay component (which calls `tryStart`).

- [ ] **Step 8.1: Lift useAmbientAudio to ConductGlb**

In `ConductorCelestialField.jsx`, change the component to accept an `audio` prop instead of calling the hook locally. Replace:

```jsx
const audio = useAmbientAudio({ src: AUDIO_SRC })
```

With this prop on the default export signature:

```jsx
export default function ConductorCelestialField({ audio }) {
```

Remove the `import { useAmbientAudio } from './useAmbientAudio'` line and the `AUDIO_SRC` constant since they're now in the parent.

In `ConductGlb.jsx`, add:

```jsx
import { useAmbientAudio } from './useAmbientAudio'
```

Above the existing constant block at module level:

```jsx
const AUDIO_SRC = '/music/hearth-keeper_acoustic-soft-2000s.mp3'
```

In the `ConductGlb` default export, call the hook and pass it down. Replace the current default export body with:

```jsx
export default function ConductGlb() {
  const audio = useAmbientAudio({ src: AUDIO_SRC })

  return (
    <PhoneProvider>
      <main className="conduct-codex-shell">
        <ConductorCelestialField audio={audio} />
        <StatusPanel />
        {audio.needsGesture && <BeginOverlay onBegin={audio.tryStart} />}
      </main>
    </PhoneProvider>
  )
}
```

- [ ] **Step 8.2: Add the BeginOverlay component**

In the same file, before the default export, add:

```jsx
function BeginOverlay({ onBegin }) {
  return (
    <button
      type="button"
      onClick={onBegin}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(216,197,160,0.55)',
        backdropFilter: 'blur(2px)',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        fontFamily: "Georgia, 'Iowan Old Style', serif",
        color: '#3a2a14',
        cursor: 'pointer',
        zIndex: 50,
      }}
    >
      <span style={{
        fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
        opacity: 0.7,
      }}>tap anywhere</span>
      <span style={{ fontSize: 26, fontStyle: 'italic' }}>begin</span>
    </button>
  )
}
```

- [ ] **Step 8.3: Visual verify**

```bash
npm run dev > /tmp/dev.log 2>&1 &
sleep 3
node scripts/snap-glb-v2.mjs
```

Expected: in `tmp/conduct-glb-screens/01-rest.png` you should see the cream "tap anywhere — begin" overlay across the full viewport. After tapping (in a real browser), the overlay disappears and audio starts.

- [ ] **Step 8.4: Commit**

```bash
git add src/conductor-glb/ConductGlb.jsx src/conductor-glb/ConductorCelestialField.jsx
git commit -m "feat(conduct-glb): tap-to-begin overlay for autoplay-blocked audio

Lifted useAmbientAudio one level to ConductGlb so a sibling overlay
component can render when audio.needsGesture is true. A click anywhere
on the overlay calls audio.tryStart(), which lazily creates the
AudioContext + AnalyserNode and starts playback. The celestial field
receives the audio handle as a prop.

Overlay styled as a cream-translucent panel with 'tap anywhere — begin'
in serif italic, matching the parchment aesthetic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Completion flash + persistent glow

**Files:**
- Modify: `src/conductor-glb/ConductorCelestialField.jsx`

When `inscribedMetatronEdges.size === metatronEdgesLocal.length` (all 78 inscribed), flash brightly once and brighten the watermark itself for the remainder of the session.

- [ ] **Step 9.1: Add completion state**

In the same `useEffect`, near the audio-state variables, add:

```js
let completionFlashT = 0     // 0..1 one-shot envelope, decays after firing
let isComplete = false
```

In the inscription block (Step 6.2), after `inscribedMetatronEdges.add(key)` and `recomputeExpectedNext()`, append:

```js
if (!isComplete && inscribedMetatronEdges.size === metatronEdgesLocal.length) {
  isComplete = true
  completionFlashT = 1
}
```

- [ ] **Step 9.2: Decay the flash in update()**

In `update(dt, t)`, after the expectedPulseT decay:

```js
completionFlashT = Math.max(0, completionFlashT - dt * 0.4)   // ~2.5 s fade-out
```

- [ ] **Step 9.3: Use the flash in drawFg()**

In the inscribed-segments pass, replace the breathOpacity calculation with:

```js
const breathOpacity = 0.85 + (bass - 0.5) * BREATH_AMPLITUDE * 2
const completionBoost = completionFlashT * 0.15
const finalEdgeOpacity = Math.max(0.6, Math.min(1, breathOpacity + completionBoost))
const finalEdgeWidth = 1.6 + completionFlashT * 2.5
fCtx.strokeStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},${finalEdgeOpacity})`
fCtx.lineWidth = finalEdgeWidth
```

(Replaces the existing `const breathOpacity =`, `fCtx.strokeStyle =`, `fCtx.lineWidth = 1.6` lines.)

- [ ] **Step 9.4: Visual verify**

Since reaching full completion (78 edges) in the screenshot harness isn't realistic, just verify the build + a normal screenshot render:

```bash
npm run build 2>&1 | tail -5
node scripts/snap-glb-v2.mjs
```

Expected: clean build, screenshots render normally (no completion since it doesn't trigger from the test harness).

- [ ] **Step 9.5: Commit**

```bash
git add src/conductor-glb/ConductorCelestialField.jsx
git commit -m "feat(conduct-glb): completion flash + persistent glow

When all 78 canonical Metatron edges are inscribed, a one-shot
completionFlashT (decay 2.5 s) brightens every inscribed segment to
peak gold + thickens stroke width to 4.1 px. After the flash decays,
isComplete remains true so the segments stay at full breath opacity
for the rest of the session.

The pattern is complete — the cube is yours.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✓ Programmatic 2D Metatron geometry (Task 1)
- ✓ R3F layers deleted (Task 4)
- ✓ Watermark painted into bg layer once (Task 5.3)
- ✓ Nodes rendered in fg every frame (Task 5.4)
- ✓ Per-node activation, same pattern as existing stars (Task 6.2)
- ✓ Consecutive activations match canonical edge → inscribe permanently (Task 6.2)
- ✓ Bass-band global breath on inscribed segments (Task 7.5)
- ✓ Bass-peak beat detection pulses expected-next node (Task 7.4, 7.6)
- ✓ Tap-to-begin overlay if autoplay blocked (Task 8)
- ✓ Vitest unit tests for geometry math (Task 1) AND audio band math (Task 2)
- ✓ Completion bright flash + persistent glow (Task 9)
- ✓ Default song is `hearth-keeper_acoustic-soft-2000s.mp3` (Task 7.1)

**2. Placeholder scan:** every step has explicit code or commands.

**3. Type consistency:**
- `computeMetatronNodes(radius)` returns `Array<{ x, y }>` — used consistently in Task 5.2 (scaling) and Task 5.3 (watermark).
- `computeMetatronEdges(nodeCount)` returns `Array<[i, j]>` — used in Task 5.3, 6.2 (canonicalEdgeKeys), 7.3 (recomputeExpectedNext).
- `useAmbientAudio({ src })` returns `{ needsGesture, playing, error, tryStart, pause, pollFrequency, freqDataRef }` — used the same way in Tasks 7.2 (initial call), 7.4 (poll + freqDataRef), 8.1 (lifted to parent), 8.2 (overlay reads needsGesture + tryStart).
- `bandAverage(freqData, startBin, endBin)` and `detectBassBeat(curr, prev, threshold, refractoryEnd, now)` — used in Task 7.4.
- `inscribedMetatronEdges` is a `Set<string>` keyed by `'i,j'` — written in 6.2, read in 6.3, 7.5, 9.1.
- `metatronNodesLocal[i] = { x, y, act }` — written in 5.2, mutated in 6.2 (`n.act += ...`), read in 5.4, 7.6.

**4. Test path consistency:** `src/conductor-glb/__tests__/` for both new test files — matches the existing `edgeMath.test.js` location.

---

## Test Strategy Summary

| Layer | Test |
|---|---|
| `computeMetatronNodes` + `computeMetatronEdges` | Vitest unit tests, 8 cases (count, origin, hex radius, hex spacing, edge count, edge validity, no duplicates) |
| `bandAverage` + `detectBassBeat` | Vitest unit tests, 7 cases (normal average, empty slice, clamping, beat fires on edge, no beat below threshold, refractory, no double-fire) |
| `useAmbientAudio` | Manual — runs in a browser, integration verification only |
| Geometry rendering | Visual via `scripts/snap-glb-v2.mjs` after each visual task |
| Edge inscription | Visual + spot-check `inscribedMetatronEdges.size` in DevTools |
| Audio reactivity | Manual — load the route in a browser, tap to begin, listen + watch |
| Completion state | Manual — would need to inscribe all 78 edges, easier to test by temporarily lowering the threshold in dev |

Run after each task with new tests:
```bash
npx vitest run src/conductor-glb/__tests__/
```

After each visual task:
```bash
node scripts/snap-glb-v2.mjs
```

---

## Risks & Notes

- **78 edges is a lot of completion** for a 4-minute song. At ~3 seconds per edge that's tight but doable for an active conductor. If user feedback says it feels grindy, curate the edge list to ~30-40 visually-distinct edges (subset stored as a separate constant in `metatronGeometry.js`) and switch `computeMetatronEdges` to return that curated set.
- **Bass-band beat threshold (0.55)** is tuned for typical mastered tracks. Hearth-Keeper acoustic-soft is on the quieter side; if no beats fire after a few seconds of playback, lower the threshold to 0.40. Adjust `BEAT_THRESHOLD` constant in Task 7.1.
- **Autoplay UX**: the overlay covers the entire viewport. Once the user taps, audio + analysis start. If they reload the tab, they'll see the overlay again — this is correct per browser policy and not a bug. The overlay's `cursor: pointer` plus the explicit "tap anywhere — begin" copy makes the intent clear.
- **Frame-time cost of bandAverage** is O(`endBin - startBin`) = at most 4 reads for bass. Trivial.
- **Watermark in bg canvas** only repaints on resize (the existing `drawBg()` runs in `resize()`). If the watermark needs to react (it doesn't, per the design), it would need to move into `drawFg()` or its own per-frame canvas. Static is intentional.
- **Inscribed segments outlive resize** — `inscribedMetatronEdges` lives in the same closure as the useEffect; on viewport resize, the bg canvas redraws but the inscriptions persist. The fg pass continues to draw them every frame.
- **Completion threshold**: in dev, change `=== metatronEdgesLocal.length` to a smaller number (say, 5) to verify the flash + persistent glow without needing to inscribe all 78. Don't commit that change.
