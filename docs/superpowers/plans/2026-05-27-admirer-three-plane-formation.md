# Admirer Three-Plane Formation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Admirer phase's `BackgroundGlyph` (2D image-to-particles sacred geometry) with the stacked three-plane WebGPU scene from `/aureola-three-plane-test`, where the particle formation now forms INTO the middle plane's flower-of-life shader, then the back plane (cosmic periphery) fades in, then the front figure plane fades in — paced by conversation milestones.

**Architecture:**
- A new `AdmirerScene3D` component owns an R3F `<Canvas>` with the WebGPU renderer (matching the existing `/aureola-three-plane-test` setup) plus a 2D HTML particle overlay layered on top. The scene mounts inside `Admirer`'s `<Paper variant="cream">` wrapper, BELOW the existing UI elements (state label, `QuestionDisplay`, `FragmentControls`, `HoldToSpeak`).
- Two cooperating signals drive the visual:
  - **`momentBus` release ratio (0..1)** — already paced by the conversation (mount = 0.08, lexicon = +0.05, agent question = +0.12, user turn = +0.05, fragment rated = +0.08, `startGeneration` snaps to 1.0). Drives (a) the particle release wave and (b) the middle-plane shader opacity. By release=1, the shader-rendered flower-of-life is fully visible and particles have faded out.
  - **`formationStage` (0 | 1 | 2)** — a new tiny pub/sub store. `0` on Admirer mount, `1` on first fragment rated, `2` on `startGeneration`. Drives back-plane and front-figure opacity uniforms.
- The three existing plane components (`BackPlane`, `MiddleShaderPlane`, `FrontFigurePlane`) gain an optional `opacityU` TSL uniform prop. When provided, it is folded into the material's `opacityNode` (for back/front) or multiplied into `colorNode` (for the additively-blended middle). When omitted, the components behave exactly as today, so the `/aureola-three-plane-test` route is unaffected.
- WebGPU fallback: if `navigator.gpu` is missing or `WebGPURenderer.init()` throws, `AdmirerScene3D` renders `<BackgroundGlyph />` instead so the Admirer phase still works on devices without WebGPU.

**Tech Stack:** React 19, Vite 7, `@react-three/fiber`, `three/webgpu`, `three/tsl`, the existing `momentBus.js` and `glyphPhysics.js` modules. No new dependencies.

---

## File Structure

**Create:**
- `src/lib/formationStage.js` — three-stage pub/sub store (0 | 1 | 2 + reset).
- `src/lib/__tests__/formationStage.test.js` — unit tests for the store contract.
- `src/lib/flowerOfLifeTargets.js` — pure target generator: 7 circle outlines → ~800 `{x,y}` points in the ±50 particle-space.
- `src/lib/__tests__/flowerOfLifeTargets.test.js` — unit tests for the generator.
- `src/phases/admirer-scene/AdmirerScene3D.jsx` — top-level: R3F Canvas + WebGPU renderer factory + WebGPU-fallback gate + particle overlay + stage/release opacity driver.
- `src/phases/admirer-scene/ParticleFormation.jsx` — the 2D HTML canvas: builds particles from flower-of-life targets, runs `glyphPhysics` per frame, fades out as release→1.

**Modify:**
- `src/aureola-three-plane/runtime.js` — `buildDisplacementMaterial` accepts optional `opts.opacityU` and folds it into `opacityNode` (used by `BackPlane` + `FrontFigurePlane`).
- `src/aureola-three-plane/BackPlane.jsx` — accept optional `opacityU` prop and pass through.
- `src/aureola-three-plane/FrontFigurePlane.jsx` — accept optional `opacityU` prop and pass through.
- `src/aureola-three-plane/MiddleShaderPlane.jsx` — `buildMiddleMaterial(opacityU)` multiplies the additive `colorNode` by `opacityU` when provided.
- `src/aureola-three-plane/ThreePlaneScene.jsx` — accept optional `backOpacityU`, `middleOpacityU`, `frontOpacityU` props and forward to the planes.
- `src/phases/Admirer.jsx` — reset `formationStage` on mount; advance to 1 inside `resolveRating` (gated on `pending.fragmentId` like the existing moment fire); advance to 2 inside `onStartGeneration`; mount `<AdmirerScene3D />` inside `<Paper>` BEFORE the UI `<div>`.
- `src/phases/ReflectionSurface.jsx` — drop the `<BackgroundGlyph />` import + render; keep the lexicon strip only.

**Untouched** (kept for tests + WebGPU fallback):
- `src/phases/BackgroundGlyph.jsx`
- `src/lib/glyphPhysics.js` (used by `ParticleFormation`)
- `src/lib/glyphRasterizer.js` (still used by `BackgroundGlyph` fallback)

---

## Task 1: Formation-stage store

**Files:**
- Create: `src/lib/formationStage.js`
- Test: `src/lib/__tests__/formationStage.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// src/lib/__tests__/formationStage.test.js
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getFormationStage,
  advanceFormationStage,
  subscribeFormationStage,
  resetFormationStage,
} from '../formationStage.js'

afterEach(() => {
  resetFormationStage()
})

describe('formationStage', () => {
  it('starts at stage 0', () => {
    expect(getFormationStage()).toBe(0)
  })

  it('advances forward', () => {
    advanceFormationStage(1)
    expect(getFormationStage()).toBe(1)
    advanceFormationStage(2)
    expect(getFormationStage()).toBe(2)
  })

  it('never goes backward', () => {
    advanceFormationStage(2)
    advanceFormationStage(1)
    expect(getFormationStage()).toBe(2)
  })

  it('ignores repeats at the current stage', () => {
    const fn = vi.fn()
    subscribeFormationStage(fn)
    fn.mockClear() // ignore the immediate-emit on subscribe
    advanceFormationStage(0)
    expect(fn).not.toHaveBeenCalled()
  })

  it('immediately emits the current stage on subscribe', () => {
    advanceFormationStage(1)
    const fn = vi.fn()
    subscribeFormationStage(fn)
    expect(fn).toHaveBeenCalledWith(1)
  })

  it('notifies subscribers on advance', () => {
    const fn = vi.fn()
    const unsub = subscribeFormationStage(fn)
    fn.mockClear()
    advanceFormationStage(1)
    expect(fn).toHaveBeenCalledWith(1)
    unsub()
    advanceFormationStage(2)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('resets to 0 and notifies', () => {
    advanceFormationStage(2)
    const fn = vi.fn()
    subscribeFormationStage(fn)
    fn.mockClear()
    resetFormationStage()
    expect(getFormationStage()).toBe(0)
    expect(fn).toHaveBeenCalledWith(0)
  })

  it('resetFormationStage at 0 does not notify', () => {
    const fn = vi.fn()
    subscribeFormationStage(fn)
    fn.mockClear()
    resetFormationStage()
    expect(fn).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/formationStage.test.js`
