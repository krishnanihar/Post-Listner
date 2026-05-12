# Conductor Layered Cosmos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer the existing celestial-field experience with a structural sacred-geometry background (Metatron's Cube), a translucent ghost conductor, and a pen-style ink-blob cursor head — so `/conduct-glb` becomes a complete conducting cosmos rather than ink-on-blank-paper.

**Architecture:** Three new React components, each rendered into its own absolutely-positioned, transparent canvas, stacked via `z-index` over the existing celestial-field. Two of the three are R3F canvases (sacred geometry + ghost conductor). The third (ink-blob pen) is drawn inside the existing celestial-field SVG/canvas. A shared `trailTipRef` allows the geometry layer to detect when the ink trail crosses edges in screen-space, triggering edge activation.

**Tech Stack:** React 19, @react-three/fiber 9, @react-three/drei 10 (`useGLTF`), Three.js (`EdgesGeometry`, `LineSegments`, `MeshBasicMaterial`), Vitest for the one pure-function unit test.

**Layer stack (back to front):**

```
z-index 0  ── parchment gradient (DOM bg, existing)
z-index 1  ── SacredGeometryLayer (R3F canvas, alpha:true)
              • Metatron's Cube from /public/conductor/sacred-metatron.glb
              • Slow auto-rotation, soft amber edges
              • Edges light up when the ink trail's screen-space tip crosses them
              • 4 hardcoded "stem nodes" pulse with simulated stem signals
z-index 2  ── ConductorCelestialField (existing 3 canvases: bg/fg/trail)
              • Parchment overlay, glyphs, stars, constellations, ink trail
              • Adds: ink-blob "pen" at the trail's leading tip
z-index 3  ── GhostConductorLayer (R3F canvas, alpha:true)
              • conductor.glb at ~12% opacity
              • Subtle 4 s breath cycle (Y scale ±1.5%)
              • Head bone yaw tilt from phone yaw (±5°)
              • No baton, no gesture mirror — just presence
```

The existing `ConductGlb.jsx` composes these by passing a shared `trailTipRef` to the geometry layer and the celestial field.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `public/conductor/sacred-metatron.glb` | Sacred-geometry asset served by Vite | Create (move from project root) |
| `src/conductor-glb/SacredGeometryLayer.jsx` | R3F layer: load + render + auto-rotate + edge lighting + stem nodes | Create |
| `src/conductor-glb/GhostConductorLayer.jsx` | R3F layer: conductor.glb at low opacity, subtle motion | Create |
| `src/conductor-glb/edgeMath.js` | Pure function: 2D point-to-segment distance | Create |
| `src/conductor-glb/__tests__/edgeMath.test.js` | Vitest unit test for `pointToSegmentDistance` | Create |
| `src/conductor-glb/ConductorCelestialField.jsx` | Existing canvas system | Modify: write trail tip pixel coords to shared ref; add ink-blob pen at tip |
| `src/conductor-glb/ConductGlb.jsx` | Top-level composition | Modify: create `trailTipRef`, render all four layers in correct z-order |

---

## Task 1: Sacred Geometry Layer — load + render + rotate

**Files:**
- Create: `public/conductor/sacred-metatron.glb` (moved)
- Create: `src/conductor-glb/SacredGeometryLayer.jsx`
- Modify: `src/conductor-glb/ConductGlb.jsx` to mount it

- [ ] **Step 1.1: Move the GLB into /public so Vite serves it**

```bash
mv /Users/krishnaniharsunkara/Projects/Post-Listner/sacred_geometry_metatrons_cube.glb \
   /Users/krishnaniharsunkara/Projects/Post-Listner/public/conductor/sacred-metatron.glb
```

Verify:
```bash
ls -la public/conductor/sacred-metatron.glb
```
Expected: ~1.2 MB file at the new path.

- [ ] **Step 1.2: Create `SacredGeometryLayer.jsx` with a basic R3F canvas + GLB load**

Create `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/SacredGeometryLayer.jsx`:

