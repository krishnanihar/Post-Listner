# The Attunement Room — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the conversation-only Act 1 with a score-led, full-visual "Attunement Room" — hybrid taste extraction (talk + tap + move) that teaches all five Orchestra conducting gestures and blooms seamlessly into the Orchestra.

**Architecture:** A client-owned choreographer drives a six-beat arc (arrival → Lean&Lift → Listen → Rise → Face → Bloom). Pure-logic modules (movement definitions, input→AVD mapping, the archetype ring, a sequence reducer) are unit-tested in isolation; the spatial audio extends the existing `AdmirerRoom`; React components render representational presences over the existing AVD sacred-geometry shader ground; the ElevenLabs agent is demoted to a companion voice. The matched song pre-loads silently during *Rise* and the frame-perfect `detachAndGetSources → connectStems` handoff is preserved.

**Tech Stack:** React 19, Vite 7, Framer Motion, Web Audio API (raw nodes), `@elevenlabs/react`, Vitest 4 + jsdom. Spec: `docs/superpowers/specs/2026-06-20-act1-attunement-room-design.md`.

---

## Conventions & ground rules

- **Branch first.** The repo's working branch for this program is `musicking`. Do not commit to a default branch. Before Task 1, create a feature branch off the current working branch:
  ```bash
  git checkout -b feat/attunement-room
  ```
- **Gates per the project:** `npm run build` clean, `npm test` green, **no new lint errors** (`npm run lint` has ~149 pre-existing problems in legacy code — the bar is no *new* ones). Run `npm test` after every pure-logic task.
- **Pure first.** Milestones 1–2 and the pure helpers in 3–4 are fully TDD. React/audio/agent integration cannot be unit-tested headlessly (no DeviceOrientation, no live SDK in jsdom) — those tasks specify complete implementation code plus a concrete build + on-device verification checklist, matching the rest of `musicking`.
- **AVD axis discipline (important):** `commitTurn(target)` EWMA-steps *all three* axes toward `target`. A movement that only probes some axes must set the *unprobed* axes of its target to the **current** vector value so they don't drift. Every `*Target(...)` helper below takes `current` for exactly this reason.

## Library notes (verified via context7, 2026-06-20 — `/elevenlabs/packages`)

- **Client tools** register through `startSession({ clientTools: { name: async (args) => {...} } })` — matches the codebase (`useAdmirerAgent.connect`). No change needed.
- **Contextual updates carry natural-language context and do NOT, by themselves, force the agent to speak.** ElevenLabs folds a contextual update into the agent's *next* response; it is not a turn trigger. Two consequences for the score-led companion: (1) send readable prose, not JSON — hence the `attunementReactions.js` helper in **Task 5b**; (2) whether the companion actually *speaks* a reaction on cue must be verified on device. Primary path: `sendContextualUpdate(prose)`. Documented fallback if it stays silent: prompt a short spoken turn via `sendUserMessage(...)` (already exposed by `useAdmirerAgent`) or author per-movement lines server-side. Flagged in **Task 11** + the on-device checklist.
- **SDK surface:** the installed code uses the single `useConversation()` hook under a `ConversationProvider`. Current docs also show a split `useConversationControls()` / `useConversationStatus()` API; both ship in `@elevenlabs/react`. **Keep the working single-hook usage — do not migrate as part of this work.**

## File structure (decomposition)

**New pure-logic libs** (`src/lib/`, tests in `src/lib/__tests__/`):
- `equalPower.js` — `equalPowerGains(balance)` constant-power crossfade gains (Lean texture pair, Face ring).
- `archetypeRing.js` — spatialize the 6 archetype centroids into a frontal azimuth ring; `nearestArchetypeToYaw`; `archetypeAnchorVector`; `preloadDecision`.
- `attunementToAvd.js` — per-movement raw-input → AVD target (`leanLiftTarget`, `riseTarget`, `riseHedonic`, `dwellConfidence`).
- `attunementMovements.js` — the six-beat movement definitions + sequence helpers (`getMovement`, `firstMovementId`, `nextMovementId`).
- `attunementReducer.js` — pure sequence reducer (`initialState`, `reduce`).
- `attunementReactions.js` — pure: `phraseReaction(movementId, payload)` → the natural-language context string sent to the companion voice (Task 5b).

**Audio** (`src/orchestra/`):
- Extend `AdmirerRoom.js` with multi-source methods: `playTexturePair`, `playRingSources`, `playRiseBed`.

**React** (`src/`):
- `src/hooks/useAttunementScore.js` — thin glue: gesture sampling + dwell timing + AVD writes, driving `attunementReducer`.
- `src/phases/attunement/LeanLift.jsx`, `Listen.jsx`, `Rise.jsx`, `Face.jsx` — movement overlays.
- Rewrite `src/phases/Admirer.jsx` to host the score (keeps the seams: silent preload, `revealAudioRef`, `avdRecorder`, `onCommitEntry`).

**Agent** (`scripts/`):
- `create-admirer-agent.js` / `update-admirer-agent.js` — companion-voice prompt; drop pacing tools.

---

## Milestone 1 — Pure foundation: math & mappings

### Task 1: Equal-power crossfade gains

**Files:**
- Create: `src/lib/equalPower.js`
- Test: `src/lib/__tests__/equalPower.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { equalPowerGains } from '../equalPower.js'

describe('equalPowerGains', () => {
  it('full-left balance = -1 → all left', () => {
    const g = equalPowerGains(-1)
    expect(g.left).toBeCloseTo(1, 6)
    expect(g.right).toBeCloseTo(0, 6)
  })
  it('full-right balance = +1 → all right', () => {
    const g = equalPowerGains(1)
    expect(g.left).toBeCloseTo(0, 6)
    expect(g.right).toBeCloseTo(1, 6)
  })
  it('center balance = 0 → equal power (~0.707 each)', () => {
    const g = equalPowerGains(0)
    expect(g.left).toBeCloseTo(Math.SQRT1_2, 6)
    expect(g.right).toBeCloseTo(Math.SQRT1_2, 6)
  })
  it('power sums to 1 across the sweep', () => {
    for (const b of [-1, -0.5, 0, 0.3, 1]) {
      const g = equalPowerGains(b)
      expect(g.left ** 2 + g.right ** 2).toBeCloseTo(1, 6)
    }
  })
  it('clamps out-of-range balance', () => {
    expect(equalPowerGains(-5).left).toBeCloseTo(1, 6)
    expect(equalPowerGains(5).right).toBeCloseTo(1, 6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/equalPower.test.js`