Expected: FAIL (file not found / module not resolved).

- [ ] **Step 3: Write the implementation**

```javascript
// src/lib/formationStage.js
// Three-stage formation store for the Admirer phase's 3D scene.
//
//   0 — sacred geometry forming (particles → flower-of-life on middle plane)
//   1 — cosmic periphery (back plane) fading in
//   2 — front figure fading in
//
// Stages only advance, never go back. Reset on phase entry.

let stage = 0
const listeners = new Set()

export function getFormationStage() {
  return stage
}

export function advanceFormationStage(target) {
  if (target <= stage) return
  stage = target
  listeners.forEach((fn) => fn(stage))
}

export function subscribeFormationStage(fn) {
  listeners.add(fn)
  fn(stage)
  return () => listeners.delete(fn)
}

export function resetFormationStage() {
  if (stage === 0) return
  stage = 0
  listeners.forEach((fn) => fn(stage))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/formationStage.test.js`
Expected: 7/7 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/formationStage.js src/lib/__tests__/formationStage.test.js
git commit -m "feat(formation-stage): three-stage pub/sub for Admirer scene"
```

---

## Task 2: Flower-of-life target generator

**Files:**
- Create: `src/lib/flowerOfLifeTargets.js`
- Test: `src/lib/__tests__/flowerOfLifeTargets.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// src/lib/__tests__/flowerOfLifeTargets.test.js
import { describe, expect, it } from 'vitest'
import {
  FLOWER_CENTERS,
  FLOWER_LATTICE_R,
  FLOWER_EXTENT,
  buildFlowerOfLifeTargets,
} from '../flowerOfLifeTargets.js'