```jsx
/* Sacred geometry background layer for /conduct-glb.
 *
 * Renders Metatron's Cube from /public/conductor/sacred-metatron.glb in a
 * transparent R3F canvas behind the celestial field. The cube slowly
 * auto-rotates so the structure feels alive without the user doing
 * anything. Edges + nodes are styled in soft amber so they sit gently
 * against the parchment without competing with the ink trail.
 *
 * Later tasks add:
 *   - Trail-passage edge lighting (Task 2)
 *   - Stem-reactive node pulses (Task 5)
 */
import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

const GEOMETRY_URL = '/conductor/sacred-metatron.glb'
useGLTF.preload(GEOMETRY_URL)

function MetatronCube() {
  const groupRef = useRef()
  const { scene } = useGLTF(GEOMETRY_URL)

  // Auto-rotate ~5°/s on Y, slight 1°/s drift on X for a non-flat look.
  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += delta * (5 * Math.PI / 180)
    groupRef.current.rotation.x += delta * (1 * Math.PI / 180)
  })

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  )
}

export default function SacredGeometryLayer() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 38, near: 0.1, far: 20 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.6} color="#FFE2B0" />
        <directionalLight position={[2, 3, 2]} intensity={0.4} color="#FFD494" />
        <Suspense fallback={null}>
          <MetatronCube />
        </Suspense>
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 1.3: Mount the new layer in ConductGlb.jsx**

In `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/ConductGlb.jsx`, add the import and the layer. The current file imports `ConductorCelestialField`; add `SacredGeometryLayer` next to it.

Replace this block:
```jsx
import ConductorCelestialField from './ConductorCelestialField'
```

With:
```jsx
import ConductorCelestialField from './ConductorCelestialField'
import SacredGeometryLayer from './SacredGeometryLayer'
```

Then in the `ConductGlb` default export, add `<SacredGeometryLayer />` as the first child of `<main>`, before `<ConductorCelestialField />`:

```jsx
return (
  <PhoneProvider>
    <main className="conduct-codex-shell">
      <SacredGeometryLayer />
      <ConductorCelestialField />
      <StatusPanel />
    </main>
  </PhoneProvider>
)
```

- [ ] **Step 1.4: Visual verify**

```bash
# If dev server isn't running:
# npm run dev > /tmp/dev.log 2>&1 &
# sleep 3

node scripts/snap-glb-v2.mjs
```

Open `tmp/conduct-glb-screens/01-rest.png`. Expected: the Metatron's Cube wireframe is visible behind the parchment + stars, slowly rotating between screenshots if you re-run quickly.

- [ ] **Step 1.5: Commit**

```bash
git add public/conductor/sacred-metatron.glb \
        src/conductor-glb/SacredGeometryLayer.jsx \
        src/conductor-glb/ConductGlb.jsx
git commit -m "feat(conduct-glb): add sacred geometry layer behind celestial field

Metatron's Cube loaded from /public/conductor/sacred-metatron.glb,
rendered in a transparent R3F canvas at z-index 1, slowly auto-rotates.
Structural backdrop for the parchment cosmos.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Trail-Passage Edge Lighting

**Why:** When the user sweeps the ink trail across the sacred-geometry edges, those edges should light up. Makes the cube feel "playable" like an instrument.

**Architecture:** Extract the cube's edges as a list of 3D line segments. Each frame: project each segment to screen-space pixels using the camera + viewport; check if the trail tip's pixel position is within `EDGE_HIT_PX` (≈18 px) of the segment; bump that segment's `activation` to 1; decay all activations linearly. Render the edges as a single `<lineSegments>` with `vertexColors: true`, where each pair of vertices gets a color based on its segment's current activation level (dim amber → bright gold).

**Files:**
- Create: `src/conductor-glb/edgeMath.js` (pure function for proximity test)
- Create: `src/conductor-glb/__tests__/edgeMath.test.js` (Vitest unit test)
- Modify: `src/conductor-glb/SacredGeometryLayer.jsx` (edge extraction, projection, activation, custom render)
- Modify: `src/conductor-glb/ConductorCelestialField.jsx` (write trail tip to shared ref)
- Modify: `src/conductor-glb/ConductGlb.jsx` (create + pass trailTipRef)

### 2a — Pure function for point-to-segment distance (TDD)

- [ ] **Step 2.1: Write the failing test**

Create `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/__tests__/edgeMath.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { pointToSegmentDistance } from '../edgeMath.js'

describe('pointToSegmentDistance', () => {
  it('returns 0 for a point on the segment', () => {
    const d = pointToSegmentDistance(50, 50, 0, 0, 100, 100)
    expect(d).toBeCloseTo(0, 5)
  })

  it('returns perpendicular distance for a point off the middle of a horizontal segment', () => {
    const d = pointToSegmentDistance(50, 30, 0, 0, 100, 0)
    expect(d).toBeCloseTo(30, 5)
  })

  it('returns endpoint distance when projection falls outside the segment', () => {
    const d = pointToSegmentDistance(-30, 0, 0, 0, 100, 0)
    expect(d).toBeCloseTo(30, 5)
  })

  it('handles a zero-length segment without dividing by zero', () => {
    const d = pointToSegmentDistance(3, 4, 10, 10, 10, 10)
    expect(d).toBeCloseTo(Math.hypot(7, 6), 5)
  })
})
```

- [ ] **Step 2.2: Run test, verify all 4 FAIL**

```bash
npx vitest run src/conductor-glb/__tests__/edgeMath.test.js
```
Expected: 4 FAIL with "pointToSegmentDistance is not exported."

- [ ] **Step 2.3: Implement edgeMath.js**

Create `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/edgeMath.js`:

```js
/* Pure 2D geometry helpers for the sacred-geometry edge-lighting feature.
 * Kept dependency-free so it's trivially unit-testable. */

/**
 * Shortest distance from point P to line segment AB (all in 2D pixel space).
 * Returns 0 if P is on the segment. If the perpendicular projection of P
 * onto the line falls OUTSIDE the segment, returns the distance to the
 * nearer endpoint. Safe against a degenerate zero-length segment.
 */
export function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const ab2 = abx * abx + aby * aby
  if (ab2 < 1e-9) {
    // Degenerate: A and B coincide. Distance is just P to A.
    return Math.hypot(px - ax, py - ay)
  }
  const apx = px - ax
  const apy = py - ay
  let t = (apx * abx + apy * aby) / ab2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const cx = ax + t * abx
  const cy = ay + t * aby
  return Math.hypot(px - cx, py - cy)
}
```

- [ ] **Step 2.4: Run test, verify 4 PASS**

```bash
npx vitest run src/conductor-glb/__tests__/edgeMath.test.js
```
Expected: 4 PASS.

### 2b — Share the trail tip pixel position

- [ ] **Step 2.5: Add trailTipRef in ConductGlb.jsx and pass to children**

In `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/ConductGlb.jsx`, import `useRef` and pass a ref to both layers:

Change the import line:
```jsx
import { createContext, useContext } from 'react'
```
to:
```jsx
import { createContext, useContext, useRef } from 'react'
```

Then in `ConductGlb` body, create the ref and pass it down:
```jsx
export default function ConductGlb() {
  const trailTipRef = useRef({ x: 0, y: 0, active: false })

  return (
    <PhoneProvider>
      <main className="conduct-codex-shell">
        <SacredGeometryLayer trailTipRef={trailTipRef} />
        <ConductorCelestialField trailTipRef={trailTipRef} />
        <StatusPanel />
      </main>
    </PhoneProvider>
  )
}
```

- [ ] **Step 2.6: Have ConductorCelestialField write the trail tip pixel coords each frame**

In `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/ConductorCelestialField.jsx`, change the function signature to accept the ref:

```jsx
export default function ConductorCelestialField({ trailTipRef }) {
```

Then inside the `useEffect`, after the `update(dt, t)` function is defined and BEFORE the `requestAnimationFrame` setup, ensure the existing `sm.x, sm.y` (smoothed cursor in viewBox coords) gets converted to pixel coords each frame. The simplest spot is at the very end of `update()`. Append:

```js
// Publish trail tip in viewport-pixel coords so external layers
// (sacred geometry) can detect crossings with edges projected to
// the same pixel space.
if (trailTipRef) {
  trailTipRef.current = {
    x: ox + sm.x * sc,
    y: oy + sm.y * sc,
    active: phoneActive || (performance.now() - lastAct > 1500),
  }
}
```

(`ox`, `oy`, `sc` are the closure variables already in the file from the `resize()` function.)

### 2c — Edge extraction, projection, and activation in SacredGeometryLayer

- [ ] **Step 2.7: Extract edges from the GLB on first render**

In `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/SacredGeometryLayer.jsx`, replace the entire `MetatronCube` function (and add a new import line for `useMemo`, `useEffect`, and `useThree` / `THREE` if missing):

At top of file, replace:
```jsx
import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
```

With:
```jsx
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { pointToSegmentDistance } from './edgeMath.js'
```