Expected: FAIL — "Failed to resolve import '../equalPower.js'".

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/equalPower.js
// Constant-power crossfade: as balance sweeps [-1,1], left²+right²=1 so the
// perceived loudness stays flat. Used by the Lean texture pair and the Face
// ring spotlight. Pure — unit-tested.
export function equalPowerGains(balance) {
  const b = Math.max(-1, Math.min(1, balance))
  const t = (b + 1) / 2 // 0..1
  return {
    left: Math.cos((t * Math.PI) / 2),
    right: Math.sin((t * Math.PI) / 2),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/equalPower.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/equalPower.js src/lib/__tests__/equalPower.test.js
git commit -m "feat(attunement): equal-power crossfade gains"
```

### Task 2: The archetype ring (Face movement) + speculative-preload decision

**Files:**
- Create: `src/lib/archetypeRing.js`
- Test: `src/lib/__tests__/archetypeRing.test.js`

Reuses `ARCHETYPE_CENTROIDS` + `selectArchetypeByAvd` from `src/lib/avdToStems.js` (already: `{ id, anchor: [a,v,d] }`).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import {
  archetypeRing, nearestArchetypeToYaw, archetypeAnchorVector, preloadDecision,
} from '../archetypeRing.js'
import { ARCHETYPES } from '../archetypes.js'

describe('archetypeRing', () => {
  const ring = archetypeRing()

  it('places every archetype once, spread across the frontal arc', () => {
    expect(ring.length).toBe(ARCHETYPES.length)
    const az = ring.map((r) => r.azimuthDeg)
    expect(Math.min(...az)).toBeCloseTo(-75, 6)
    expect(Math.max(...az)).toBeCloseTo(75, 6)
    expect(new Set(ring.map((r) => r.id)).size).toBe(ARCHETYPES.length)
  })

  it('orders cold→warm left→right (valence ascending with azimuth)', () => {
    const sorted = [...ring].sort((a, b) => a.azimuthDeg - b.azimuthDeg)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].anchor[1]).toBeGreaterThanOrEqual(sorted[i - 1].anchor[1])
    }
  })

  it('nearestArchetypeToYaw returns the closest world to where you face', () => {
    const left = [...ring].sort((a, b) => a.azimuthDeg - b.azimuthDeg)[0]
    const right = [...ring].sort((a, b) => b.azimuthDeg - a.azimuthDeg)[0]
    expect(nearestArchetypeToYaw(-75, ring)).toBe(left.id)
    expect(nearestArchetypeToYaw(75, ring)).toBe(right.id)
  })

  it('archetypeAnchorVector returns the signed centroid as {a,v,d}', () => {
    const sky = archetypeAnchorVector('sky-seeker')
    expect(sky).toMatchObject({ a: expect.any(Number), v: expect.any(Number), d: expect.any(Number) })
    expect(sky.v).toBeCloseTo(0.5, 6)
  })
})

describe('preloadDecision', () => {
  it('picks the nearest archetype and reports no change when stable', () => {
    const first = preloadDecision(null, { a: 0.9, v: 0.9, d: 0.9 })
    expect(first.archetypeId).toBe('sky-seeker')
    expect(first.changed).toBe(true) // null → something is a change
    const again = preloadDecision('sky-seeker', { a: 0.9, v: 0.9, d: 0.9 })
    expect(again).toEqual({ archetypeId: 'sky-seeker', changed: false })
  })
  it('reports a change when the vector moves to a new nearest archetype', () => {
    const d = preloadDecision('sky-seeker', { a: 0.6, v: -0.6, d: 0.1 })
    expect(d.archetypeId).toBe('quiet-insurgent')
    expect(d.changed).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/archetypeRing.test.js`
Expected: FAIL — import not resolved.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/archetypeRing.js
// The Face movement: the six archetype centroids placed as a frontal ring the
// listener turns to face. Cold (low valence) on the left, warm on the right —
// consistent with the Lean mockup. nearestArchetypeToYaw maps the user's
// facing direction to a world; preloadDecision drives the speculative
// StemPlayer load during Rise. Pure — unit-tested.

import { ARCHETYPE_CENTROIDS, selectArchetypeByAvd } from './avdToStems.js'

const RING_HALF_WIDTH_DEG = 75 // matches MAX_AZIMUTH_OFFSET_DEG in AdmirerRoom

// [{ id, anchor:[a,v,d], azimuthDeg }] sorted cold→warm, spread -75..+75.
export function archetypeRing() {
  const byValence = [...ARCHETYPE_CENTROIDS].sort((a, b) => a.anchor[1] - b.anchor[1])
  const n = byValence.length
  const span = RING_HALF_WIDTH_DEG * 2
  return byValence.map((c, i) => ({
    id: c.id,
    anchor: c.anchor,
    azimuthDeg: n === 1 ? 0 : -RING_HALF_WIDTH_DEG + (span * i) / (n - 1),
  }))
}

// Archetype whose ring azimuth is nearest the (baseline-relative) facing yaw.
export function nearestArchetypeToYaw(relYawDeg, ring = archetypeRing()) {
  let best = ring[0]
  let bestDist = Infinity
  for (const r of ring) {
    const d = Math.abs(r.azimuthDeg - relYawDeg)
    if (d < bestDist) { best = r; bestDist = d }
  }
  return best.id
}

// Signed centroid {a,v,d} for an archetype id — used to snap the AVD vector
// toward the faced world on commit.
export function archetypeAnchorVector(id) {
  const c = ARCHETYPE_CENTROIDS.find((x) => x.id === id) || ARCHETYPE_CENTROIDS[0]
  return { a: c.anchor[0], v: c.anchor[1], d: c.anchor[2] }
}

// Should the speculative pre-load change archetype? `prev` is the currently
// loading/loaded archetype id (or null). Returns the nearest archetype to the
// in-progress vector and whether it differs from prev.
export function preloadDecision(prev, vector, { restricted = [] } = {}) {
  const archetypeId = selectArchetypeByAvd(vector, { restricted })
  return { archetypeId, changed: archetypeId !== prev }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/archetypeRing.test.js`
Expected: PASS.

> Note: the test asserts `sky-seeker` for high A/V/D and `quiet-insurgent` for high-A/low-V — these match the existing `avdToStems.test.js` expectations, so the centroid geometry is already proven.

- [ ] **Step 5: Commit**

```bash
git add src/lib/archetypeRing.js src/lib/__tests__/archetypeRing.test.js
git commit -m "feat(attunement): archetype ring + speculative-preload decision"
```

### Task 3: Per-movement input → AVD targets

**Files:**
- Create: `src/lib/attunementToAvd.js`
- Test: `src/lib/__tests__/attunementToAvd.test.js`

`pan` and `filterNorm` are the existing GestureCore `read()` outputs (0..1; roll and pitch normalized). `gestureGain` is 0..1.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import {
  leanLiftTarget, riseTarget, riseHedonic, dwellConfidence,
} from '../attunementToAvd.js'

const CUR = { a: 0.3, v: -0.1, d: 0.2 }

describe('leanLiftTarget', () => {
  it('leaning right (pan→1) targets high valence; center pan→0 valence', () => {
    expect(leanLiftTarget(1, 0.5, CUR).v).toBeCloseTo(1, 6)
    expect(leanLiftTarget(0.5, 0.5, CUR).v).toBeCloseTo(0, 6)
    expect(leanLiftTarget(0, 0.5, CUR).v).toBeCloseTo(-1, 6)
  })
  it('tilting back (filterNorm→1) targets high depth', () => {
    expect(leanLiftTarget(0.5, 1, CUR).d).toBeCloseTo(1, 6)
    expect(leanLiftTarget(0.5, 0, CUR).d).toBeCloseTo(-1, 6)
  })
  it('leaves arousal at the current value (unprobed axis must not drift)', () => {
    expect(leanLiftTarget(1, 1, CUR).a).toBe(CUR.a)
  })
})

describe('riseTarget', () => {
  it('a big swell targets high arousal', () => {
    expect(riseTarget(1, true, CUR).a).toBeCloseTo(1, 6)
  })
  it('a small swell targets low arousal', () => {
    expect(riseTarget(0, true, CUR).a).toBeCloseTo(-1, 6)
  })
  it('pulling back from the peak lowers arousal and nudges valence down', () => {
    const rode = riseTarget(0.8, true, CUR)
    const held = riseTarget(0.8, false, CUR)
    expect(held.a).toBeLessThan(rode.a)
    expect(held.v).toBeLessThan(rode.v)
  })
  it('leaves depth at the current value', () => {
    expect(riseTarget(0.8, true, CUR).d).toBe(CUR.d)
  })
})

describe('riseHedonic', () => {
  it('passes through the ride/pull-back boolean', () => {
    expect(riseHedonic(true)).toBe(true)
    expect(riseHedonic(false)).toBe(false)
  })
})

describe('dwellConfidence', () => {
  it('a decisive hold (0.4–2s) is full confidence', () => {
    expect(dwellConfidence(400)).toBeCloseTo(1, 6)
    expect(dwellConfidence(1200)).toBeCloseTo(1, 6)
    expect(dwellConfidence(2000)).toBeCloseTo(1, 6)
  })
  it('an instant flick is low confidence', () => {
    expect(dwellConfidence(0)).toBeLessThan(0.5)
  })
  it('an agonized hold (>2s) is discounted, floored at 0.7', () => {
    expect(dwellConfidence(5000)).toBeCloseTo(0.7, 6)
    expect(dwellConfidence(2500)).toBeLessThan(1)
    expect(dwellConfidence(2500)).toBeGreaterThanOrEqual(0.7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/attunementToAvd.test.js`
Expected: FAIL — import not resolved.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/attunementToAvd.js
// Maps each move-movement's raw gesture input to a signed AVD *target* for
// commitTurn(). Each helper takes the current vector and leaves the axes it
// does not probe untouched (commitTurn EWMA-steps every axis, so unprobed
// axes must target their current value). Pure — unit-tested.

function clampSigned(x) { return Math.max(-1, Math.min(1, x)) }

// Lean (roll → Valence) + Lift (pitch → Depth). pan/filterNorm are 0..1.
export function leanLiftTarget(pan, filterNorm, current) {
  return {
    a: current.a,                              // unprobed — hold
    v: clampSigned((pan - 0.5) * 2),           // left→-1 cold, right→+1 warm
    d: clampSigned((filterNorm - 0.5) * 2),    // forward→-1 open, back→+1 inward
  }
}

// Rise (swell size + ride/pull-back → Arousal, + hedonic). peakSwell 0..1.
export function riseTarget(peakSwell, rodeClimax, current) {
  let a = peakSwell * 2 - 1
  let v = current.v
  if (!rodeClimax) { a -= 0.3; v -= 0.15 }     // rejected the peak
  return { a: clampSigned(a), v: clampSigned(v), d: current.d }
}

export function riseHedonic(rodeClimax) { return !!rodeClimax }

// Confidence from how long the user held a lean before committing. Instant
// flicks and agonized holds are both discounted; a decisive 0.4–2s hold is
// full confidence. Mirrors Spectrum's dwell weighting.
export function dwellConfidence(dwellMs) {
  if (dwellMs < 400) return Math.max(0, dwellMs / 400) * 0.9 + 0.1 * (dwellMs > 0 ? 1 : 0)
  if (dwellMs <= 2000) return 1
  return Math.max(0.7, 1 - (dwellMs - 2000) / 6000)
}
```

> The `dwellConfidence(0)` branch returns `0` (`< 0.5` ✓); `dwellConfidence(400)`=1 ✓; `dwellConfidence(5000)` = max(0.7, 1-0.5)=0.7 ✓.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/attunementToAvd.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attunementToAvd.js src/lib/__tests__/attunementToAvd.test.js
git commit -m "feat(attunement): per-movement input→AVD target mappings"
```

---

## Milestone 2 — The score: movement definitions & sequence reducer

### Task 4: Movement definitions + sequence helpers

**Files:**
- Create: `src/lib/attunementMovements.js`
- Test: `src/lib/__tests__/attunementMovements.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import {
  MOVEMENTS, MOVEMENT_ORDER, getMovement, firstMovementId, nextMovementId,
} from '../attunementMovements.js'

describe('attunementMovements', () => {
  it('is the six-beat arc in order', () => {
    expect(MOVEMENT_ORDER).toEqual(['arrival', 'leanLift', 'listen', 'rise', 'face', 'bloom'])
  })
  it('each movement carries a kind and a monotonic expansion target', () => {
    let prev = -1
    for (const id of MOVEMENT_ORDER) {
      const m = getMovement(id)
      expect(m.kind).toBeTruthy()
      expect(m.expansionTo).toBeGreaterThanOrEqual(prev)
      prev = m.expansionTo
    }
    expect(getMovement('bloom').expansionTo).toBe(1)
  })
  it('the move movements declare the signals they read', () => {
    expect(getMovement('leanLift').signals).toEqual(['pan', 'filterNorm'])
    expect(getMovement('rise').signals).toEqual(['gestureGain', 'downbeat'])
    expect(getMovement('face').signals).toEqual(['yaw'])
  })
  it('firstMovementId is arrival; nextMovementId walks then returns null', () => {
    expect(firstMovementId()).toBe('arrival')
    expect(nextMovementId('arrival')).toBe('leanLift')
    expect(nextMovementId('face')).toBe('bloom')
    expect(nextMovementId('bloom')).toBe(null)
  })
  it('getMovement returns null for an unknown id', () => {
    expect(getMovement('nope')).toBe(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/attunementMovements.test.js`
Expected: FAIL — import not resolved.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/attunementMovements.js
// The Attunement Room's six-beat arc as data. Wording/visual copy lives in the
// movement components; this is the *structure* the choreographer sequences:
// kind, the gesture signals each move-movement reads, the AVD axes it probes,
// the commit gain, and the room-expansion target reached when it commits.
// Pure data + selectors — unit-tested. (See spec §5.)

export const MOVEMENTS = [
  { id: 'arrival',  kind: 'talk',    expansionTo: 0.0 },
  { id: 'leanLift', kind: 'move',    signals: ['pan', 'filterNorm'], probes: ['v', 'd'], gain: 0.8, expansionTo: 0.2 },
  { id: 'listen',   kind: 'tap',     expansionTo: 0.35 },
  { id: 'rise',     kind: 'move',    signals: ['gestureGain', 'downbeat'], probes: ['a'], gain: 0.9, expansionTo: 0.6 },
  { id: 'face',     kind: 'move',    signals: ['yaw'], probes: ['v', 'd'], gain: 1.0, expansionTo: 0.85 },
  { id: 'bloom',    kind: 'handoff', expansionTo: 1.0 },
]

export const MOVEMENT_ORDER = MOVEMENTS.map((m) => m.id)

export function getMovement(id) {
  return MOVEMENTS.find((m) => m.id === id) || null
}

export function firstMovementId() {
  return MOVEMENT_ORDER[0]
}

export function nextMovementId(id) {
  const i = MOVEMENT_ORDER.indexOf(id)
  if (i < 0 || i >= MOVEMENT_ORDER.length - 1) return null
  return MOVEMENT_ORDER[i + 1]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/attunementMovements.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attunementMovements.js src/lib/__tests__/attunementMovements.test.js
git commit -m "feat(attunement): six-beat movement definitions + sequence helpers"
```

### Task 5: The sequence reducer

**Files:**
- Create: `src/lib/attunementReducer.js`
- Test: `src/lib/__tests__/attunementReducer.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { initialState, reduce } from '../attunementReducer.js'

describe('attunementReducer', () => {
  it('starts active on the first movement', () => {
    const s = initialState()
    expect(s).toEqual({ movementId: 'arrival', status: 'active' })
  })
  it('COMMIT marks the current movement committed', () => {
    const s = reduce(initialState(), { type: 'COMMIT' })
    expect(s).toEqual({ movementId: 'arrival', status: 'committed' })
  })
  it('ADVANCE moves to the next movement, active again', () => {
    const s = reduce({ movementId: 'arrival', status: 'committed' }, { type: 'ADVANCE' })
    expect(s).toEqual({ movementId: 'leanLift', status: 'active' })
  })
  it('ADVANCE past the last movement enters the done state', () => {
    const s = reduce({ movementId: 'bloom', status: 'committed' }, { type: 'ADVANCE' })
    expect(s).toEqual({ movementId: 'bloom', status: 'done' })
  })
  it('ignores unknown actions', () => {
    const s = initialState()
    expect(reduce(s, { type: 'NOPE' })).toBe(s)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/attunementReducer.test.js`
Expected: FAIL — import not resolved.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/attunementReducer.js
// Pure sequence state machine for the Attunement Room. The hook
// (useAttunementScore) decides *when* to dispatch COMMIT/ADVANCE from gesture
// + timer input; this module owns *what the state becomes*. Unit-tested.

import { firstMovementId, nextMovementId } from './attunementMovements.js'

export function initialState() {
  return { movementId: firstMovementId(), status: 'active' }
}

export function reduce(state, action) {
  switch (action.type) {
    case 'COMMIT':
      return { ...state, status: 'committed' }
    case 'ADVANCE': {
      const next = nextMovementId(state.movementId)
      if (next === null) return { ...state, status: 'done' }
      return { movementId: next, status: 'active' }
    }
    default:
      return state
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/attunementReducer.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite + commit**

Run: `npm test`
Expected: all green (existing + the 5 new files).

```bash
git add src/lib/attunementReducer.js src/lib/__tests__/attunementReducer.test.js
git commit -m "feat(attunement): pure sequence reducer"
```

### Task 5b: Reaction phrasing for the companion voice (pure)

**Files:**
- Create: `src/lib/attunementReactions.js`
- Test: `src/lib/__tests__/attunementReactions.test.js`

Per the context7 note: contextual updates must be readable prose, not JSON. This pure helper turns a movement's structured commit payload into the one-line context string the host sends via `sendContextualUpdate`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { phraseReaction } from '../attunementReactions.js'

describe('phraseReaction', () => {
  it('lean warm + inward', () => {
    const s = phraseReaction('leanLift', { valence: 0.6, depth: 0.4 })
    expect(s).toMatch(/warm/i)
    expect(s).toMatch(/inward/i)
  })
  it('lean cool + open', () => {
    const s = phraseReaction('leanLift', { valence: -0.6, depth: -0.4 })
    expect(s).toMatch(/cool|austere/i)
    expect(s).toMatch(/open/i)
  })
  it('rise — rode the climax', () => {
    expect(phraseReaction('rise', { arousal: 0.8, hedonic: true })).toMatch(/rode|climax/i)
  })
  it('rise — held back', () => {
    expect(phraseReaction('rise', { arousal: 0.2, hedonic: false })).toMatch(/held back|back/i)
  })
  it('rise — a marked beat', () => {
    expect(phraseReaction('rise', { downbeat: true, intensity: 0.7 })).toMatch(/beat/i)
  })
  it('face — names the world', () => {
    expect(phraseReaction('face', { archetypeId: 'hearth-keeper' })).toMatch(/hearth-keeper/)
  })
  it('unknown / empty payload → empty string (nothing to say)', () => {
    expect(phraseReaction('arrival', {})).toBe('')
    expect(phraseReaction('face', {})).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/attunementReactions.test.js`
Expected: FAIL — import not resolved.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/attunementReactions.js
// Turns a movement's commit payload into a short natural-language context line
// for the companion voice. ElevenLabs contextual updates take readable prose
// (not JSON) and inform the agent's next response. Pure — unit-tested.
export function phraseReaction(movementId, payload = {}) {
  switch (movementId) {
    case 'leanLift': {
      if (typeof payload.valence !== 'number') return ''
      const warm = payload.valence >= 0 ? 'warm' : 'cool and austere'
      const depth = payload.depth >= 0 ? 'inward' : 'open'
      return `The listener leaned ${warm} and ${depth}.`
    }
    case 'rise':
      if (payload.downbeat) return `The listener marked the beat.`
      if (typeof payload.hedonic !== 'boolean') return ''
      return payload.hedonic
        ? `The listener rode the climax.`
        : `The listener held back from the climax.`
    case 'face':
      return payload.archetypeId
        ? `The listener turned to face the ${payload.archetypeId} world.`
        : ''
    default:
      return ''
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/attunementReactions.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/attunementReactions.js src/lib/__tests__/attunementReactions.test.js
git commit -m "feat(attunement): natural-language reaction phrasing for companion voice"
```

---

## Milestone 3 — Spatial audio: multi-source room methods

### Task 6: Extend AdmirerRoom with positioned multi-source playback

**Files:**
- Modify: `src/orchestra/AdmirerRoom.js` (add methods inside the class; reuse the existing panner/`sphericalToCartesian`/`directBus`/`reverbBus` patterns and the new `equalPowerGains`)

These generalize the existing `playFootsteps()` pattern (a positioned BufferSource → gain → HRTF panner → directBus + reverbBus, fire-and-forget) into three controllable handles. They are additive — the voice path, `setExpansion`, `beginExpansion`, and `playFootsteps` are untouched.

- [ ] **Step 1: Add the import**

At the top of `src/orchestra/AdmirerRoom.js`, alongside the existing imports:

```js
import { equalPowerGains } from '../lib/equalPower.js'
```

- [ ] **Step 2: Add `playTexturePair` (Lean) inside the class**

Insert after `playFootsteps()` (before `setExpansion`):

```js
  // Lean movement: two looping textures at fixed L/R azimuths. Returns a
  // handle whose setBalance(b∈[-1,1]) constant-power cross-fades them by the
  // phone's roll. Both feed directBus + reverbBus so the room shapes them.
  playTexturePair(leftBuffer, rightBuffer) {
    if (this._disposed || !this.ctx || !leftBuffer || !rightBuffer) return null
    const ctx = this.ctx
    const make = (buffer, azimuthDeg, initGain) => {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      const gain = ctx.createGain()
      gain.channelCount = 1
      gain.channelCountMode = 'explicit'
      gain.gain.value = initGain
      const panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1
      panner.maxDistance = 20
      panner.rolloffFactor = 1
      const p = sphericalToCartesian(azimuthDeg, 0, 1.8)
      panner.positionX.value = p.x
      panner.positionY.value = p.y
      panner.positionZ.value = p.z
      src.connect(gain)
      gain.connect(panner)
      panner.connect(this.directBus)
      panner.connect(this.reverbBus)
      src.start(ctx.currentTime)
      return { src, gain, panner }
    }
    const init = equalPowerGains(0)
    const left = make(leftBuffer, -60, init.left)
    const right = make(rightBuffer, 60, init.right)
    return {
      setBalance: (b) => {
        if (this._disposed) return
        const g = equalPowerGains(b)
        const now = ctx.currentTime
        left.gain.gain.setTargetAtTime(g.left, now, 0.05)
        right.gain.gain.setTargetAtTime(g.right, now, 0.05)
      },
      stop: () => {
        for (const n of [left, right]) {
          try { n.src.stop() } catch { /* ignore */ }
          try { n.src.disconnect(); n.gain.disconnect(); n.panner.disconnect() } catch { /* ignore */ }
        }
      },
    }
  }
```

- [ ] **Step 3: Add `playRingSources` (Face) inside the class**

```js
  // Face movement: N looping sources arranged at given azimuths (the archetype
  // ring). spotlight(yawDeg) raises the source nearest the facing direction
  // and dips the rest via constant-power weighting on angular proximity.
  playRingSources(entries) {
    if (this._disposed || !this.ctx || !entries?.length) return null
    const ctx = this.ctx
    const nodes = entries.map(({ buffer, azimuthDeg }) => {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      const gain = ctx.createGain()
      gain.gain.value = 0.25
      const panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1
      panner.maxDistance = 20
      panner.rolloffFactor = 1
      const p = sphericalToCartesian(azimuthDeg, 0, 2.4)
      panner.positionX.value = p.x
      panner.positionY.value = p.y
      panner.positionZ.value = p.z
      src.connect(gain)
      gain.connect(panner)
      panner.connect(this.directBus)
      panner.connect(this.reverbBus)
      src.start(ctx.currentTime)
      return { src, gain, panner, azimuthDeg }
    })
    return {
      spotlight: (yawDeg) => {
        if (this._disposed) return
        const now = ctx.currentTime
        for (const n of nodes) {
          // 1 when facing it, →0.18 at 90° away.
          const prox = Math.max(0, 1 - Math.abs(n.azimuthDeg - yawDeg) / 90)
          n.gain.gain.setTargetAtTime(0.18 + 0.62 * prox, now, 0.08)
        }
      },
      stop: () => {
        for (const n of nodes) {
          try { n.src.stop() } catch { /* ignore */ }
          try { n.src.disconnect(); n.gain.disconnect(); n.panner.disconnect() } catch { /* ignore */ }
        }
      },
    }
  }
```

- [ ] **Step 4: Add `playRiseBed` (Rise) inside the class**

```js
  // Rise movement: one looping build whose gain follows the conducting gesture
  // size (setSwell), plus markBeat() — a short percussive transient on the
  // down-stroke. Seated front-center.
  playRiseBed(buffer) {
    if (this._disposed || !this.ctx || !buffer) return null
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0.2
    const panner = ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = 1
    panner.maxDistance = 20
    panner.rolloffFactor = 1
    const p = sphericalToCartesian(0, 5, 1.8)
    panner.positionX.value = p.x
    panner.positionY.value = p.y
    panner.positionZ.value = p.z
    src.connect(gain)
    gain.connect(panner)
    panner.connect(this.directBus)
    panner.connect(this.reverbBus)
    src.start(ctx.currentTime)
    return {
      setSwell: (g) => {
        if (this._disposed) return
        gain.gain.setTargetAtTime(0.15 + 0.85 * Math.max(0, Math.min(1, g)), ctx.currentTime, 0.12)
      },
      markBeat: (intensity = 1) => {
        if (this._disposed) return
        const now = ctx.currentTime
        const noise = ctx.createBufferSource()
        const len = Math.floor(ctx.sampleRate * 0.08)
        const buf = ctx.createBuffer(1, len, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
        noise.buffer = buf
        const ng = ctx.createGain()
        ng.gain.value = 0.4 * Math.max(0, Math.min(1, intensity))
        noise.connect(ng)
        ng.connect(panner)
        noise.start(now)
        noise.addEventListener('ended', () => {
          try { noise.disconnect(); ng.disconnect() } catch { /* ignore */ }
        }, { once: true })
      },
      stop: () => {
        try { src.stop() } catch { /* ignore */ }
        try { src.disconnect(); gain.disconnect(); panner.disconnect() } catch { /* ignore */ }
      },
    }
  }
```

- [ ] **Step 5: Verify build + lint**

Run: `npm run build`
Expected: build succeeds.
Run: `npm run lint src/orchestra/AdmirerRoom.js`
Expected: no *new* errors attributable to these additions (the `Math.random()` in `markBeat` is runtime audio jitter — acceptable; it is not in a pure/tested module).

- [ ] **Step 6: Commit**

```bash
git add src/orchestra/AdmirerRoom.js
git commit -m "feat(attunement): multi-source room methods (texture pair, ring, rise bed)"
```

---

## Milestone 4 — The choreographer hook + movement components

> These tasks are React + Web Audio + DeviceOrientation glue. They cannot run in jsdom, so verification is `npm run build` + an on-device checklist at the end of Milestone 5. The pure logic they call is already tested (M1–M2).

### Task 7: The choreographer hook

**Files:**
- Create: `src/hooks/useAttunementScore.js`

Drives `attunementReducer` from gesture input. Owns: per-movement gesture sampling (via `usePhoneMotion`), dwell timing, the AVD writes (`commitTurn`/`setAvd`), room-expansion advance, the speculative pre-load trigger at *Rise*, and a `bloom` callback at *Face* commit. Returns state + imperative commit/advance handlers the movement components call.

- [ ] **Step 1: Implement the hook**

```jsx
// src/hooks/useAttunementScore.js
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { initialState, reduce } from '../lib/attunementReducer.js'
import { getMovement } from '../lib/attunementMovements.js'
import { usePhoneMotion } from './usePhoneMotion.js'
import { getAvd, commitTurn, setAvd } from '../lib/avdStore.js'
import { leanLiftTarget, riseTarget, riseHedonic, dwellConfidence } from '../lib/attunementToAvd.js'
import { archetypeRing, nearestArchetypeToYaw, archetypeAnchorVector, preloadDecision } from '../lib/archetypeRing.js'

// Score-led: the client owns pacing. The hook reads the phone each frame for
// the active move-movement, writes taste on commit, advances the room
// expansion, and fires onBloom when Face commits. onExpansion(t) lets the host
// open the AdmirerRoom; onSpeculativePreload(archetypeId) starts the silent
// StemPlayer load during Rise; onReact(movementId, payload) feeds the
// companion voice a contextual update.
export function useAttunementScore({ onExpansion, onSpeculativePreload, onBloom, onReact } = {}) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState)
  const readMotion = usePhoneMotion()
  const ring = useRef(archetypeRing()).current

  const movement = getMovement(state.movementId)

  // Per-movement transient accumulators (reset on movement entry).
  const enteredAtRef = useRef(0)
  const baselineYawRef = useRef(null)
  const peakSwellRef = useRef(0)
  const rodeClimaxRef = useRef(false)
  const lastPreloadRef = useRef(null)
  const liveRef = useRef({ pan: 0.5, filterNorm: 0.5, relYaw: 0 })

  useEffect(() => {
    enteredAtRef.current = performance.now()
    baselineYawRef.current = null
    peakSwellRef.current = 0
    rodeClimaxRef.current = false
  }, [state.movementId])

  // Sample gestures each frame for the active move-movement.
  useEffect(() => {
    if (!movement || movement.kind !== 'move' || state.status !== 'active') return undefined
    let raf = 0
    let mounted = true
    const tick = () => {
      if (!mounted) return
      const m = readMotion()
      if (movement.id === 'leanLift') {
        liveRef.current.pan = m.pan
        liveRef.current.filterNorm = m.filterNorm
      } else if (movement.id === 'rise') {
        if (m.gestureGain > peakSwellRef.current) peakSwellRef.current = m.gestureGain
        if (m.downbeat?.fired) {
          rodeClimaxRef.current = peakSwellRef.current > 0.5
          onReact?.('rise', { downbeat: true, intensity: m.downbeat.intensity })
        }
        // Speculative pre-load on the in-progress vector, once Rise is underway.
        const dec = preloadDecision(lastPreloadRef.current, getAvd())
        if (dec.changed) {
          lastPreloadRef.current = dec.archetypeId
          onSpeculativePreload?.(dec.archetypeId)
        }
      } else if (movement.id === 'face') {
        if (baselineYawRef.current === null) baselineYawRef.current = m.yaw
        let rel = m.yaw - baselineYawRef.current
        rel = ((rel + 540) % 360) - 180 // wrap to [-180,180]
        liveRef.current.relYaw = rel
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { mounted = false; cancelAnimationFrame(raf) }
  }, [movement, state.status, readMotion, onReact, onSpeculativePreload])

  // Commit the active movement: write taste, advance expansion, react, advance.
  const commit = useCallback(() => {
    if (!movement || state.status !== 'active') return
    const cur = getAvd()
    const dwellMs = performance.now() - enteredAtRef.current
    if (movement.id === 'leanLift') {
      const target = leanLiftTarget(liveRef.current.pan, liveRef.current.filterNorm, cur)
      commitTurn(target, { gain: movement.gain, confidence: dwellConfidence(dwellMs) })
      onReact?.('leanLift', { valence: target.v, depth: target.d })
    } else if (movement.id === 'rise') {
      const target = riseTarget(peakSwellRef.current, rodeClimaxRef.current, cur)
      commitTurn(target, { gain: movement.gain })
      onReact?.('rise', { arousal: target.a, hedonic: riseHedonic(rodeClimaxRef.current) })
    } else if (movement.id === 'face') {
      const id = nearestArchetypeToYaw(liveRef.current.relYaw, ring)
      setAvd(archetypeAnchorVector(id)) // snap the vector onto the faced world
      onReact?.('face', { archetypeId: id })
    }
    dispatch({ type: 'COMMIT' })
    const m = getMovement(state.movementId)
    if (m) onExpansion?.(m.expansionTo)
  }, [movement, state.status, state.movementId, ring, onReact, onExpansion])

  const advance = useCallback(() => {
    dispatch({ type: 'ADVANCE' })
  }, [])

  // When Face has committed and we advance into Bloom, fire the handoff.
  useEffect(() => {
    if (state.movementId === 'bloom' && state.status === 'active') {
      onExpansion?.(1)
      onBloom?.()
    }
  }, [state.movementId, state.status, onExpansion, onBloom])

  return { state, movement, commit, advance, live: liveRef }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds (no type/JSX errors).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAttunementScore.js
git commit -m "feat(attunement): score choreographer hook"
```

### Task 8: Movement components (overlays)

**Files:**
- Create: `src/phases/attunement/LeanLift.jsx`, `src/phases/attunement/Rise.jsx`, `src/phases/attunement/Face.jsx`, `src/phases/attunement/Listen.jsx`

These render the representational presences over the existing shader ground (`AdmirerScene3D`, mounted by the host) and call `commit`/`advance`. They follow the existing cream-paper token style (`COLORS`, `FONTS` from `../../score/tokens`). Visuals are functional (positioned presences + a tilt/face cue); polish is iterative.

- [ ] **Step 1: LeanLift.jsx**

```jsx
// src/phases/attunement/LeanLift.jsx
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'

// Two presences L/R; the live balance (from the score hook's live ref) tints
// the field. Hold past the dwell threshold to commit. `live` is the hook's
// liveRef; `onCommit` writes taste + advances expansion; `onAdvance` moves on.
const HOLD_MS = 900

export default function LeanLift({ live, onCommit, onAdvance, committed }) {
  const [balance, setBalance] = useState(0)
  const holdStartRef = useRef(null)
  const firedRef = useRef(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const pan = live.current.pan
      const b = (pan - 0.5) * 2
      setBalance(b)
      // Auto-commit when the user holds a clear lean steady.
      if (!firedRef.current && Math.abs(b) > 0.55) {
        if (holdStartRef.current === null) holdStartRef.current = performance.now()
        else if (performance.now() - holdStartRef.current > HOLD_MS) {
          firedRef.current = true
          onCommit()
        }
      } else if (Math.abs(b) <= 0.45) {
        holdStartRef.current = null
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, onCommit])

  // After commit, give the room a beat then advance.
  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1400)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  const warmth = (balance + 1) / 2
  return (
    <div style={overlay}>
      <Presence side="left" active={balance < -0.2} label="austere · cold light" hue="#3fd5f0" />
      <Presence side="right" active={balance > 0.2} label="warm · hearth" hue={COLORS.scoreAmber} />
      <div style={{ ...cue, opacity: committed ? 0 : 0.7 }}>
        tilt toward the one that pulls — tilt forward for light, back for shadow
      </div>
      <motion.div aria-hidden style={tintBase} animate={{ opacity: 0.06 + warmth * 0.10 }} />
    </div>
  )
}

function Presence({ side, active, label, hue }) {
  return (
    <motion.div
      animate={{ scale: active ? 1.12 : 0.92, opacity: active ? 0.95 : 0.6 }}
      transition={{ duration: 0.4 }}
      style={{
        position: 'absolute', top: '50%', [side]: '8%', transform: 'translateY(-50%)',
        textAlign: 'center',
      }}
    >
      <div style={{
        width: 84, height: 84, borderRadius: '50%', margin: '0 auto',
        background: `radial-gradient(circle, ${hue}88, ${hue}11 70%)`,
        boxShadow: `0 0 40px ${hue}55`,
      }} />
      <div style={{ marginTop: 10, fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 12, color: COLORS.inkCreamSecondary }}>{label}</div>
    </motion.div>
  )
}

const overlay = { position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none' }
const cue = { position: 'absolute', top: '14%', left: 0, right: 0, textAlign: 'center', fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 14, color: COLORS.inkCreamSecondary, transition: 'opacity 0.6s' }
const tintBase = { position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 55%, ${COLORS.scoreAmber}, transparent 60%)` }
```

- [ ] **Step 2: Rise.jsx**

```jsx
// src/phases/attunement/Rise.jsx
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'

// A build climbs over RISE_MS. The user swells (gesture size, read in the hook)
// and marks the peak down-stroke; the hook captures peak swell + ride/pull-back
// and writes Arousal on commit. We commit at the end of the build window.
const RISE_MS = 11000

export default function Rise({ onCommit, onAdvance, committed }) {
  const [progress, setProgress] = useState(0)
  const startRef = useRef(performance.now())
  const firedRef = useRef(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const p = Math.min(1, (performance.now() - startRef.current) / RISE_MS)
      setProgress(p)
      if (p >= 1 && !firedRef.current) { firedRef.current = true; onCommit() }
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onCommit])

  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1400)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  return (
    <div style={overlay}>
      <div style={cue}>it&rsquo;s building — give it room. mark the peak when it comes.</div>
      <motion.div
        aria-hidden
        style={{
          position: 'absolute', left: '50%', bottom: '22%', transform: 'translateX(-50%)',
          width: 10, borderRadius: 6, background: COLORS.scoreAmber,
        }}
        animate={{ height: 40 + progress * 220, opacity: 0.5 + progress * 0.5 }}
      />
    </div>
  )
}

const overlay = { position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none' }
const cue = { position: 'absolute', top: '14%', left: 0, right: 0, textAlign: 'center', fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 14, color: COLORS.inkCreamSecondary }
```

- [ ] **Step 3: Face.jsx**

```jsx
// src/phases/attunement/Face.jsx
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS, FONTS } from '../../score/tokens'
import { archetypeRing } from '../../lib/archetypeRing.js'

// Six worlds ringed in front; turn to face one (relYaw, read in the hook).
// Hold facing past HOLD_MS to commit. The faced world brightens.
const HOLD_MS = 1100

export default function Face({ live, onCommit, onAdvance, committed }) {
  const ring = useRef(archetypeRing()).current
  const [relYaw, setRelYaw] = useState(0)
  const holdRef = useRef(null)
  const firedRef = useRef(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const y = live.current.relYaw
      setRelYaw(y)
      if (!firedRef.current) {
        if (holdRef.current === null) holdRef.current = performance.now()
        else if (performance.now() - holdRef.current > HOLD_MS) { firedRef.current = true; onCommit() }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, onCommit])

  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1600)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  return (
    <div style={overlay}>
      <div style={cue}>turn to face the one that feels like home.</div>
      {ring.map((r) => {
        const prox = Math.max(0, 1 - Math.abs(r.azimuthDeg - relYaw) / 60)
        return (
          <motion.div
            key={r.id}
            animate={{ opacity: 0.3 + prox * 0.7, scale: 0.85 + prox * 0.3 }}
            style={{
              position: 'absolute', top: '46%',
              left: `${50 + (r.azimuthDeg / 75) * 40}%`, transform: 'translate(-50%,-50%)',
              width: 56, height: 56, borderRadius: '50%',
              background: `radial-gradient(circle, ${COLORS.scoreAmber}99, transparent 70%)`,
            }}
          />
        )
      })}
    </div>
  )
}

const overlay = { position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none' }
const cue = { position: 'absolute', top: '14%', left: 0, right: 0, textAlign: 'center', fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 14, color: COLORS.inkCreamSecondary }
```

- [ ] **Step 4: Listen.jsx (reuses the fragment-rating UI)**

```jsx
// src/phases/attunement/Listen.jsx
// The still tap beat. Plays N fragments seated in front; the user taps yes/no.
// Reuses FragmentControls (the existing playing-indicator + Yes/No buttons).
// The host supplies playFragment(fragment)->Promise<'yes'|'no'|'none'> and the
// fragment list; this component just sequences a small set and advances.
import { useEffect, useRef, useState } from 'react'
import FragmentControls from '../FragmentControls'

export default function Listen({ fragments, playFragment, onAdvance }) {
  const [playing, setPlaying] = useState(false)
  const [awaiting, setAwaiting] = useState(false)
  const rateRef = useRef(null)
  const idxRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      for (idxRef.current = 0; idxRef.current < fragments.length; idxRef.current++) {
        if (cancelled) return
        setPlaying(true); setAwaiting(false)
        const rating = await playFragment(fragments[idxRef.current], {
          onAwaitRating: () => { setPlaying(false); setAwaiting(true) },
          getRater: (fn) => { rateRef.current = fn },
        })
        void rating
      }
      if (!cancelled) onAdvance()
    }
    run()
    return () => { cancelled = true }
  }, [fragments, playFragment, onAdvance])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <FragmentControls
        fragmentPlaying={playing}
        showButtons={awaiting}
        onRate={(ans) => rateRef.current?.(ans)}
      />
    </div>
  )
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/phases/attunement/
git commit -m "feat(attunement): movement overlay components"
```

---

## Milestone 5 — Host integration: rewrite Admirer.jsx as the score host

### Task 9: Wire the score, movements, room, and seams into Admirer.jsx

**Files:**
- Modify: `src/phases/Admirer.jsx`

The host keeps everything the seam depends on — `resetMoments`/`resetAvd`/`avdRecorder.start` on mount, `onCommitEntry` building + persisting the session record, the silent `StemPlayer` load + `revealAudioRef`, the companion voice — and replaces the agent-driven pacing (`onNextQuestion`/`onPlayFragment` sequencing) with `useAttunementScore` + the movement components. `useAdmirerRoom` is extended so the host can reach the room for the multi-source movements; the simplest path is to have the host own the `AdmirerRoom` ref (the hook already builds it) — expose it.

- [ ] **Step 1: Expose the room from `useAdmirerRoom`**

In `src/hooks/useAdmirerRoom.js`, change the return so the host can drive the new room methods. Replace the final `return useCallback(...)` block with:

```jsx
  const beginExpansion = useCallback(() => {
    if (roomRef.current) roomRef.current.beginExpansion(3500)
  }, [])

  const setExpansion = useCallback((t) => {
    if (roomRef.current) roomRef.current.setExpansion(t)
  }, [])

  const getRoom = useCallback(() => roomRef.current, [])

  return { beginExpansion, setExpansion, getRoom }
```

(Existing callers that did `const beginExpansion = useAdmirerRoom(...)` must update to `const { beginExpansion } = useAdmirerRoom(...)`. The only caller is `Admirer.jsx`, rewritten in this task.)

- [ ] **Step 2: Add the speculative-preload + bloom handoff helpers to the host**

In `src/phases/Admirer.jsx` `AdmirerInner`, keep `onStartGeneration`/`onCommitEntry` but add a score-driven preload that swaps stems when the archetype changes. Add near `onStartGeneration`:

```jsx
  // Speculative silent pre-load during Rise. Loads the nearest archetype's
  // stems silently; if Face later changes the archetype, the host reloads.
  const preloadArchetypeRef = useRef(null)
  const loadStemsSilently = useCallback(async (bundle) => {
    const ctx = getAudioCtx?.()
    if (!ctx) return
    try {
      // Stop a prior speculative player before swapping.
      if (playerRef.current && revealAudioRef?.current === playerRef.current) {
        try { playerRef.current.stop?.() } catch { /* ignore */ }
      }
      const player = await StemPlayer.load(ctx, bundle.stems, bundle.masterUrl)
      player.setVolume(0, 0)
      player.start()
      playerRef.current = player
      stemsBundleRef.current = bundle
      if (revealAudioRef) revealAudioRef.current = player
    } catch (e) {
      console.warn('[attunement] speculative load failed', e)
    }
  }, [getAudioCtx, revealAudioRef])

  const onSpeculativePreload = useCallback((archetypeId) => {
    if (preloadArchetypeRef.current === archetypeId) return
    preloadArchetypeRef.current = archetypeId
    const bundle = mapAvdToStems(getAvd(), { /* era from descriptors if available */ })
    loadStemsSilently(bundle)
  }, [loadStemsSilently])
```

Add the import at the top:

```jsx
import { getAvd, commitTurn, resetAvd } from '../lib/avdStore.js'
import { mapAvdToStems } from '../lib/avdToStems.js'
import { useAttunementScore } from '../hooks/useAttunementScore.js'
import LeanLift from './attunement/LeanLift'
import Rise from './attunement/Rise'
import Face from './attunement/Face'
import Listen from './attunement/Listen'
import { FRAGMENTS } from '../lib/fragmentBank.js'
import { phraseReaction } from '../lib/attunementReactions.js'
```

- [ ] **Step 3: Mount the score and route the bloom into the existing handoff**

Replace the `beginExpansion` wiring. The bloom must: (a) finalize the song (ensure stems loaded for the faced archetype), (b) `beginExpansion()`, (c) build + persist the record, (d) `onNext` to Orchestra — i.e. reuse `onCommitEntry`'s body. Add:

```jsx
  const { beginExpansion, setExpansion, getRoom } = useAdmirerRoom({ getAudioCtx, status })

  const onScoreExpansion = useCallback((t) => { setExpansion(t) }, [setExpansion])

  const onScoreReact = useCallback((movementId, payload) => {
    // Feed the companion voice a natural-language contextual update (Task 5b +
    // the context7 note: contextual updates take prose, not JSON). Empty
    // string = nothing worth saying, so skip the send.
    const prose = phraseReaction(movementId, payload)
    if (!prose) return
    try { sendContextualUpdate?.(prose) } catch { /* voice is optional */ }
  }, [sendContextualUpdate])

  const onBloom = useCallback(() => {
    // Ensure the faced archetype's stems are the loaded ones.
    const bundle = mapAvdToStems(getAvd(), {})
    if (bundle.archetypeId !== stemsBundleRef.current?.archetypeId) {
      loadStemsSilently(bundle)
    }
    fireMoment(1.0, 'startGeneration')
    advanceFormationStage(2)
    beginExpansion()
    // Persist + hand off (mirror onCommitEntry).
    onCommitEntry({ summary: '' })
  }, [beginExpansion, loadStemsSilently, onCommitEntry])

  const score = useAttunementScore({
    onExpansion: onScoreExpansion,
    onSpeculativePreload,
    onBloom,
    onReact: onScoreReact,
  })
```

> `sendContextualUpdate` is already returned by `useAdmirerAgent`; destructure it in the existing `useAdmirerAgent({...})` call.

- [ ] **Step 4: Drive the room's multi-source playback per movement**

Add an effect that starts/stops the right room sources as the movement changes. For the buffers, reuse fragment masters (decoded once) as stand-in textures for the Lean pair / Face ring / Rise bed — assets can be refined later (spec §11 lists the Rise build asset as open).

```jsx
  const roomHandleRef = useRef(null)
  useEffect(() => {
    const room = getRoom()
    const ctx = getAudioCtx?.()
    if (!room || !ctx) return undefined
    let cancelled = false
    // helper to fetch+decode a fragment master URL
    const decode = (url) => fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))

    const start = async () => {
      if (score.movement?.id === 'leanLift') {
        const [l, r] = await Promise.all([
          decode(FRAGMENTS[2].url), // shadow-piano-late (cold)
          decode(FRAGMENTS[0].url), // warm-acoustic-now (warm)
        ])
        if (cancelled) return
        roomHandleRef.current = room.playTexturePair(l, r)
      } else if (score.movement?.id === 'rise') {
        const bed = await decode(FRAGMENTS[4].url) // lifted-cinematic
        if (cancelled) return
        roomHandleRef.current = room.playRiseBed(bed)
      } else if (score.movement?.id === 'face') {
        const ring = await import('../lib/archetypeRing.js').then(m => m.archetypeRing())
        const entries = await Promise.all(ring.map(async (rr, i) => ({
          azimuthDeg: rr.azimuthDeg,
          buffer: await decode(FRAGMENTS[i % FRAGMENTS.length].url),
        })))
        if (cancelled) return
        roomHandleRef.current = room.playRingSources(entries)
      }
    }
    start()
    return () => {
      cancelled = true
      try { roomHandleRef.current?.stop() } catch { /* ignore */ }
      roomHandleRef.current = null
    }
  }, [score.movement?.id, getRoom, getAudioCtx])

  // Drive the active handle from the live gesture each frame.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const h = roomHandleRef.current
      if (h) {
        if (score.movement?.id === 'leanLift' && h.setBalance) h.setBalance((score.live.current.pan - 0.5) * 2)
        if (score.movement?.id === 'face' && h.spotlight) h.spotlight(score.live.current.relYaw)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score.movement?.id, score.live])
```

- [ ] **Step 5: Render the active movement overlay**

Replace the fragment/selection JSX block with a switch on `score.movement.id`. Keep `Paper`, `AdmirerScene3D`, the state label, and `QuestionDisplay`. Inside the main column:

```jsx
        {score.movement?.id === 'leanLift' && (
          <LeanLift live={score.live} committed={score.state.status === 'committed'}
            onCommit={score.commit} onAdvance={score.advance} />
        )}
        {score.movement?.id === 'listen' && (
          <Listen fragments={FRAGMENTS.slice(0, 2)} playFragment={onPlayFragmentForListen} onAdvance={score.advance} />
        )}
        {score.movement?.id === 'rise' && (
          <Rise committed={score.state.status === 'committed'} onCommit={score.commit} onAdvance={score.advance} />
        )}
        {score.movement?.id === 'face' && (
          <Face live={score.live} committed={score.state.status === 'committed'}
            onCommit={score.commit} onAdvance={score.advance} />
        )}
```

Keep `HoldToSpeak` rendered only during `arrival` (the one spoken beat):

```jsx
        {score.movement?.id === 'arrival' && showHoldToSpeak && (
          /* existing HoldToSpeak block */
        )}
```

Provide `onPlayFragmentForListen` as a thin adapter over the existing `onPlayFragment` promise that also surfaces the rating setter (the Listen component calls `getRater`/`onAwaitRating`). Reuse the existing `onPlayFragment` plumbing (`pendingRatingRef`, `finishFragment`, `resolveRating`) — wire `onAwaitRating` into `finishFragment`'s `setAwaitingRating(true)` and `getRater` to `resolveRating`.

- [ ] **Step 6: Advance arrival after the spoken opener**

The `arrival` movement advances when the user finishes their first spoken answer (or after a timeout). Reuse the transcript watcher: when the first `user` line lands, `score.advance()`. Add to the existing transcript effect:

```jsx
      if (score.state.movementId === 'arrival' && line.role === 'user' && !firedU.has(i)) {
        score.advance()
      }
```

- [ ] **Step 7: Remove dead agent-pacing callbacks**

Delete `onNextQuestion` (and its `selectNextSeed`/`getSeed`/`activeSeed` usage) and the agent-driven fragment listening run from the tool callbacks passed to `useAdmirerAgent` — the score now sequences. Keep `onRecordLexicon` (still useful) and `onCommitEntry`. The agent tool set is trimmed in Milestone 6.

- [ ] **Step 8: Build + full test suite**

Run: `npm run build`
Expected: build succeeds.
Run: `npm test`
Expected: all green (pure modules unaffected; no component tests added).
Run: `npm run lint src/phases/Admirer.jsx src/hooks/useAdmirerRoom.js src/hooks/useAttunementScore.js`
Expected: no *new* errors.

- [ ] **Step 9: Commit**

```bash
git add src/phases/Admirer.jsx src/hooks/useAdmirerRoom.js
git commit -m "feat(attunement): score-led host — movements, room, seams"
```

### Task 10: On-device verification (user-run)

- [ ] **Step 1: Run the app on a real phone** (DeviceOrientation can't be synthesized headlessly).

Run: `npm run dev` and open on a phone (or via the QR pairing flow). Walk the arc:

- [ ] Arrival: footsteps play; the opener speaks; one spoken answer advances to Lean&Lift.
- [ ] Lean&Lift: two textures audibly sit L/R; tilting cross-fades them and warms/cools the field; holding a lean commits (haptic) and the room widens a notch.
- [ ] Listen: two fragments seat in front; yes/no taps advance.
- [ ] Rise: a build climbs; a bigger gesture swells it; a down-stroke lands a transient; it commits.
- [ ] Face: six worlds ring you; turning brightens the faced one; holding commits.
- [ ] Bloom: the room opens, the matched song fades up around you, and the Orchestra phase takes over **without an audio gap** (the silent pre-load handed off).
- [ ] Confirm `window.__plArchive.export()` (dev) shows a session record with a populated AVD trajectory + landing archetype/variation.

- [ ] **Step 2: Note any tuning needs** (dwell thresholds, swing ranges, expansion deltas) for a follow-up tuning pass — these are expected per spec §11.

---

## Milestone 6 — The companion voice

### Task 11: Demote the agent to a companion + contextual reactions

**Files:**
- Modify: `scripts/create-admirer-agent.js` (SYSTEM_PROMPT → companion role; drop `nextQuestion`/`playFragment` from TOOLS, keep `recordLexicon`/`commitEntry`; keep `recordAnswer` only for the arrival spoken answer)
- Modify: `scripts/update-admirer-agent.js` is import-driven — no change beyond re-running it
- Modify: `docs/admirer-agent-dashboard.md` (keep the human mirror in sync)

- [ ] **Step 1: Rewrite SYSTEM_PROMPT** to the companion role: the agent greets, narrates each movement when told (via contextual updates of the form `movement:<id> {...}`), reacts briefly to the user's body ("you went warm — I felt that"), and asks exactly one spoken question at arrival. It must NOT attempt to pace the room or call pacing tools.

```js
// scripts/create-admirer-agent.js — SYSTEM_PROMPT (replace the body)
export const SYSTEM_PROMPT = `
You are a companion presence in a room the listener is moving through. You do
NOT control pacing — the room does. You speak briefly and warmly.

At arrival: speak the opening, then ask exactly one question: what's around them
right now. When they answer, classify the texture and call recordAnswer once.

During the room: you will receive contextual updates shaped like
"movement:<id> {json}". For each, say at most one short sentence that reacts to
what they just did (e.g. they leaned warm, they rode the climax, they faced a
world). Never instruct gestures — the room shows them. Never call nextQuestion
or playFragment (they do not exist for you). When you receive
"movement:bloom ...", fall silent — the music takes over.

Call recordLexicon when the listener uses a vivid word for what they love.
Call commitEntry only if asked by the system.
`.trim()
```

- [ ] **Step 2: Trim TOOLS** — remove `nextQuestion` and `playFragment` tool records from the `TOOLS` array (the client no longer exposes them). Keep `recordLexicon`, `recordAnswer`, `commitEntry`. (`startGeneration` is no longer agent-driven — the score picks the song — so remove it too.)

- [ ] **Step 3: Re-run the update script**

Run: `node scripts/update-admirer-agent.js`
Expected: PATCH succeeds; logs the updated prompt + tool split.

- [ ] **Step 4: Update the dashboard mirror** `docs/admirer-agent-dashboard.md` to match (prompt + tool list).

- [ ] **Step 5: On-device check — and verify the contextual-update→speech path.** Per the context7 note, a contextual update informs the agent's next turn but may not *trigger* speech in a push-to-talk, score-led session where the user isn't speaking during movements. On device, confirm the companion: speaks the opener, asks the one arrival question, and **says a one-line reaction** after lean / rise / face, then falls silent at bloom.
  - If reactions stay silent: switch `onScoreReact` from `sendContextualUpdate(prose)` to a turn-triggering path — either `sendUserMessage(prose)` (already exposed by `useAdmirerAgent`; note it appears in the transcript) or enable a server-side "respond to contextual updates" behavior in the agent prompt. This is the exact kind of live-SDK behavior the project already flags as real-device-only; pick the path that sounds right and record it.

- [ ] **Step 6: Commit**

```bash
git add scripts/create-admirer-agent.js docs/admirer-agent-dashboard.md
git commit -m "feat(attunement): demote Admirer to companion voice"
```

---

## Milestone 7 — Update docs & CLAUDE.md

### Task 12: Document the new Act 1

**Files:**
- Modify: `CLAUDE.md` (the Admirer / Act 1 sections → describe the Attunement Room score-led flow, the five-gesture tutorial, the movement modules, the multi-source room methods)
- Modify: the spec's status line to "implemented"

- [ ] **Step 1: Update CLAUDE.md** Act-1 prose to describe: score-led choreography (`useAttunementScore` + `attunementReducer` + `attunementMovements`), the input→AVD mappings (`attunementToAvd`, `archetypeRing`, `equalPower`), the multi-source `AdmirerRoom` methods, the movement components, the companion-voice agent, and that the silent-preload + frame-perfect handoff is preserved.

- [ ] **Step 2: Final gates**

Run: `npm test` → all green.
Run: `npm run build` → clean.
Run: `npm run lint` → no *new* problems vs the ~149 baseline.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-06-20-act1-attunement-room-design.md
git commit -m "docs(attunement): document the Attunement Room Act 1"
```

---

## Self-review (completed during planning)

**Spec coverage:**
- §5 six-beat arc → Tasks 4 (definitions), 7 (choreographer), 8 (components), 9 (host).
- §6 five gestures → roll/pitch (Task 3 leanLift + Task 8 LeanLift), size/downbeat (Task 3 rise + Task 8 Rise), yaw (Task 2 ring + Task 8 Face).
- §7 score-led architecture → Tasks 5/7 (reducer + hook), 5b + 11 (companion voice + reaction phrasing).
- §7.4 spatial audio → Task 6 (multi-source room methods).
- §7.5 hybrid visual → Task 8 (overlays over `AdmirerScene3D` ground).
- §8 taste→song + speculative preload → Tasks 2 (`preloadDecision`), 9 (host preload + swap).
- §9 seamless seam → Task 9 (bloom → `beginExpansion` + reuse `onCommitEntry` + `revealAudioRef` handoff preserved).
- §12 fallbacks → the dwell-based auto-commit works on touch too; on-device task notes the no-motion path. (Touch-drag fallbacks for each movement are an explicit follow-up if device testing shows desktop needs them.)
- §13 testing → pure-logic TDD in M1–M2; build/on-device in M4–M6.

**Placeholder scan:** No "TBD/TODO". The `era` in `mapAvdToStems(getAvd(), {})` is intentionally omitted (defaults to first variation) — a follow-up can thread an era hint from Listen; this is a noted tuning item, not a missing requirement.

**Type consistency:** `commitTurn(target, {gain, confidence})`, `setAvd(partial)`, `getAvd()` match `avdStore.js`. `mapAvdToStems(vector,{restricted,era})`, `selectArchetypeByAvd` match `avdToStems.js`. `equalPowerGains` returns `{left,right}` used consistently. `useAdmirerRoom` now returns `{beginExpansion,setExpansion,getRoom}` and the sole caller (Task 9) is updated. Room handles expose `setBalance`/`spotlight`/`setSwell`/`markBeat`/`stop` consistently between Task 6 (definition) and Task 9 (use).

**Known follow-ups (not blockers):** dedicated Rise build asset; per-movement touch fallbacks; threading an `era` hint; visual polish of the overlays. All are tuning, captured for the on-device pass.

**context7 verification applied (2026-06-20, `/elevenlabs/packages`):** confirmed `startSession({ clientTools })` registration matches the codebase; corrected contextual updates to natural-language prose via the new `phraseReaction` helper (Task 5b); flagged the contextual-update→speech path as on-device verification with a `sendUserMessage` fallback (Task 11 Step 5); kept the single-hook `useConversation()` usage (no migration to the split `useConversationControls`/`useConversationStatus` API).