describe('flowerOfLifeTargets', () => {
  it('exposes 7 circle centers matching the shader hex pattern', () => {
    expect(FLOWER_CENTERS).toHaveLength(7)
    // Center
    expect(FLOWER_CENTERS[0]).toEqual([0, 0])
    // All 6 outer centers sit exactly LATTICE_R from the origin.
    for (let i = 1; i < 7; i++) {
      const [x, y] = FLOWER_CENTERS[i]
      const d = Math.sqrt(x * x + y * y)
      expect(d).toBeCloseTo(FLOWER_LATTICE_R, 5)
    }
  })

  it('FLOWER_EXTENT equals 2 * LATTICE_R', () => {
    expect(FLOWER_EXTENT).toBeCloseTo(FLOWER_LATTICE_R * 2, 5)
  })

  it('builds exactly `count` targets', () => {
    const ts = buildFlowerOfLifeTargets(800, () => 0.5)
    expect(ts).toHaveLength(800)
  })

  it('distributes points across all 7 circles (no single circle hogs)', () => {
    const ts = buildFlowerOfLifeTargets(700, () => 0.5)
    // 700 / 7 = 100 per circle exactly. Count how many points fall
    // within LATTICE_R + small epsilon of each center.
    const counts = FLOWER_CENTERS.map(([cx, cy]) => {
      let n = 0
      for (const p of ts) {
        const dx = p.x - cx
        const dy = p.y - cy
        const d = Math.sqrt(dx * dx + dy * dy)
        if (Math.abs(d - FLOWER_LATTICE_R) < 0.5) n++
      }
      return n
    })
    // Every circle must own at least 90 outline points (some points are
    // shared between two circles where they touch, so the count can dip).
    counts.forEach((c) => expect(c).toBeGreaterThanOrEqual(90))
  })

  it('targets lie near a circle outline (within jitter band)', () => {
    const ts = buildFlowerOfLifeTargets(800, () => 0.5)
    // Each target must be within LATTICE_R ± 0.2 of at least one center.
    for (const p of ts) {
      const onSomeCircle = FLOWER_CENTERS.some(([cx, cy]) => {
        const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
        return Math.abs(d - FLOWER_LATTICE_R) < 0.2
      })
      expect(onSomeCircle).toBe(true)
    }
  })

  it('is deterministic for a given rand', () => {
    const rand = () => 0.5
    const a = buildFlowerOfLifeTargets(50, rand)
    const b = buildFlowerOfLifeTargets(50, rand)
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/flowerOfLifeTargets.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```javascript
// src/lib/flowerOfLifeTargets.js
// Particle targets along the 7-circle flower-of-life that the
// AdmirerScene3D's MiddleShaderPlane draws.
//
// Geometry: one center circle + 6 surrounding circles at 60° intervals,
// each touching the center (inter-center distance = radius). Same layout
// as MiddleShaderPlane's FLOWER_CENTERS, scaled into the ±50 particle-space
// the glyphPhysics expects.

const SIN_60 = 0.8660254038
const LATTICE_R = 10

export const FLOWER_LATTICE_R = LATTICE_R
// Outermost reach of a particle on a peripheral circle outline: 2R from origin.
export const FLOWER_EXTENT = LATTICE_R * 2

export const FLOWER_CENTERS = [
  [0, 0],
  [LATTICE_R, 0],
  [LATTICE_R * 0.5, LATTICE_R * SIN_60],
  [-LATTICE_R * 0.5, LATTICE_R * SIN_60],
  [-LATTICE_R, 0],
  [-LATTICE_R * 0.5, -LATTICE_R * SIN_60],
  [LATTICE_R * 0.5, -LATTICE_R * SIN_60],
]

// Build `count` target positions distributed evenly along the 7 circle
// outlines. Points-per-circle differ by at most 1; each circle has a
// golden-ratio phase offset so the seams where adjacent circles touch
// are not aligned.
export function buildFlowerOfLifeTargets(count, rand = Math.random) {
  const targets = []
  const perCircle = Math.floor(count / FLOWER_CENTERS.length)
  const remainder = count - perCircle * FLOWER_CENTERS.length
  for (let i = 0; i < FLOWER_CENTERS.length; i++) {
    const [cx, cy] = FLOWER_CENTERS[i]
    const n = perCircle + (i < remainder ? 1 : 0)
    const phase = i * 0.618034 * Math.PI * 2
    for (let j = 0; j < n; j++) {
      // Tiny per-point radial jitter so the outline doesn't look
      // mechanically sampled. Jitter << LATTICE_R so the form is
      // unmistakably circle-outlines.
      const jitter = (rand() - 0.5) * 0.2
      const a = (j / n) * Math.PI * 2 + phase
      targets.push({
        x: cx + Math.cos(a) * (LATTICE_R + jitter),
        y: cy + Math.sin(a) * (LATTICE_R + jitter),
      })
    }
  }
  return targets
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/flowerOfLifeTargets.test.js`
Expected: 6/6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/flowerOfLifeTargets.js src/lib/__tests__/flowerOfLifeTargets.test.js
git commit -m "feat(flower-of-life-targets): 7-circle particle target generator"
```

---

## Task 3: opacityU on `buildDisplacementMaterial`

**Files:**
- Modify: `src/aureola-three-plane/runtime.js:74-92`

Three.js TSL `uniform()` nodes can be multiplied into existing TSL nodes via `.mul(...)`. Reference: the `webgpu_hdr.html` example builds `m.opacityNode = a` exactly this way, and `webgpu_materials.html` shows `m.opacityNode = texture(uvTexture)` — both confirm `opacityNode` accepts any TSL node, and chaining `.mul(uniform)` is the standard fade-control pattern.

- [ ] **Step 1: Edit `buildDisplacementMaterial` to fold `opts.opacityU` into the opacity node**

In `src/aureola-three-plane/runtime.js`, replace the function body. The full updated function:

```javascript
// ---- Depth-displacement material helper ----
// Mirrors the TSL shader pattern from aureola-integration/IntegrationBase
// (and ultimately bestiary/Workbench). Both back + front planes use this;
// only the displacementScale varies, the front overrides opacityNode for
// the figure's alpha channel, and consumers can pass `opacityU` (a TSL
// `uniform()`) to multiply a live fade value into the final opacity.
//
//   opts:
//     displacementScale  (required, e.g. 0.35 back, 0.22 front)
//     useTextureAlpha    (front-figure plane sets true → opacityNode = texture.a)
//     opacityMultiplier  (multiplies the texture alpha when useTextureAlpha; e.g.
//                         0.85 to make the figure slightly translucent)
//     alphaTest          (discard fragments below this alpha threshold)
//     opacityU           (TSL uniform node — folded as multiplicative fade)
export function buildDisplacementMaterial(colorTex, depthTex, opts = {}) {
  const displacementScale = opts.displacementScale ?? 0.15
  const opacityMultiplier = opts.opacityMultiplier ?? 1.0
  const m = new MeshBasicNodeMaterial()
  const sampled = texture(colorTex)
  m.colorNode = sampled
  if (opts.useTextureAlpha) {
    m.transparent = true
    m.opacityNode = opacityMultiplier === 1.0
      ? sampled.a
      : sampled.a.mul(opacityMultiplier)
    if (opts.alphaTest !== undefined) m.alphaTest = opts.alphaTest
  }
  if (opts.opacityU) {
    m.transparent = true
    m.opacityNode = m.opacityNode ? m.opacityNode.mul(opts.opacityU) : opts.opacityU
  }
  const depthValue = texture(depthTex).r
  m.positionNode = positionLocal.add(
    vec3(0, 0, depthValue.mul(displacementScale)),
  )
  return m
}
```

- [ ] **Step 2: Verify the test route still builds and renders**

Run: `npm run build`
Expected: build succeeds with no new warnings about `runtime.js`.

Then start the dev server (`npm run dev`) and load `http://localhost:5173/aureola-three-plane-test` — confirm the existing scene still renders identically (no opacity prop is passed, so behavior is unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/aureola-three-plane/runtime.js
git commit -m "feat(three-plane): optional opacityU uniform on displacement material"
```

---

## Task 4: opacityU on `BackPlane`

**Files:**
- Modify: `src/aureola-three-plane/BackPlane.jsx:14-22`

- [ ] **Step 1: Edit the component**

Replace the existing `BackPlane` component. Updated file:

```javascript
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { BACK_CONSTANTS, PLANE_Z, buildDisplacementMaterial } from './runtime'

const SEGMENTS_W = 256
const SEGMENTS_H = 144
const DISPLACEMENT_SCALE = 0.22

// BackPlane — cosmic periphery at z = -0.5, depth-displaced.
// `depthOn` is a debug toggle: when false, displacementScale collapses to 0 so
// the back reads as a flat sheet.
// `opacityU` — optional TSL `uniform()` node. When provided, the plane fades
// in/out with `opacityU.value` 0..1 (used by AdmirerScene3D for stage gating).
export default function BackPlane({ colorTex, depthTex, depthOn = true, opacityU = null }) {
  const material = useMemo(
    () => buildDisplacementMaterial(colorTex, depthTex, {
      displacementScale: depthOn ? DISPLACEMENT_SCALE : 0,
      opacityU,
    }),
    [colorTex, depthTex, depthOn, opacityU],
  )

  useEffect(() => () => material.dispose(), [material])

  const { viewport } = useThree()
  const viewportAspect = viewport.width / viewport.height
  const baseScale = viewportAspect > BACK_CONSTANTS.IMAGE_ASPECT
    ? viewport.width / BACK_CONSTANTS.BASE_PLANE_W
    : viewport.height / BACK_CONSTANTS.BASE_PLANE_H
  const scale = baseScale * BACK_CONSTANTS.COVER_HEADROOM

  return (
    <mesh scale={[scale, scale, 1]} position={[0, 0, PLANE_Z.BACK]}>
      <planeGeometry
        args={[BACK_CONSTANTS.BASE_PLANE_W, BACK_CONSTANTS.BASE_PLANE_H, SEGMENTS_W, SEGMENTS_H]}
      />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
```

- [ ] **Step 2: Verify the test route still renders**

Reload `http://localhost:5173/aureola-three-plane-test`. The back plane should look identical (no opacityU passed).

- [ ] **Step 3: Commit**

```bash
git add src/aureola-three-plane/BackPlane.jsx
git commit -m "feat(back-plane): forward optional opacityU prop"
```

---

## Task 5: opacityU on `FrontFigurePlane`

**Files:**
- Modify: `src/aureola-three-plane/FrontFigurePlane.jsx:28-40`

- [ ] **Step 1: Edit the component**

Replace the existing `FrontFigurePlane` component. Updated file:

```javascript
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import {
  BACK_CONSTANTS,
  FRONT_CONSTANTS,
  PLANE_Z,
  buildDisplacementMaterial,
} from './runtime'

const SEGMENTS_W = 256
const SEGMENTS_H = 144
const DISPLACEMENT_SCALE = 0.14
const ALPHA_TEST = 0.1
const FIGURE_OPACITY = 0.85
const FRONT_HEIGHT_OF_BACK = 0.75
const FRONT_BASE_PLANE_H = BACK_CONSTANTS.BASE_PLANE_H * FRONT_HEIGHT_OF_BACK
const FRONT_BASE_PLANE_W = FRONT_BASE_PLANE_H * FRONT_CONSTANTS.IMAGE_ASPECT

// `opacityU` — optional TSL `uniform()` node. When provided, the figure
// fades in/out with `opacityU.value` 0..1, ON TOP of the per-fragment
// alpha (so the silhouette is preserved while the whole figure fades).
export default function FrontFigurePlane({ colorTex, depthTex, opacityU = null }) {
  const material = useMemo(
    () => buildDisplacementMaterial(colorTex, depthTex, {
      displacementScale: DISPLACEMENT_SCALE,
      useTextureAlpha: true,
      alphaTest: ALPHA_TEST,
      opacityMultiplier: FIGURE_OPACITY,
      opacityU,
    }),
    [colorTex, depthTex, opacityU],
  )

  useEffect(() => () => material.dispose(), [material])

  const { viewport } = useThree()
  const viewportAspect = viewport.width / viewport.height
  const baseScale = viewportAspect > BACK_CONSTANTS.IMAGE_ASPECT
    ? viewport.width / BACK_CONSTANTS.BASE_PLANE_W
    : viewport.height / BACK_CONSTANTS.BASE_PLANE_H
  const scale = baseScale * BACK_CONSTANTS.COVER_HEADROOM

  return (
    <mesh scale={[scale, scale, 1]} position={[0, 0, PLANE_Z.FRONT]}>
      <planeGeometry
        args={[FRONT_BASE_PLANE_W, FRONT_BASE_PLANE_H, SEGMENTS_W, SEGMENTS_H]}
      />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
```

- [ ] **Step 2: Verify the test route still renders**

Reload `http://localhost:5173/aureola-three-plane-test`. The figure should look identical.

- [ ] **Step 3: Commit**

```bash
git add src/aureola-three-plane/FrontFigurePlane.jsx
git commit -m "feat(front-figure-plane): forward optional opacityU prop"
```

---

## Task 6: opacityU on `MiddleShaderPlane`

**Files:**
- Modify: `src/aureola-three-plane/MiddleShaderPlane.jsx:45-102` (the `buildMiddleMaterial` helper) and `111-144` (the component).

The middle plane uses `AdditiveBlending`. With additive blending, `opacityNode` does NOT fade the contribution — only `colorNode` magnitude matters. To fade additively, multiply `colorNode` by `opacityU`.

- [ ] **Step 1: Edit `buildMiddleMaterial` to accept `opacityU` and multiply into `colorNode`**

Replace the function body. Inside `MiddleShaderPlane.jsx`, change `buildMiddleMaterial`:

```javascript
function buildMiddleMaterial(opacityU = null) {
  const m = new MeshBasicNodeMaterial()
  m.transparent = true
  m.depthWrite = false
  m.blending = AdditiveBlending

  const uvCentered = uv().sub(0.5)
  const uvc = vec2(uvCentered.x.mul(middlePlaneAspectU), uvCentered.y)

  const cosA = cos(middleRotationU)
  const sinA = sin(middleRotationU)
  const ur = vec2(
    uvc.x.mul(cosA).sub(uvc.y.mul(sinA)),
    uvc.x.mul(sinA).add(uvc.y.mul(cosA)),
  )

  // --- Flower of life (always visible) ---
  let lineAlpha = float(0)
  for (const [cx, cy] of FLOWER_CENTERS) {
    const d = ur.sub(vec2(cx, cy)).length()
    const onRing = smoothstep(LINE_WIDTH, 0, d.sub(LATTICE_R).abs())
    lineAlpha = max(lineAlpha, onRing)
  }

  // --- Alchemical ring (fades in at tilt > 10°) ---
  const distFromOrigin = ur.length()
  const alchemicalR = LATTICE_R * 2.5
  const alchemicalRing = smoothstep(LINE_WIDTH, 0, distFromOrigin.sub(alchemicalR).abs())
  const alchemicalFade = smoothstep(8, 12, tiltMagU)
  const alchemicalContribution = alchemicalRing.mul(alchemicalFade)

  // --- Zodiacal ring (fades in at tilt > 20°) ---
  const zodiacalR = LATTICE_R * 3.5
  const zodiacalRing = smoothstep(LINE_WIDTH, 0, distFromOrigin.sub(zodiacalR).abs())
  const zodiacalFade = smoothstep(18, 22, tiltMagU)
  const zodiacalContribution = zodiacalRing.mul(zodiacalFade)

  const totalAlpha = max(lineAlpha, max(alchemicalContribution, zodiacalContribution))

  const goldColor = vec3(0.961, 0.902, 0.784)
  const cyanColor = vec3(0.247, 0.835, 0.941)
  const colorMix = saturate(tiltMagU.div(30))
  const lineColor = mix(goldColor, cyanColor, colorMix)

  // 40% opacity baseline, pre-multiplied into colorNode for additive blend.
  // When `opacityU` is provided, multiply it in so the whole flower fades
  // in/out with the stage-driven uniform. (opacityNode is ignored under
  // additive blending — fades must travel through colorNode.)
  let contribution = lineColor.mul(0.40).mul(totalAlpha)
  if (opacityU) contribution = contribution.mul(opacityU)
  m.colorNode = contribution
  m.opacityNode = float(1)

  return m
}
```

- [ ] **Step 2: Edit the component to accept `opacityU` prop and pass it to the builder**

In the same file, update the component signature and `useMemo` deps:

```javascript
export default function MiddleShaderPlane({ getTilt, baseRate, z, opacityU = null }) {
  const material = useMemo(() => buildMiddleMaterial(opacityU), [opacityU])
  // ...rest unchanged...
}
```

- [ ] **Step 3: Verify the test route still renders**

Reload `http://localhost:5173/aureola-three-plane-test`. The flower-of-life should look identical to before (no opacityU passed → `if (opacityU)` is false → unchanged contribution).

- [ ] **Step 4: Commit**

```bash
git add src/aureola-three-plane/MiddleShaderPlane.jsx
git commit -m "feat(middle-shader-plane): optional opacityU multiplied into colorNode for additive fade"
```

---

## Task 7: Forward opacity uniforms through `ThreePlaneScene`

**Files:**
- Modify: `src/aureola-three-plane/ThreePlaneScene.jsx:43-111`

- [ ] **Step 1: Edit the component**

Replace the existing scene. Updated file:

```javascript
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  ClampToEdgeWrapping,
  LinearFilter,
  NoColorSpace,
  SRGBColorSpace,
  TextureLoader,
} from 'three/webgpu'
import AtmosphericGrain from './AtmosphericGrain'
import BackPlane from './BackPlane'
import MiddleShaderPlane from './MiddleShaderPlane'
import FrontFigurePlane from './FrontFigurePlane'

const PATHS = {
  back: '/three-plane-test/back-pool2-y1.png',
  backDepth: '/three-plane-test/back-pool2-y1-depth.png',
  front: '/three-plane-test/front-figure-v1.png',
  frontDepth: '/three-plane-test/front-figure-v1-depth.png',
}

const TILT_RANGE = 0.3

function configureColor(tex) {
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
}

function configureDepth(tex) {
  tex.colorSpace = NoColorSpace
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
}

// ThreePlaneScene — runs inside the Canvas. Owns texture loading + camera-tilt
// translation. The optional opacity uniforms drive per-plane fades when this
// scene is hosted inside AdmirerScene3D; the /aureola-three-plane-test route
// omits them and the planes behave as before.
export default function ThreePlaneScene({
  getTilt,
  middleVisible,
  backDepthOn,
  frontVisible,
  middleZ,
  middleBaseRate,
  backOpacityU = null,
  middleOpacityU = null,
  frontOpacityU = null,
}) {
  const {
    backColor,
    backDepth,
    frontColor,
    frontDepth,
  } = useMemo(() => {
    const loader = new TextureLoader()
    const backC = loader.load(PATHS.back)
    configureColor(backC)
    const backD = loader.load(PATHS.backDepth)
    configureDepth(backD)
    const frontC = loader.load(PATHS.front)
    configureColor(frontC)
    const frontD = loader.load(PATHS.frontDepth)
    configureDepth(frontD)
    return {
      backColor: backC,
      backDepth: backD,
      frontColor: frontC,
      frontDepth: frontD,
    }
  }, [])

  useEffect(() => () => {
    backColor.dispose()
    backDepth.dispose()
    frontColor.dispose()
    frontDepth.dispose()
  }, [backColor, backDepth, frontColor, frontDepth])

  useFrame(({ camera }, dt) => {
    const { x, y } = getTilt()
    const targetX = x * TILT_RANGE
    const targetY = y * TILT_RANGE
    const k = Math.min(1, dt * 6)
    camera.position.x += (targetX - camera.position.x) * k
    camera.position.y += (targetY - camera.position.y) * k
    camera.lookAt(0, 0, 0)
  })

  return (
    <>
      <BackPlane colorTex={backColor} depthTex={backDepth} depthOn={backDepthOn} opacityU={backOpacityU} />
      {middleVisible && (
        <MiddleShaderPlane
          getTilt={getTilt}
          baseRate={middleBaseRate}
          z={middleZ}
          opacityU={middleOpacityU}
        />
      )}
      {frontVisible && (
        <FrontFigurePlane colorTex={frontColor} depthTex={frontDepth} opacityU={frontOpacityU} />
      )}
      <AtmosphericGrain />
    </>
  )
}
```

- [ ] **Step 2: Verify the test route still renders**

Reload `http://localhost:5173/aureola-three-plane-test`. All three planes should look identical (opacity uniforms omitted by the test route).

- [ ] **Step 3: Commit**

```bash
git add src/aureola-three-plane/ThreePlaneScene.jsx
git commit -m "feat(three-plane-scene): forward optional opacity uniforms to planes"
```

---

## Task 8: `ParticleFormation` — 2D HTML canvas particle overlay

**Files:**
- Create: `src/phases/admirer-scene/ParticleFormation.jsx`

This component owns its own 2D HTML canvas, subscribes to `momentBus`, and uses the existing `glyphPhysics.stepParticle` to flow particles from random scatter toward flower-of-life targets. Particles fade out as release ratio crosses `PARTICLE_FADE_START` so the 3D middle-plane shader becomes the persistent geometry.

- [ ] **Step 1: Write the component**

```jsx
// src/phases/admirer-scene/ParticleFormation.jsx
import { useEffect, useRef } from 'react'
import { usePhoneMotion } from '../../hooks/usePhoneMotion.js'
import { subscribeMoments } from '../../lib/momentBus.js'
import { buildFlowerOfLifeTargets } from '../../lib/flowerOfLifeTargets.js'
import { stepParticle } from '../../lib/glyphPhysics.js'

// Particle overlay for the AdmirerScene3D: forms the same flower-of-life
// the MiddleShaderPlane draws, then fades out as release approaches 1 so
// the 3D plane becomes the persistent form. Mirrors BackgroundGlyph's
// physics + release-wave staging but targets the flower-of-life directly
// instead of a rasterised SVG tile.
//
// Coordinate space: glyphPhysics works in a ±50 origin-centered space; we
// scale points onto the screen so the flower (extent ±20) spans roughly
// 30% of the smaller viewport dimension — matching the visual size of
// MiddleShaderPlane's shader-rendered flower behind it.

const PARTICLE_COUNT = 800
const SCATTER_RADIUS = 70
const RELEASE_STAGGER_MS = 4
const PARTICLE_FADE_START = 0.7
const PARTICLE_FADE_END = 1.0
const PARTICLE_BASE_OPACITY = 0.55
const FLOWER_EXTENT_UNITS = 40            // 2 * LATTICE_R * 2 (full diameter)
const FLOWER_EXTENT_SCREEN_FRAC = 0.30    // ~30% of min viewport dim
const MAX_DPR = 2

export default function ParticleFormation() {
  const canvasRef = useRef(null)
  const releaseRef = useRef(0)
  const particlesRef = useRef(null)
  const readMotion = usePhoneMotion()

  useEffect(() => {
    const targets = buildFlowerOfLifeTargets(PARTICLE_COUNT)
    const particles = targets.map((t) => {
      const sx = (Math.random() - 0.5) * 2 * SCATTER_RADIUS
      const sy = (Math.random() - 0.5) * 2 * SCATTER_RADIUS
      return {
        x: sx, y: sy,
        vx: 0, vy: 0,
        tx: t.x, ty: t.y,
        sx, sy,
        releasedAt: 0,
      }
    })
    for (let i = particles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[particles[i], particles[j]] = [particles[j], particles[i]]
    }
    particlesRef.current = particles
  }, [])

  useEffect(() => subscribeMoments((r) => { releaseRef.current = r }), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    let w = 0, h = 0
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const inkColor = (getComputedStyle(canvas).getPropertyValue('--ink') || '').trim() || '#1C1814'
    const motionForce = { x: 0, y: 0 }
    let raf = 0
    let mounted = true
    let prevNow = performance.now()
    let lastReleasedCount = 0

    const frame = (now) => {
      if (!mounted) return
      const dtRaw = (now - prevNow) / 1000
      const dt = Math.max(0, Math.min(1 / 30, dtRaw))
      prevNow = now

      const particles = particlesRef.current
      if (!particles) {
        raf = requestAnimationFrame(frame)
        return
      }

      const release = releaseRef.current
      const targetReleasedCount = Math.floor(particles.length * release)
      if (targetReleasedCount > lastReleasedCount) {
        for (let i = lastReleasedCount; i < targetReleasedCount; i++) {
          if (!particles[i].releasedAt) {
            particles[i].releasedAt = now + (i - lastReleasedCount) * RELEASE_STAGGER_MS
          }
        }
        lastReleasedCount = targetReleasedCount
      }

      const m = readMotion()
      motionForce.x = m.pan == null ? 0 : (m.pan - 0.5) * 2
      motionForce.y = m.filterNorm == null ? 0 : (m.filterNorm - 0.5) * 2

      for (let i = 0; i < particles.length; i++) {
        stepParticle(particles[i], dt, motionForce, now)
      }

      let fade = 0
      if (release > PARTICLE_FADE_START) {
        fade = Math.min(1, (release - PARTICLE_FADE_START) / (PARTICLE_FADE_END - PARTICLE_FADE_START))
      }
      const particleOpacity = PARTICLE_BASE_OPACITY * (1 - fade)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)

      const minDim = Math.min(w, h)
      const ps = (minDim * FLOWER_EXTENT_SCREEN_FRAC) / FLOWER_EXTENT_UNITS
      const cxp = w / 2
      const cyp = h / 2

      ctx.fillStyle = colorWithAlpha(inkColor, particleOpacity)
      for (const p of particles) {
        const x = cxp + p.x * ps
        const y = cyp + p.y * ps
        ctx.beginPath()
        ctx.arc(x, y, 1.0, 0, Math.PI * 2)
        ctx.fill()
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
        zIndex: 2,
      }}
    />
  )
}

function colorWithAlpha(color, alpha) {
  if (alpha <= 0) return 'rgba(0,0,0,0)'
  if (!color) return `rgba(28,24,20,${alpha})`
  const m = color.trim().match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${alpha})`
  }
  return color
}
```

- [ ] **Step 2: Smoke-check the component compiles**

Run: `npm run build`
Expected: build succeeds (the component isn't referenced yet — Vite will tree-shake it but the build catches syntax errors).

- [ ] **Step 3: Commit**

```bash
git add src/phases/admirer-scene/ParticleFormation.jsx
git commit -m "feat(admirer-scene): ParticleFormation overlay targeting the flower-of-life"
```

---

## Task 9: `AdmirerScene3D` — top-level R3F + WebGPU + opacity driver + fallback

**Files:**
- Create: `src/phases/admirer-scene/AdmirerScene3D.jsx`

R3F's `gl` prop accepts a function returning a promise that resolves to a `WebGPURenderer` instance — confirmed by the official R3F docs (`canvas.mdx`). We use the same pattern the existing `/aureola-three-plane-test` route uses, plus an explicit `setClearColor(0, 0)` so the cream Paper background shows through.

If `navigator.gpu` is missing OR the async renderer factory throws, we never mount the Canvas — we render `<BackgroundGlyph />` instead. This preserves the Admirer experience on devices without WebGPU.

- [ ] **Step 1: Write the component**

```jsx
// src/phases/admirer-scene/AdmirerScene3D.jsx
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'
import { uniform } from 'three/tsl'
import { usePhoneMotion } from '../../hooks/usePhoneMotion.js'
import { subscribeMoments } from '../../lib/momentBus.js'
import { subscribeFormationStage } from '../../lib/formationStage.js'
import ThreePlaneScene from '../../aureola-three-plane/ThreePlaneScene'
import ParticleFormation from './ParticleFormation'
import BackgroundGlyph from '../BackgroundGlyph'

// AdmirerScene3D — the Admirer phase's background visual. Three stacked
// planes (back/middle/front) plus a 2D HTML particle overlay layered on
// top. Particles form into the middle-plane flower-of-life paced by the
// momentBus release ratio; back plane fades in at formation stage 1
// (first fragment rated); front figure fades in at stage 2 (startGeneration).
//
// Mounts inside Admirer's <Paper variant="cream"> so the cream paper is
// visible until the back plane fades in. WebGPU is required; if the
// device doesn't support it, we render the existing BackgroundGlyph
// instead so the phase still works.

const TILT_CLAMP_DEG = 30
// Exponential ease rate per second for the opacity uniforms — opacity
// converges to target in roughly ~2s.
const OPACITY_EASE_RATE = 2.0

function StageOpacityDriver({ middleOpacityU, backOpacityU, frontOpacityU }) {
  const stageRef = useRef(0)
  const releaseRef = useRef(0)

  useEffect(() => subscribeFormationStage((s) => { stageRef.current = s }), [])
  useEffect(() => subscribeMoments((r) => { releaseRef.current = r }), [])

  useFrame((_, dt) => {
    const stage = stageRef.current
    const release = releaseRef.current

    // Middle plane: opacity = release ratio. By release=1 (startGeneration
    // snaps it there) the shader-rendered flower-of-life is fully visible.
    // No easing here — we follow momentBus exactly so the particle fadeout
    // and shader fadein land at the same frame.
    middleOpacityU.value = release

    // Back + front: stage-gated, eased.
    const backTarget = stage >= 1 ? 1 : 0
    const frontTarget = stage >= 2 ? 1 : 0
    const k = 1 - Math.exp(-OPACITY_EASE_RATE * dt)
    backOpacityU.value += (backTarget - backOpacityU.value) * k
    frontOpacityU.value += (frontTarget - frontOpacityU.value) * k
  })

  return null
}

function hasWebGPU() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

export default function AdmirerScene3D() {
  const tiltRef = useRef({ x: 0, y: 0, gamma: 0, beta: 0 })
  const readMotion = usePhoneMotion()

  // Synchronously decide WebGPU vs fallback so we don't mount + tear down
  // the Canvas if support is missing.
  const [supported] = useState(() => hasWebGPU())
  const [webgpuFailed, setWebgpuFailed] = useState(false)

  const middleOpacityU = useMemo(() => uniform(0), [])
  const backOpacityU = useMemo(() => uniform(0), [])
  const frontOpacityU = useMemo(() => uniform(0), [])

  useEffect(() => {
    let raf
    const tick = () => {
      const m = readMotion()
      const gamma = Math.max(-TILT_CLAMP_DEG, Math.min(TILT_CLAMP_DEG, m.gamma ?? 0))
      const beta = Math.max(-TILT_CLAMP_DEG, Math.min(TILT_CLAMP_DEG, m.beta ?? 0))
      tiltRef.current = {
        x: gamma / TILT_CLAMP_DEG,
        y: beta / TILT_CLAMP_DEG,
        gamma,
        beta,
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [readMotion])

  const getTilt = useCallback(() => tiltRef.current, [])

  const makeRenderer = useCallback(async (props) => {
    try {
      const renderer = new WebGPURenderer({ ...props, antialias: true, alpha: true })
      await renderer.init()
      renderer.setClearColor(0x000000, 0)
      return renderer
    } catch (err) {
      console.error('[AdmirerScene3D] WebGPU init failed', err)
      setWebgpuFailed(true)
      throw err
    }
  }, [])

  // No WebGPU? Render the existing BackgroundGlyph so the phase still works.
  if (!supported || webgpuFailed) {
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
        <BackgroundGlyph />
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      <Canvas
        camera={{ position: [0, 0, 2.0], fov: 35 }}
        gl={makeRenderer}
        dpr={[1, 2]}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Suspense fallback={null}>
          <ThreePlaneScene
            getTilt={getTilt}
            middleVisible
            backDepthOn
            frontVisible
            middleZ={0}
            middleBaseRate={0.05}
            backOpacityU={backOpacityU}
            middleOpacityU={middleOpacityU}
            frontOpacityU={frontOpacityU}
          />
          <StageOpacityDriver
            middleOpacityU={middleOpacityU}
            backOpacityU={backOpacityU}
            frontOpacityU={frontOpacityU}
          />
        </Suspense>
      </Canvas>
      <ParticleFormation />
    </div>
  )
}
```

- [ ] **Step 2: Smoke-check the component compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/phases/admirer-scene/AdmirerScene3D.jsx
git commit -m "feat(admirer-scene): AdmirerScene3D — R3F+WebGPU with stage-driven plane fades + WebGPU fallback"
```

---

## Task 10: Wire `AdmirerScene3D` and milestones into `Admirer.jsx`

**Files:**
- Modify: `src/phases/Admirer.jsx`

Three pieces:
1. Reset `formationStage` on Admirer mount (alongside the existing `resetMoments()`).
2. In `resolveRating`, when a real fragment rating resolves (gated on `pending.fragmentId`, same condition as the existing `fireMoment` call), call `advanceFormationStage(1)`. Repeat calls are no-ops by the store's contract.
3. In `onStartGeneration`, call `advanceFormationStage(2)` next to the existing `fireMoment(1.0, 'startGeneration')`.
4. Mount `<AdmirerScene3D />` inside `<Paper>` BEFORE the UI `<div>` so it sits underneath the controls.

- [ ] **Step 1: Edit `src/phases/Admirer.jsx`**

Add imports at the top:

```javascript
import { fireMoment, resetMoments } from '../lib/momentBus.js'
import { advanceFormationStage, resetFormationStage } from '../lib/formationStage.js'
// ...other existing imports unchanged...
import AdmirerScene3D from './admirer-scene/AdmirerScene3D'
```

Inside `resolveRating`, change:

```javascript
if (pending) {
  if (pending.fragmentId) fireMoment(0.08, `fragment:${pending.fragmentId}`)
  pending.resolve(answer)
}
```

to:

```javascript
if (pending) {
  if (pending.fragmentId) {
    fireMoment(0.08, `fragment:${pending.fragmentId}`)
    // First fragment rated → advance formation stage. Subsequent ratings
    // are no-ops by the formationStage contract.
    advanceFormationStage(1)
  }
  pending.resolve(answer)
}
```

Inside `onStartGeneration`, change:

```javascript
setGenerationStarted(true)
// Editorial moment: ...
fireMoment(1.0, 'startGeneration')
stemsBundleRef.current = bundle
```

to:

```javascript
setGenerationStarted(true)
// Editorial moment: ...
fireMoment(1.0, 'startGeneration')
// Formation stage 2 — front figure fades in over the orchestra handoff.
advanceFormationStage(2)
stemsBundleRef.current = bundle
```

Inside the mount `useEffect` that resets moments, change:

```javascript
useEffect(() => {
  resetMoments()
  fireMoment(0.08, 'mount')
}, [])
```

to:

```javascript
useEffect(() => {
  resetMoments()
  resetFormationStage()
  fireMoment(0.08, 'mount')
}, [])
```

Inside the component's `return`, change:

```jsx
return (
  <Paper variant="cream">
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      padding: '0 32px',
    }}>
      {/* ...top region, fragment controls, hold-to-speak... */}
    </div>
  </Paper>
)
```

to:

```jsx
return (
  <Paper variant="cream">
    <AdmirerScene3D />
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      padding: '0 32px',
      zIndex: 5,
    }}>
      {/* ...top region, fragment controls, hold-to-speak... */}
    </div>
  </Paper>
)
```

- [ ] **Step 2: Run the test suite**

Run: `npm test`
Expected: all 367 + 7 (formationStage) + 6 (flowerOfLifeTargets) = 380 tests pass.

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test**

Start dev: `npm run dev`. Open the app, walk to the Admirer phase (URL: `http://localhost:5173/?phase=admirer`), confirm:
- Cream paper background is visible.
- Particles begin scattered and slowly form the flower-of-life as the conversation proceeds.
- The shader-rendered flower-of-life on the middle plane is faintly visible behind the particles from the start, growing brighter with release ratio.
- After the first fragment is rated, the cosmic-pool back plane fades in over ~2s.
- After `startGeneration`, the front figure fades in over ~2s.
- UI controls (state label, QuestionDisplay, HoldToSpeak) remain crisp and on top of the visual.

If WebGPU is unavailable on the test machine, confirm the fallback path: `BackgroundGlyph` renders (random tile particles + SVG overlay), Admirer flow proceeds normally.

- [ ] **Step 5: Commit**

```bash
git add src/phases/Admirer.jsx
git commit -m "feat(admirer): wire AdmirerScene3D + formation-stage milestones"
```

---

## Task 11: Drop `BackgroundGlyph` from `ReflectionSurface`

**Files:**
- Modify: `src/phases/ReflectionSurface.jsx`

`BackgroundGlyph` is still used by the `AdmirerScene3D` WebGPU fallback — do NOT delete the file. Just remove the unconditional render from `ReflectionSurface` so the Admirer phase doesn't show two glyph layers (the new 3D scene + the old particle canvas).

- [ ] **Step 1: Edit `src/phases/ReflectionSurface.jsx`**

Replace the whole file:

```jsx
import { useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { subscribeLiveSession, getLiveSession } from '../lib/liveSession.js'

// A calm, peripheral surface, unbroken across the admirer and orchestra
// phases. Renders only the accumulating lexicon — the visual glyph layer
// during the Admirer phase now lives inside Admirer.jsx (AdmirerScene3D),
// which mounts only for that phase. The lexicon strip stays here because
// it should persist across the admirer → orchestra act transition.
//
// The active question the Admirer is asking is handled by QuestionDisplay,
// which lives inside Admirer.jsx in the reading zone just below the state
// label. This surface stays peripheral and non-discursive.
export default function ReflectionSurface() {
  const { lexicon } = useSyncExternalStore(subscribeLiveSession, getLiveSession)

  if (lexicon.length === 0) return null

  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
    >
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: '6px 10px',
          padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 18px)',
          maxWidth: 460,
          margin: '0 auto',
        }}
      >
        {lexicon.map((w, i) => (
          <motion.span
            key={`${w}-${i}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 0.4, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              fontFamily: 'Iowan Old Style, Palatino, serif',
              fontStyle: 'italic', fontSize: 12, letterSpacing: 0.2,
              color: 'var(--ink, currentColor)',
            }}
          >
            {w}
          </motion.span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the test suite**

Run: `npm test`
Expected: all tests pass (BackgroundGlyph tests, if any, remain green because the file is unchanged).

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test**

Reload the dev server. Walk through Admirer + Orchestra phases. Confirm:
- Admirer phase: only the AdmirerScene3D visual is present (no double particles).
- Orchestra phase: the lexicon strip still appears at the bottom; no sacred-geometry glyph in the background (intentional — orchestra has its own visual language).

- [ ] **Step 5: Commit**

```bash
git add src/phases/ReflectionSurface.jsx
git commit -m "refactor(reflection-surface): drop BackgroundGlyph; AdmirerScene3D owns the Admirer visual"
```

---

## Task 12: Final lint + test + manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: ALL tests pass.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Run lint and confirm no new errors**

Run: `npm run lint`
Expected: same pre-existing error count (~137 errors, +12 warnings = 149 problems). NO new errors in the new files (`formationStage.js`, `flowerOfLifeTargets.js`, `AdmirerScene3D.jsx`, `ParticleFormation.jsx`) or the modified ones. Per CLAUDE.md, the bar is "no new lint errors"; the lint debt is documented and not addressed in this plan.

- [ ] **Step 4: Verify the /aureola-three-plane-test route is unaffected**

Open `http://localhost:5173/aureola-three-plane-test`. Confirm the scene renders identically to before this plan: the cosmic pool, the flower-of-life, the figure, the debug panel toggles, the tilt-driven camera all work as today.

- [ ] **Step 5: Verify the full Admirer flow on a real device or DevTools mobile emulation**

Open the app in Chrome DevTools with mobile emulation enabled (Chrome supports WebGPU on desktop, so the path under test is exercised). Walk through:
1. `entry` → tap begin → grant motion permission.
2. `admirer` arrives — confirm cream paper + faint flower-of-life + scattered particles.
3. Hold to speak — confirm the conversation progresses and particles release over time.
4. Wait for the agent to play a fragment, rate it Yes or No — confirm the back plane begins fading in immediately after the rating.
5. Continue the conversation until `startGeneration` fires — confirm the front figure fades in and the middle-plane flower is fully bright.
6. Confirm the orchestra phase follows normally with the lexicon strip visible.

- [ ] **Step 6: Commit (if any tweaks were needed)**

If no tweaks: skip. If tweaks: `git add` the relevant files and commit with a clear "polish:" message.

---

## Self-Review Notes

**Spec coverage:**
- "Particles form INTO the middle plane's flower-of-life" — covered by Tasks 2 (target generator), 8 (overlay), 6 (additive shader fade).
- "Back plane fades in on first fragment rated, front on startGeneration" — covered by Tasks 1, 9, 10.
- "Particle release ratio drives shader opacity within stage 0" — covered by `StageOpacityDriver` in Task 9 (`middleOpacityU.value = release`).
- "Backwards-compatible with /aureola-three-plane-test route" — covered by Tasks 3, 4, 5, 6, 7; verification steps in each task confirm the test route still renders identically.
- "WebGPU fallback" — covered by Task 9 (`supported`/`webgpuFailed` gating + BackgroundGlyph render).
- "Drop BackgroundGlyph from ReflectionSurface" — covered by Task 11.

**Placeholder scan:** No "TBD", "TODO", or "implement later" markers anywhere. Every code step shows the full code to write.

**Type consistency:**
- `advanceFormationStage(target)` / `getFormationStage()` / `subscribeFormationStage(fn)` / `resetFormationStage()` — used identically in Tasks 1, 9, 10.
- `opacityU` prop name — same in Tasks 3, 4, 5, 6, 7, 9.
- `buildFlowerOfLifeTargets(count, rand?)` — defined in Task 2, called in Task 8 with `PARTICLE_COUNT`.
- `subscribeMoments(fn)` / `fireMoment(amount, eventId)` — used as in existing `momentBus.js`, no contract changes.