Then replace the `MetatronCube` function with:
```jsx
const EDGE_HIT_PX = 18         // proximity in screen pixels to count as a "cross"
const EDGE_DECAY_PER_S = 1.5   // activation decays at this rate per second
const COLOR_REST = new THREE.Color('#7a5a30')   // soft amber
const COLOR_ACTIVE = new THREE.Color('#FFD888') // bright gold

function MetatronCube({ trailTipRef }) {
  const groupRef = useRef()
  const linesRef = useRef()
  const colorAttrRef = useRef()
  const activationsRef = useRef([])     // per-edge activation 0..1
  const segmentsRef = useRef([])        // per-edge [Vec3 a, Vec3 b]

  const { scene } = useGLTF(GEOMETRY_URL)
  const { camera, size } = useThree()

  // Build a single LineSegments out of all edges in the GLB. Triangle meshes
  // get fed through THREE.EdgesGeometry to extract outline edges; existing
  // LineSegments are used directly.
  const lineGeometry = useMemo(() => {
    const positions = []
    scene.traverse((obj) => {
      if (obj.isLineSegments) {
        const arr = obj.geometry.attributes.position.array
        for (let i = 0; i < arr.length; i++) positions.push(arr[i])
      } else if (obj.isMesh && obj.geometry) {
        const eg = new THREE.EdgesGeometry(obj.geometry, 15)
        const arr = eg.attributes.position.array
        for (let i = 0; i < arr.length; i++) positions.push(arr[i])
      }
    })
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    // Per-vertex colors so each edge can be individually tinted. Two
    // vertices per edge, so colors array length = positions length.
    const colors = new Float32Array((positions.length / 3) * 3)
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geom
  }, [scene])

  // Cache segment endpoints + initialize per-edge activation array.
  useEffect(() => {
    const pos = lineGeometry.attributes.position.array
    const segments = []
    for (let i = 0; i < pos.length; i += 6) {
      segments.push([
        new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]),
        new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]),
      ])
    }
    segmentsRef.current = segments
    activationsRef.current = new Array(segments.length).fill(0)
    // Initialize all colors to rest tone.
    const colorAttr = lineGeometry.attributes.color
    for (let i = 0; i < colorAttr.count; i++) {
      colorAttr.setXYZ(i, COLOR_REST.r, COLOR_REST.g, COLOR_REST.b)
    }
    colorAttr.needsUpdate = true
    colorAttrRef.current = colorAttr
  }, [lineGeometry])

  // Reusable scratch to avoid per-frame allocation.
  const tmpA = useMemo(() => new THREE.Vector3(), [])
  const tmpB = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += delta * (5 * Math.PI / 180)
    groupRef.current.rotation.x += delta * (1 * Math.PI / 180)

    const segs = segmentsRef.current
    const acts = activationsRef.current
    const colorAttr = colorAttrRef.current
    if (!segs.length || !colorAttr) return

    // Read trail tip pixel position from the shared ref.
    const tip = trailTipRef?.current
    const hasTip = !!tip && tip.active

    // Project every edge endpoint to screen-space pixels, test proximity,
    // bump activation, then write per-vertex color back into the buffer.
    const w = size.width
    const h = size.height
    const groupMatrix = groupRef.current.matrixWorld
    groupRef.current.updateMatrixWorld()

    for (let i = 0; i < segs.length; i++) {
      // Transform local segment endpoints by the rotating group matrix,
      // then project into NDC and convert to pixel coordinates.
      tmpA.copy(segs[i][0]).applyMatrix4(groupMatrix).project(camera)
      tmpB.copy(segs[i][1]).applyMatrix4(groupMatrix).project(camera)
      const ax = (tmpA.x + 1) / 2 * w
      const ay = (1 - tmpA.y) / 2 * h
      const bx = (tmpB.x + 1) / 2 * w
      const by = (1 - tmpB.y) / 2 * h

      // Proximity check against the trail tip.
      if (hasTip) {
        const d = pointToSegmentDistance(tip.x, tip.y, ax, ay, bx, by)
        if (d < EDGE_HIT_PX) {
          acts[i] = 1
        }
      }
      // Linear decay.
      acts[i] = Math.max(0, acts[i] - delta * EDGE_DECAY_PER_S)

      // Write color for both endpoints of this edge.
      const c = acts[i]
      const r = COLOR_REST.r + (COLOR_ACTIVE.r - COLOR_REST.r) * c
      const g = COLOR_REST.g + (COLOR_ACTIVE.g - COLOR_REST.g) * c
      const b = COLOR_REST.b + (COLOR_ACTIVE.b - COLOR_REST.b) * c
      const vi = i * 2  // two vertices per segment
      colorAttr.setXYZ(vi, r, g, b)
      colorAttr.setXYZ(vi + 1, r, g, b)
    }
    colorAttr.needsUpdate = true
  })

  return (
    <group ref={groupRef}>
      <lineSegments ref={linesRef} geometry={lineGeometry}>
        <lineBasicMaterial vertexColors transparent opacity={0.85} />
      </lineSegments>
    </group>
  )
}
```

- [ ] **Step 2.8: Update SacredGeometryLayer's default export to forward the ref prop**

In the same file, change the default export to accept and pass `trailTipRef`:

```jsx
export default function SacredGeometryLayer({ trailTipRef }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 38, near: 0.1, far: 20 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.6} color="#FFE2B0" />
        <directionalLight position={[2, 3, 2]} intensity={0.4} color="#FFD494" />
        <Suspense fallback={null}>
          <MetatronCube trailTipRef={trailTipRef} />
        </Suspense>
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 2.9: Visual verify**

```bash
node scripts/snap-glb-v2.mjs
```

Open `tmp/conduct-glb-screens/09-roll-left-30.png` or any pose where the cursor swept across the field. Expected: the cube edges where the ink trail crossed should glow gold-bright; untouched edges stay soft amber.

- [ ] **Step 2.10: Commit**

```bash
git add src/conductor-glb/edgeMath.js \
        src/conductor-glb/__tests__/edgeMath.test.js \
        src/conductor-glb/SacredGeometryLayer.jsx \
        src/conductor-glb/ConductorCelestialField.jsx \
        src/conductor-glb/ConductGlb.jsx
git commit -m "feat(conduct-glb): trail-passage lights up Metatron Cube edges

Sacred-geometry edges are now reactive to the ink trail. Each frame the
geometry layer projects all edges to screen-space pixels and tests
proximity to the trail tip; edges within 18 px get their activation
bumped to 1 and decay linearly back to rest tone. The user 'plays' the
cube like an instrument by sweeping the trail through it.

Adds edgeMath.js with pointToSegmentDistance + Vitest coverage.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Ghost Conductor Layer

**Why:** A translucent presence — the conductor figure exists in the cosmos, but at ~12% opacity so the cosmos shows through. Subtle breath + yaw tilt so the figure feels alive without competing with the trail.

**Files:**
- Create: `src/conductor-glb/GhostConductorLayer.jsx`
- Modify: `src/conductor-glb/ConductGlb.jsx` to mount it at z-index 3

- [ ] **Step 3.1: Create the ghost layer**

Create `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/GhostConductorLayer.jsx`:

```jsx
/* Ghost conductor figure for /conduct-glb.
 *
 * Loads the existing conductor.glb and renders it at very low opacity
 * (~12%) so the parchment cosmos shows through. Subtle ambient motion
 * only — a 4 s breath cycle and a slow head-yaw response to the phone's
 * compass signal. No baton, no gesture mirroring; the figure is a
 * "frame" around the conducting experience, not the protagonist.
 *
 * Camera framing matches the original GLB scene (back view, above-waist
 * portrait) so the figure registers immediately as the conductor.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { usePhone } from './ConductGlb'

const FIGURE_URL = '/conductor/conductor.glb'
useGLTF.preload(FIGURE_URL)

const GHOST_OPACITY = 0.12
const BREATH_PERIOD_S = 4.0
const BREATH_AMPLITUDE = 0.015         // ±1.5 % of group Y scale
const HEAD_YAW_MAX_DEG = 5             // ±5° of head yaw with phone yaw

function bakeClipToScene(scene, clip) {
  if (!clip) return false
  const mixer = new THREE.AnimationMixer(scene)
  const action = mixer.clipAction(clip)
  action.play()
  mixer.update(0)
  mixer.update(clip.duration)
  return true
}

function GhostFigure() {
  const groupRef = useRef()
  const headBoneRef = useRef(null)
  const baseHeadQuat = useRef(null)
  const { scene, animations } = useGLTF(FIGURE_URL)
  const { stateRef } = usePhone()
  const elapsedRef = useRef(0)

  useEffect(() => {
    // Replace every mesh material with a transparent dark material at the
    // ghost opacity. Skinning still works because we're using a built-in
    // material; three.js generates the standard skinning vertex chain.
    scene.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0x1c1814,
          transparent: true,
          opacity: GHOST_OPACITY,
          depthWrite: false,
        })
        obj.material = mat
        obj.frustumCulled = false
      }
    })

    bakeClipToScene(scene, animations?.[0])

    // Find the head bone for yaw tilt. Sanitized GLTF names strip dots.
    const headName = THREE.PropertyBinding.sanitizeNodeName('DEF-spine.006')
    scene.traverse((o) => {
      if (!headBoneRef.current && o.isBone &&
          (o.name === headName || o.name === 'DEF-spine.006')) {
        headBoneRef.current = o
        baseHeadQuat.current = o.quaternion.clone()
      }
    })
  }, [scene, animations])

  const dq = useMemo(() => new THREE.Quaternion(), [])
  const axisY = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const t = elapsedRef.current

    // Breath: scale group Y by a small sinusoidal modulation.
    if (groupRef.current) {
      const breath = 1 + Math.sin(t * (2 * Math.PI / BREATH_PERIOD_S)) * BREATH_AMPLITUDE
      groupRef.current.scale.set(1, breath, 1)
    }

    // Head yaw: subtle response to phone yaw (compass alpha delta).
    const head = headBoneRef.current
    const baseQ = baseHeadQuat.current
    if (head && baseQ) {
      const state = stateRef.current
      const calibrated = state.calibrated
      const yaw = calibrated ? (state.controls.yaw || 0) : 0
      const angle = yaw * HEAD_YAW_MAX_DEG * Math.PI / 180
      dq.setFromAxisAngle(axisY, angle)
      head.quaternion.copy(baseQ).multiply(dq)
    }
  })

  return <primitive ref={groupRef} object={scene} />
}

export default function GhostConductorLayer() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      <Canvas
        camera={{ position: [0, 1.55, 1.5], fov: 38, near: 0.1, far: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ camera }) => { camera.lookAt(0, 1.55, 0) }}
      >
        <ambientLight intensity={0.9} color="#FFF5E0" />
        <directionalLight position={[2.4, 5.5, 3.8]} intensity={0.55} color="#FFF0D2" />
        <Suspense fallback={null}>
          <GhostFigure />
        </Suspense>
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 3.2: Mount the ghost layer in ConductGlb.jsx**

Import and add to the composition. Change the imports:

```jsx
import ConductorCelestialField from './ConductorCelestialField'
import SacredGeometryLayer from './SacredGeometryLayer'
import GhostConductorLayer from './GhostConductorLayer'
```

And the default export's JSX:
```jsx
return (
  <PhoneProvider>
    <main className="conduct-codex-shell">
      <SacredGeometryLayer trailTipRef={trailTipRef} />
      <ConductorCelestialField trailTipRef={trailTipRef} />
      <GhostConductorLayer />
      <StatusPanel />
    </main>
  </PhoneProvider>
)
```

- [ ] **Step 3.3: Visual verify**

```bash
node scripts/snap-glb-v2.mjs
```

Open `tmp/conduct-glb-screens/01-rest.png`. Expected: a faint, translucent conductor silhouette overlaid on the cosmos — visible but not dominant. The parchment + stars + geometry remain readable behind the figure.

- [ ] **Step 3.4: Commit**

```bash
git add src/conductor-glb/GhostConductorLayer.jsx \
        src/conductor-glb/ConductGlb.jsx
git commit -m "feat(conduct-glb): add ghost conductor layer over the cosmos

conductor.glb rendered at 12% opacity in a transparent R3F canvas at
z-index 3. Subtle 4-second breath cycle (Y scale ±1.5%) plus head-bone
yaw tilt driven by phone compass (±5°). The figure is a presence, not
a protagonist — the cosmos and the ink trail remain dominant.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Pen / Ink-Blob Cursor Head

**Why:** Today the trail just appears from nowhere. With a wobbling ink-drop at the leading tip, the trail visually emanates from a source — completing the ink-and-paper metaphor.

**Files:**
- Modify: `src/conductor-glb/ConductorCelestialField.jsx`

- [ ] **Step 4.1: Add an ink-blob drawing pass at the end of drawTrail**

In `/Users/krishnaniharsunkara/Projects/Post-Listner/src/conductor-glb/ConductorCelestialField.jsx`, locate the `drawTrail` function. After the existing tip-glow block (the one that draws a small gold halo + dark dot at `trace[trace.length - 1]`), append a new "ink blob" pass.

The existing tip block (preserve it):
```js
if (trace.length >= 2) {
  const tip = trace[trace.length - 1]
  tCtx.fillStyle = `rgba(${INK_WET[0]},${INK_WET[1]},${INK_WET[2]},0.92)`
  tCtx.beginPath()
  tCtx.arc(tip.x, tip.y, Math.max(1.5, tip.hw * 0.55), 0, Math.PI * 2)
  tCtx.fill()
  tCtx.fillStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},0.28)`
  tCtx.beginPath()
  tCtx.arc(tip.x, tip.y, tip.hw * 2.2, 0, Math.PI * 2)
  tCtx.fill()
}
```

Immediately after that block (still inside `drawTrail`, still inside the `if (trace.length >= 2)` guard or just after it), add the ink-blob pass:

```js
if (trace.length >= 2) {
  // Ink-blob "pen" at the leading tip — the source the trail flows from.
  // Slight wobble on a slow sine so it feels organic. Size scales with
  // current ribbon width so a fast stroke gives a small drop; a held
  // stroke gives a fat blob ready to dispense more ink.
  const tip = trace[trace.length - 1]
  const wob = Math.sin(performance.now() * 0.012)
  const blobR = Math.max(4, tip.hw * 1.3 + wob * 0.8)
  // Two-layer ink-blob: a saturated dark core + a slightly softer halo.
  tCtx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},0.85)`
  tCtx.beginPath()
  tCtx.arc(tip.x, tip.y, blobR, 0, Math.PI * 2)
  tCtx.fill()
  tCtx.fillStyle = `rgba(${INK_WET[0]},${INK_WET[1]},${INK_WET[2]},0.55)`
  tCtx.beginPath()
  tCtx.arc(tip.x + wob * 1.2, tip.y - wob * 0.9, blobR * 0.55, 0, Math.PI * 2)
  tCtx.fill()
}
```

- [ ] **Step 4.2: Visual verify**

```bash
node scripts/snap-glb-v2.mjs
```

Open `tmp/conduct-glb-screens/03-pitch-fwd-30.png`. Expected: at the leading tip of the trail there is now a small dark ink blob with a slight halo — the trail "emanates" from this source. The wobble means consecutive screenshots will show subtle differences in the blob shape.

- [ ] **Step 4.3: Commit**

```bash
git add src/conductor-glb/ConductorCelestialField.jsx
git commit -m "feat(conduct-glb): ink-blob pen at trail leading tip

A two-layer ink blob now sits at the leading tip of the ribbon — a
saturated core plus a softer halo with a slow wobble. Completes the
ink-on-paper metaphor: the trail visually flows from a source instead
of appearing from nowhere. Size scales with current ribbon width, so
fast strokes get a small drop and held strokes get a fat reservoir.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Stem-Reactive Geometry Nodes

**Why:** Pre-wire the geometry for the eventual hookup to the Orchestra phase's 4 audio stems. For now, simulate the 4 stem signals from existing phone signals so we can see the visual response. When the Orchestra integration happens, those simulated values get replaced with `AnalyserNode` reads and the visual stays identical.

**Approach:** Pick 4 vertices of the loaded Metatron's Cube (the 4 most prominent outer "nodes" — we identify them at load time as the four vertices farthest from the geometric center along the XY plane). Render a small sphere at each. Each sphere's scale + glow pulses with one of the 4 simulated stem signals.

**Simulation mapping (placeholder for real stems):**
- `vocals` ← `controls.articulation` (jerk → vocal sharpness)
- `drums`  ← short pulse on `controls.lastDownbeatAt` (downbeat = drum hit)
- `bass`   ← `controls.energy` (RMS → bass body)
- `other`  ← `controls.angularSpeed` (gyro speed → ambient motion)

**Files:**
- Modify: `src/conductor-glb/SacredGeometryLayer.jsx`

- [ ] **Step 5.1: Identify the 4 stem-node vertices at geometry load time**

In `SacredGeometryLayer.jsx`, inside `MetatronCube`, after the existing `useEffect` that initializes `segmentsRef.current` and `activationsRef.current`, add another `useEffect` that picks 4 prominent vertices:

```jsx
const stemNodesRef = useRef([])

useEffect(() => {
  // Collect unique vertices from the segments, then pick the 4 farthest
  // from the geometric center in the XY plane — these are the most
  // visually prominent "node" positions on the cube outline.
  const segs = segmentsRef.current
  if (!segs.length) return
  const uniq = new Map()
  const key = (v) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`
  for (const [a, b] of segs) {
    uniq.set(key(a), a)
    uniq.set(key(b), b)
  }
  const verts = [...uniq.values()]
  // Sort by distance from origin in XY plane, descending.
  verts.sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y))
  stemNodesRef.current = verts.slice(0, 4).map((v) => v.clone())
}, [lineGeometry])
```

- [ ] **Step 5.2: Compute simulated stem signals each frame and render the nodes**

In `MetatronCube`, replace the existing `return ( <group ... > <lineSegments .../> </group> )` block with a version that also renders 4 small spheres at the stem positions. Above the `return`, compute the 4 simulated values from `usePhone()`:

At the top of the `MetatronCube` function, add an import dependency line (just above the `const groupRef = useRef()`):

```jsx
const { stateRef } = usePhone()
```

Add this import at top of file:
```jsx
import { usePhone } from './ConductGlb'
```

Then declare refs for per-stem pulse state above the `useFrame`:
```jsx
const stemPulseRef = useRef([0, 0, 0, 0])     // 0..1 each
const lastDownbeatSeenRef = useRef(0)
```

Add stem-pulse logic inside the existing `useFrame` callback. After the existing edge-projection loop (after `colorAttr.needsUpdate = true`), append:

```js
// Stem pulse update — simulate the 4 stems from phone signals until
// the Orchestra phase wires real AnalyserNode reads. Each pulse value
// is a smoothed 0..1; the nodes render as small spheres scaled by pulse.
const state = stateRef.current
const ctrl = state.controls
const calibrated = state.calibrated
const pulses = stemPulseRef.current

// vocals ← articulation
const tgtVocals = calibrated ? (ctrl.articulation || 0) : 0
pulses[0] += (tgtVocals - pulses[0]) * 0.20
// drums ← downbeat one-shot decay
const beatAt = ctrl.lastDownbeatAt || 0
if (beatAt && beatAt !== lastDownbeatSeenRef.current) {
  lastDownbeatSeenRef.current = beatAt
  pulses[1] = Math.min(1, pulses[1] + (ctrl.downbeatIntensity || 0.8))
}
pulses[1] = Math.max(0, pulses[1] - delta * 2.5)   // ~400 ms fall-off
// bass ← energy
const tgtBass = calibrated ? (ctrl.energy || 0) : 0
pulses[2] += (tgtBass - pulses[2]) * 0.15
// other ← angularSpeed
const tgtOther = calibrated ? (ctrl.angularSpeed || 0) : 0
pulses[3] += (tgtOther - pulses[3]) * 0.20
```

Replace the existing `return` block (which currently is `<group ref={groupRef}>...<lineSegments .../>...</group>`) with this:

```jsx
const nodes = stemNodesRef.current
return (
  <group ref={groupRef}>
    <lineSegments ref={linesRef} geometry={lineGeometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.85} />
    </lineSegments>
    {nodes.map((v, i) => (
      <StemNode key={i} position={v} pulseRef={stemPulseRef} stemIndex={i} />
    ))}
  </group>
)
```

- [ ] **Step 5.3: Add the StemNode subcomponent**

Above `MetatronCube` in the same file, add a `StemNode` helper. This reads its index's pulse value each frame and updates scale + emissive intensity directly on its mesh so React doesn't re-render every frame.

```jsx
function StemNode({ position, pulseRef, stemIndex }) {
  const meshRef = useRef()
  const matRef = useRef()
  useFrame(() => {
    const p = pulseRef.current[stemIndex] || 0
    if (meshRef.current) {
      const s = 0.05 + p * 0.10
      meshRef.current.scale.set(s, s, s)
    }
    if (matRef.current) {
      matRef.current.opacity = 0.35 + p * 0.55
    }
  })
  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial ref={matRef} color="#FFD888" transparent opacity={0.35} />
    </mesh>
  )
}
```

- [ ] **Step 5.4: Visual verify**

```bash
node scripts/snap-glb-v2.mjs
```

Open `tmp/conduct-glb-screens/04-pitch-back-15.png` (which fires a downbeat). Expected: at least one of the 4 stem nodes on the cube is enlarged + brighter (the drums node, from the downbeat). On other poses with high energy/articulation/angularSpeed, the corresponding stem nodes should glow brighter.

- [ ] **Step 5.5: Commit**

```bash
git add src/conductor-glb/SacredGeometryLayer.jsx
git commit -m "feat(conduct-glb): stem-reactive nodes on Metatron Cube

Four prominent vertices of the loaded Metatron's Cube are identified
at load time (farthest from origin in XY) and rendered as small
amber spheres. Each pulses with a simulated stem signal:
  vocals    ← controls.articulation
  drums     ← controls.lastDownbeatAt one-shot
  bass      ← controls.energy
  other     ← controls.angularSpeed
Smoothing matches the per-signal character (slow for energy/bass,
sharp decay for the downbeat). When Orchestra integration happens
later, the four simulated targets become AnalyserNode reads with
no other changes required.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✓ Phase 1: sacred geometry layer rendering Metatron's Cube GLB with slow rotation (Task 1)
- ✓ Phase 2: trail-passage edge lighting (Task 2)
- ✓ Phase 3: ghost conductor figure at ~12% opacity with breath + yaw tilt (Task 3)
- ✓ Phase 4: pen/ink-blob cursor head (Task 4)
- ✓ Phase 4 (cont.): stem-reactive geometry nodes simulated from phone signals (Task 5)

**2. Placeholder scan:** every step has explicit code or commands. No TBD/TODO/"handle edge cases"/"similar to Task N" phrases.

**3. Type consistency:**
- `trailTipRef.current = { x, y, active }` — same shape across writer (Task 2.6, ConductorCelestialField) and reader (Task 2.7, SacredGeometryLayer).
- `stemPulseRef.current` — array of 4 numbers, written by `MetatronCube` and read by `StemNode` via `pulseRef[stemIndex]`.
- `GEOMETRY_URL` constant in SacredGeometryLayer; `FIGURE_URL` in GhostConductorLayer. Both reference paths that exist (the GLB is moved in Step 1.1; conductor.glb is already in /public).

**4. Field names:**
- Phone signals used in Task 5: `controls.articulation`, `controls.lastDownbeatAt`, `controls.downbeatIntensity`, `controls.energy`, `controls.angularSpeed` — all exist in the current `controls` shape after the richer-signals plan was implemented (commit `2367822`).

**5. Test path:** new test at `src/conductor-glb/__tests__/edgeMath.test.js` follows the same `__tests__/` convention as `src/conductor-codex/__tests__/motion.test.js`.

---

## Test Strategy Summary

| Layer | Test |
|---|---|
| `pointToSegmentDistance` (pure 2D math) | Vitest unit tests, 4 cases (on-segment, perpendicular off, off-endpoint, degenerate) |
| Geometry edge extraction + projection | Visual via screenshot harness; verify edges visible + slowly rotating |
| Trail-passage activation | Visual: edges glow gold where the trail crossed; soft amber elsewhere |
| Ghost conductor opacity + breath | Visual: figure visible but cosmos shows through |
| Ink-blob wobble | Visual: ink blob at trail tip with subtle frame-to-frame difference |
| Stem-reactive nodes | Visual: 4 nodes enlarge on downbeat / high articulation / energy / angularSpeed |

Run after each task:
```bash
node scripts/snap-glb-v2.mjs
```
Run after Task 2:
```bash
npx vitest run src/conductor-glb/__tests__/edgeMath.test.js
```

---

## Risks & Notes

- **GLB structure unknown until load:** Step 2.7's edge extraction handles both possible GLB shapes (LineSegments objects or triangle Mesh objects via `THREE.EdgesGeometry`). If the cube renders as a solid blob instead of a wireframe after Task 1, that's a clue the GLB was exported as triangles and `THREE.EdgesGeometry` is doing the work — verify by logging `scene.children` in the browser console once.
- **Performance:** the edge-lighting loop runs once per edge per frame. A typical Metatron's Cube has ~50-90 edges; 90 × 60 fps = 5400 distance checks/sec, trivial. If a future geometry has thousands of edges, the proximity check can be early-cut by an AABB on each edge's projected pixel rect.
- **R3F canvas overlap performance:** three transparent R3F canvases overlapping at the same DPR is heavier than a single canvas. On low-end mobile this may drop frames. Acceptable for the experimental `/conduct-glb` route; if it becomes the production Orchestra-phase visual, consider consolidating into a single R3F scene with composited render targets.
- **Ghost figure opacity ordering:** with `depthWrite: false` on the ghost material, the figure renders without depth occlusion against the cosmos behind it — exactly what we want. If parts of the figure appear "punched out" where they overlap themselves, that's the cost; raising `opacity` slightly is the fix.
- **Stem simulation:** Task 5 maps phone signals to stems as a placeholder. When the Orchestra phase wires this to real audio, the only change is replacing the four `tgtVocals/tgtBass/tgtOther` reads and the downbeat one-shot with `AnalyserNode.getByteFrequencyData` calls per stem. The visual stays identical.
