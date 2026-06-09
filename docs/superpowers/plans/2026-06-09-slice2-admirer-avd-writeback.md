# Slice 2 — Admirer → AVD Writeback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the Admirer conversation drive the continuous AVD vector (built in Slice 1) by migrating to authored seeds (Option B) on the ElevenLabs Agents platform: the client owns the question deck, the agent re-voices each seed and classifies each answer, and every answer moves the vector → the three-plane visuals respond live.

**Architecture:** Two client tools — `nextQuestion` (blocking; client returns the authored seed) and `recordAnswer` (agent returns a structured texture judgment). Pure modules compute selection + the texture→AVD target; `avdStore.commitTurn` (extended with confidence/gain) applies the step. Song selection stays on the existing `startGeneration` path (AVD→scene routing is Slice 3).

**Tech Stack:** React 19, `@elevenlabs/react` Conversational AI, Vitest. Pure logic in `src/lib/`, tests in `src/lib/__tests__/`.

**Design spec:** `docs/superpowers/specs/2026-06-09-slice2-admirer-avd-writeback-design.md` (read for the full rationale, the seed deck, and the math).

---

## File Structure

**Create (pure + tested):**
- `src/lib/textureToAvd.js` — texture base vectors + `textureToTarget(texture, intensity)` + `blendTarget(observed, intent, alpha)`.
- `src/lib/questionSeeds.js` — the seed deck (data) + `getSeed(id)` + `LOCATE_BUDGET`.
- `src/lib/seedSelection.js` — `selectNextSeed({ vector, askedIds, sessionCount, yearTier, deck })`.
- Tests for each in `src/lib/__tests__/`.

**Modify:**
- `src/lib/avdRuntime.js` — `ewmaStep` gains an optional `factor` (default 1, so Slice 1 tests stay green).
- `src/lib/avdStore.js` — `commitTurn(target, { confidence, gain })`.
- `src/lib/sessionStore.js` — add `getYearTier(now)`.
- `src/lib/admirerTools.js` — add `nextQuestion` + `recordAnswer` tools.
- `src/phases/Admirer.jsx` — host callbacks `onNextQuestion`/`onRecordAnswer`/selection-tap; per-session asked-ids ref; reset `avdStore` on mount; selection-seed tap UI.
- `scripts/create-admirer-agent.js` + `scripts/update-admirer-agent.js` + `docs/admirer-agent-dashboard.md` — agent prompt → re-voicer role + the two tools.

---

## Task A: Texture → AVD math (`textureToAvd.js`)

**Files:** Create `src/lib/textureToAvd.js`, `src/lib/__tests__/textureToAvd.test.js`.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/textureToAvd.test.js
import { describe, it, expect } from 'vitest'
import {
  TEXTURE_BASE,
  READ_TRUST_ALPHA,
  textureToTarget,
  blendTarget,
} from '../textureToAvd.js'

describe('textureToAvd — constants', () => {
  it('has the four spec textures with signed base vectors', () => {
    expect(Object.keys(TEXTURE_BASE).sort()).toEqual(['calm', 'exalted', 'melancholic', 'sharp'])
    expect(TEXTURE_BASE.calm).toEqual({ a: -0.5, v: 0.6, d: 0 })
    expect(TEXTURE_BASE.exalted).toEqual({ a: 0.6, v: 0.6, d: 0.6 })
  })
  it('uses read-trust alpha 0.6', () => {
    expect(READ_TRUST_ALPHA).toBe(0.6)
  })
})

describe('textureToAvd — textureToTarget', () => {
  it('returns the base vector at full intensity', () => {
    expect(textureToTarget('sharp', 1)).toEqual({ a: 0.6, v: -0.5, d: -0.2 })
  })
  it('scales the base vector by intensity', () => {
    const t = textureToTarget('calm', 0.5)
    expect(t).toEqual({ a: -0.25, v: 0.3, d: 0 })
  })
  it('clamps intensity to [0,1]', () => {
    expect(textureToTarget('calm', 5)).toEqual(TEXTURE_BASE.calm)
    expect(textureToTarget('calm', -1)).toEqual({ a: -0, v: 0, d: 0 })
  })
  it('returns neutral for an unknown texture', () => {
    expect(textureToTarget('bogus', 1)).toEqual({ a: 0, v: 0, d: 0 })
  })
})

describe('textureToAvd — blendTarget', () => {
  it('blends observed and intent at alpha (default 0.6)', () => {
    const observed = { a: 1, v: 1, d: 1 }
    const intent = { a: 0, v: 0, d: 0 }
    expect(blendTarget(observed, intent)).toEqual({ a: 0.6, v: 0.6, d: 0.6 })
  })
  it('honors a custom alpha and a nonzero intent', () => {
    const observed = { a: 1, v: 0, d: 0 }
    const intent = { a: -1, v: 0, d: 0 }
    expect(blendTarget(observed, intent, 0.5)).toEqual({ a: 0, v: 0, d: 0 })
  })
  it('defaults intent to neutral when omitted', () => {
    expect(blendTarget({ a: 0.5, v: 0.5, d: 0.5 })).toEqual({ a: 0.3, v: 0.3, d: 0.3 })
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/textureToAvd.test.js` → FAIL (import unresolved).

- [ ] **Step 3: Implement**

```js
// src/lib/textureToAvd.js
// Maps a classified answer texture (Admirer spec §3.3) to a signed AVD target,
// and blends the observed answer with the question's own intent (read-trust
// alpha, spec §3.2). Pure — consumed by Admirer.jsx's onRecordAnswer.

export const TEXTURE_BASE = {
  calm:        { a: -0.5, v: 0.6, d: 0.0 },
  sharp:       { a: 0.6, v: -0.5, d: -0.2 },
  melancholic: { a: -0.4, v: -0.5, d: 0.6 },
  exalted:     { a: 0.6, v: 0.6, d: 0.6 },
}

// Read-trust: weight the observed answer over the question's intent.
export const READ_TRUST_ALPHA = 0.6

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

// Texture + intensity → AVD target. A weaker answer (low intensity) lands
// closer to neutral. Unknown texture → neutral (no movement).
export function textureToTarget(texture, intensity = 1) {
  const base = TEXTURE_BASE[texture]
  if (!base) return { a: 0, v: 0, d: 0 }
  const k = clamp01(intensity)
  return { a: base.a * k, v: base.v * k, d: base.d * k }
}

// direction = alpha·observed + (1-alpha)·intent, per axis (spec §3.2).
export function blendTarget(observed, intent = { a: 0, v: 0, d: 0 }, alpha = READ_TRUST_ALPHA) {
  return {
    a: alpha * observed.a + (1 - alpha) * intent.a,
    v: alpha * observed.v + (1 - alpha) * intent.v,
    d: alpha * observed.d + (1 - alpha) * intent.d,
  }
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lib/__tests__/textureToAvd.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/textureToAvd.js src/lib/__tests__/textureToAvd.test.js
git commit -m "feat(avd): texture→AVD target + read-trust blend"
```

---

## Task B: The seed deck (`questionSeeds.js`)

**Files:** Create `src/lib/questionSeeds.js`, `src/lib/__tests__/questionSeeds.test.js`.

The seed *wording* is editable data (Knih owns it); the test checks structural integrity only, never exact text.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/questionSeeds.test.js
import { describe, it, expect } from 'vitest'
import { SEEDS, getSeed, LOCATE_BUDGET } from '../questionSeeds.js'

const KINDS = ['biography', 'locate', 'selection', 'closing']

describe('questionSeeds — deck integrity', () => {
  it('every seed has id, kind, text, gain, sessionScope, tier', () => {
    for (const s of SEEDS) {
      expect(typeof s.id).toBe('string')
      expect(KINDS).toContain(s.kind)
      expect(typeof s.text).toBe('string')
      expect(typeof s.gain).toBe('number')
      expect(['first', 'always']).toContain(s.sessionScope)
      expect([1, 3]).toContain(s.tier)
    }
  })
  it('ids are unique', () => {
    const ids = SEEDS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('biography seeds are session-1-only with low gain', () => {
    const bio = SEEDS.filter((s) => s.kind === 'biography')
    expect(bio.length).toBeGreaterThanOrEqual(3)
    for (const s of bio) {
      expect(s.sessionScope).toBe('first')
      expect(s.gain).toBeCloseTo(0.3, 5)
    }
  })
  it('locate seeds carry an intent vector and a probes axis or null', () => {
    const locate = SEEDS.filter((s) => s.kind === 'locate')
    expect(locate.length).toBeGreaterThan(0)
    for (const s of locate) {
      expect(s.intent).toMatchObject({ a: expect.any(Number), v: expect.any(Number), d: expect.any(Number) })
      expect([null, 'A', 'V', 'D']).toContain(s.probes ?? null)
    }
  })
  it('selection seeds have labeled options with avd nudges', () => {
    const sel = SEEDS.filter((s) => s.kind === 'selection')
    for (const s of sel) {
      expect(Array.isArray(s.options)).toBe(true)
      for (const o of s.options) {
        expect(typeof o.label).toBe('string')
        expect(o.avd).toMatchObject({ a: expect.any(Number), v: expect.any(Number), d: expect.any(Number) })
      }
    }
  })
  it('exactly one closing seed, with no AVD effect', () => {
    const closing = SEEDS.filter((s) => s.kind === 'closing')
    expect(closing.length).toBe(1)
  })
})

describe('questionSeeds — getSeed + budget', () => {
  it('getSeed returns by id or null', () => {
    expect(getSeed(SEEDS[0].id)).toBe(SEEDS[0])
    expect(getSeed('nope')).toBeNull()
  })
  it('LOCATE_BUDGET is a small positive integer', () => {
    expect(Number.isInteger(LOCATE_BUDGET)).toBe(true)
    expect(LOCATE_BUDGET).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/questionSeeds.test.js` → FAIL.

- [ ] **Step 3: Implement** (wording per the design spec §4; freely editable later)

```js
// src/lib/questionSeeds.js
// The Admirer's authored question deck (Option B). Seeds are DATA: the client
// selects which seed to ask (seedSelection.js) and the agent only re-voices
// the `text`. The poetic core of every locate seed is authored by Knih; the
// biography seeds are the spec's. Wording is freely editable — selection logic
// and tests key off structure (id/kind/probes/gain), never exact text.
//
// Seed shape:
//   id           unique string
//   kind         'biography' | 'locate' | 'selection' | 'closing'
//   text         the authored line the agent re-voices
//   probes       'A' | 'V' | 'D' | null  (axis the answer should resolve)
//   intent       { a, v, d } small directional bias of the question itself
//   gain         step multiplier (locate 0.8; arrival/biography 0.3)
//   sessionScope 'first' (session 1 only) | 'always'
//   tier         1 | 3   (3 = unlocks only at year-tier 3)
//   options      selection seeds only: [{ label, avd: {a,v,d} }]

const N = { a: 0, v: 0, d: 0 }

export const SEEDS = [
  // --- Biography (session 1 only; observe, don't steer) ---
  { id: 'bio-stayed', kind: 'biography', sessionScope: 'first', tier: 1, gain: 0.3, probes: null, intent: N,
    text: 'What is a piece of music that has stayed with you?' },
  { id: 'bio-last', kind: 'biography', sessionScope: 'first', tier: 1, gain: 0.3, probes: null, intent: N,
    text: 'When did you last listen to it on purpose?' },
  { id: 'bio-first', kind: 'biography', sessionScope: 'first', tier: 1, gain: 0.3, probes: null, intent: N,
    text: 'What were you doing when it first found you?' },

  // --- Locate (every session; the instrument's recurring voice) ---
  { id: 'locate-arrival', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.3, probes: null, intent: N,
    text: "What's around you, right now?" },
  { id: 'locate-arousal', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'A', intent: N,
    text: 'Do you want something that moves you, or something that stays still with you?' },
  { id: 'locate-valence', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'V', intent: N,
    text: 'Is today asking you to lift, or to be held?' },
  { id: 'locate-depth', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'D', intent: N,
    text: "Should this keep you company, or take you somewhere you haven't been?" },
  { id: 'locate-quiet', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'V', intent: { a: -0.2, v: 0, d: 0.2 },
    text: 'Where does your mind go when the room gets quiet?' },

  // --- Selection (tap-to-choose; options carry their own AVD) ---
  { id: 'locate-color', kind: 'selection', sessionScope: 'always', tier: 1, gain: 0.8, probes: null, intent: N,
    text: 'If this evening were a color — amber, slate, rose, or ink?',
    options: [
      { label: 'amber', avd: { a: -0.3, v: 0.6, d: 0.0 } },
      { label: 'slate', avd: { a: -0.4, v: -0.4, d: 0.4 } },
      { label: 'rose', avd: { a: 0.0, v: 0.5, d: 0.2 } },
      { label: 'ink', avd: { a: 0.1, v: -0.1, d: 0.7 } },
    ] },

  // --- Closing (no AVD; the refusal-to-know) ---
  { id: 'closing', kind: 'closing', sessionScope: 'always', tier: 1, gain: 0, probes: null, intent: N,
    text: "I won't tell you what this was. That's yours." },
]

// How many locate/selection seeds to ask per session (biography is extra,
// session 1 only). ~3 per the spec's ~16-min arc.
export const LOCATE_BUDGET = 3

export function getSeed(id) {
  return SEEDS.find((s) => s.id === id) || null
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lib/__tests__/questionSeeds.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/questionSeeds.js src/lib/__tests__/questionSeeds.test.js
git commit -m "feat(admirer): authored question seed deck"
```

---

## Task C: Seed selection (`seedSelection.js`)

**Files:** Create `src/lib/seedSelection.js`, `src/lib/__tests__/seedSelection.test.js`.

- [ ] **Step 1: Write the failing test** (uses a FIXTURE deck so it never depends on real seed wording)

```js
// src/lib/__tests__/seedSelection.test.js
import { describe, it, expect } from 'vitest'
import { selectNextSeed } from '../seedSelection.js'

const N = { a: 0, v: 0, d: 0 }
const DECK = [
  { id: 'b1', kind: 'biography', sessionScope: 'first', tier: 1, gain: 0.3, probes: null, intent: N, text: 'b1' },
  { id: 'b2', kind: 'biography', sessionScope: 'first', tier: 1, gain: 0.3, probes: null, intent: N, text: 'b2' },
  { id: 'arrival', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.3, probes: null, intent: N, text: 'arrival' },
  { id: 'ar', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'A', intent: N, text: 'ar' },
  { id: 'va', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'V', intent: N, text: 'va' },
  { id: 'de', kind: 'locate', sessionScope: 'always', tier: 1, gain: 0.8, probes: 'D', intent: N, text: 'de' },
  { id: 'y3', kind: 'locate', sessionScope: 'always', tier: 3, gain: 0.8, probes: 'V', intent: N, text: 'y3' },
  { id: 'close', kind: 'closing', sessionScope: 'always', tier: 1, gain: 0, probes: null, intent: N, text: 'close' },
]
const base = { vector: N, deck: DECK, yearTier: 1 }

describe('seedSelection — selectNextSeed', () => {
  it('first session: biography seeds come first, in deck order', () => {
    const s = selectNextSeed({ ...base, sessionCount: 0, askedIds: [] })
    expect(s.id).toBe('b1')
    const s2 = selectNextSeed({ ...base, sessionCount: 0, askedIds: ['b1'] })
    expect(s2.id).toBe('b2')
  })

  it('returning session: skips biography, asks arrival first', () => {
    const s = selectNextSeed({ ...base, sessionCount: 3, askedIds: [] })
    expect(s.id).toBe('arrival')
  })

  it('after arrival, picks the least-resolved probed axis', () => {
    // vector: A resolved (0.8), V unresolved (0.0), D mid (0.3) → expect V seed
    const s = selectNextSeed({
      ...base, sessionCount: 3, askedIds: ['arrival'],
      vector: { a: 0.8, v: 0.0, d: 0.3 },
    })
    expect(s.id).toBe('va')
  })

  it('excludes already-asked seeds', () => {
    const s = selectNextSeed({
      ...base, sessionCount: 3, askedIds: ['arrival', 'va'],
      vector: { a: 0.0, v: 0.9, d: 0.3 },
    })
    expect(s.id).toBe('ar') // A is now least-resolved among remaining
  })

  it('never returns the closing seed', () => {
    const asked = ['arrival', 'ar', 'va', 'de']
    const s = selectNextSeed({ ...base, sessionCount: 3, askedIds: asked })
    expect(s).toBeNull() // budget exhausted, and closing is never returned
  })

  it('gates tier-3 seeds behind yearTier', () => {
    // Exhaust tier-1 locate budget is 3; check eligibility directly with a fresh deck
    const tier3only = [DECK[6]] // y3
    expect(selectNextSeed({ vector: N, deck: tier3only, sessionCount: 3, askedIds: [], yearTier: 1 })).toBeNull()
    expect(selectNextSeed({ vector: N, deck: tier3only, sessionCount: 3, askedIds: [], yearTier: 3 }).id).toBe('y3')
  })

  it('returns null once the per-session locate budget is spent', () => {
    const s = selectNextSeed({ ...base, sessionCount: 3, askedIds: ['arrival', 'ar', 'va'] })
    expect(s).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/seedSelection.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js
// src/lib/seedSelection.js
// Client-side seed selection for the Admirer (Option B). Chooses the next
// authored seed by session #, year-tier, and which AVD axis is least resolved.
// Pure — the host (Admirer.jsx) supplies the live vector + asked-ids.

import { SEEDS as DEFAULT_DECK, LOCATE_BUDGET } from './questionSeeds.js'

function isEligible(seed, { sessionCount, yearTier }) {
  if (seed.kind === 'closing') return false
  if (seed.tier === 3 && yearTier < 3) return false
  if (seed.sessionScope === 'first' && sessionCount !== 0) return false
  return true
}

const isConversational = (s) => s.kind === 'locate' || s.kind === 'selection'

export function selectNextSeed({
  vector = { a: 0, v: 0, d: 0 },
  askedIds = [],
  sessionCount = 0,
  yearTier = 1,
  deck = DEFAULT_DECK,
} = {}) {
  const asked = new Set(askedIds)
  const eligible = deck.filter((s) => !asked.has(s.id) && isEligible(s, { sessionCount, yearTier }))

  // First session: biography seeds first, in deck order.
  const bio = eligible.find((s) => s.kind === 'biography')
  if (bio) return bio

  // Per-session locate/selection budget.
  const askedCount = deck.filter((s) => asked.has(s.id) && isConversational(s)).length
  if (askedCount >= LOCATE_BUDGET) return null

  const pool = eligible.filter(isConversational)
  if (pool.length === 0) return null

  // Arrival (no probed axis) is asked first.
  const arrival = pool.find((s) => s.probes == null)
  if (arrival) return arrival

  // Otherwise: least-resolved probed axis first; non-probing seeds score 1
  // (treated as "resolved") so probes win ties; deck order breaks exact ties.
  const axisVal = { A: Math.abs(vector.a), V: Math.abs(vector.v), D: Math.abs(vector.d) }
  const score = (s) => (s.probes && axisVal[s.probes] != null ? axisVal[s.probes] : 1)
  return [...pool].sort((x, y) => {
    const dx = score(x)
    const dy = score(y)
    if (dx !== dy) return dx - dy
    return deck.indexOf(x) - deck.indexOf(y)
  })[0]
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lib/__tests__/seedSelection.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seedSelection.js src/lib/__tests__/seedSelection.test.js
git commit -m "feat(admirer): client-side seed selection (least-resolved axis + tier gating)"
```

---

## Task D: Extend `commitTurn` with confidence/gain

**Files:** Modify `src/lib/avdRuntime.js`, `src/lib/avdStore.js`; extend `src/lib/__tests__/avdStore.test.js`.

- [ ] **Step 1: Add a factor param to `ewmaStep` (default 1 keeps Slice 1 behavior)**

In `src/lib/avdRuntime.js`, replace the `ewmaStep` function with:

```js
// One EWMA step toward `target`. `turnIndex` is the zero-based index of the
// turn being committed (0,1,2 are cold start). `factor` scales the step
// (default 1) — used to fold in answer-confidence and seed-gain so low-stakes
// turns observe more than they steer. Returns a fresh vector.
export function ewmaStep(current, target, turnIndex, factor = 1) {
  const f = Math.max(0, factor)
  const eta = etaForTurn(turnIndex) * f
  const etaD = eta * DEPTH_ETA_SCALE
  return {
    a: clampUnitSigned(current.a + eta * (target.a - current.a)),
    v: clampUnitSigned(current.v + eta * (target.v - current.v)),
    d: clampUnitSigned(current.d + etaD * (target.d - current.d)),
  }
}
```

- [ ] **Step 2: Update `commitTurn`** in `src/lib/avdStore.js`:

```js
// Commit one conversational turn: EWMA-step the vector toward `target`
// (using the current turn index for the eta schedule), then advance the turn
// counter. `confidence` (read quality, 0..1) and `gain` (seed step weight)
// scale the step; both default to 1 so callers can omit them. Returns the
// new vector.
export function commitTurn(target, { confidence = 1, gain = 1 } = {}) {
  const factor = Math.max(0, confidence) * Math.max(0, gain)
  vector = ewmaStep(vector, target, turnCount, factor)
  turnCount += 1
  emit()
  return getAvd()
}
```

- [ ] **Step 3: Add tests** to `src/lib/__tests__/avdStore.test.js` (inside the existing `describe('avdStore', ...)`):

```js
  it('commitTurn with default gain/confidence matches the plain EWMA step', () => {
    commitTurn({ a: 1, v: 0, d: 0 })
    expect(getAvd().a).toBeCloseTo(0.35, 6) // cold-start eta, factor 1
  })

  it('gain scales the step down', () => {
    commitTurn({ a: 1, v: 0, d: 0 }, { gain: 0.3 })
    expect(getAvd().a).toBeCloseTo(0.35 * 0.3, 6) // 0.105
  })

  it('confidence and gain multiply', () => {
    commitTurn({ a: 1, v: 0, d: 0 }, { confidence: 0.5, gain: 0.8 })
    expect(getAvd().a).toBeCloseTo(0.35 * 0.4, 6) // 0.14
  })
```

- [ ] **Step 4: Run** — `npx vitest run src/lib/__tests__/avdStore.test.js src/lib/__tests__/avdRuntime.test.js` → all PASS (Slice 1 cases still green because `factor` defaults to 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/avdRuntime.js src/lib/avdStore.js src/lib/__tests__/avdStore.test.js
git commit -m "feat(avd): commitTurn confidence/gain step scaling"
```

---

## Task E: `getYearTier` in `sessionStore.js`

**Files:** Modify `src/lib/sessionStore.js`; extend `src/lib/__tests__/sessionStore.test.js`.

- [ ] **Step 1: Add the function** after `getRecencySummary` (it reuses `getEntries`):

```js
// Year-tier per Ship-Blockers §1: tier 3 once the practitioner has ≥24
// sessions AND ≥180 days have passed since their first entry; else tier 1.
// `now` is injectable for testing. Used to gate year-3-only question seeds.
export function getYearTier(now = Date.now()) {
  const entries = getEntries()
  if (entries.length < 24) return 1
  const firstTs = entries[0]?.ts || 0
  const daysSinceFirst = (now - firstTs) / 86400000
  return daysSinceFirst >= 180 ? 3 : 1
}
```

- [ ] **Step 2: Add tests** to `src/lib/__tests__/sessionStore.test.js`. First read that file to match its setup (how it isolates `localStorage` between tests — reuse the same `beforeEach`/clear pattern). Then add, using the existing `appendEntry` helper to seed entries:

```js
  describe('getYearTier', () => {
    it('is tier 1 with fewer than 24 entries', () => {
      for (let i = 0; i < 23; i++) appendEntry({ summary: 's', ts: 0 })
      expect(getYearTier(200 * 86400000)).toBe(1)
    })
    it('is tier 1 with 24+ entries but under 180 days', () => {
      for (let i = 0; i < 24; i++) appendEntry({ summary: 's', ts: 0 })
      expect(getYearTier(100 * 86400000)).toBe(1)
    })
    it('is tier 3 with 24+ entries and 180+ days since the first', () => {
      for (let i = 0; i < 24; i++) appendEntry({ summary: 's', ts: 0 })
      expect(getYearTier(180 * 86400000)).toBe(3)
    })
  })
```

Ensure `getYearTier` and `appendEntry` are imported at the top of the test file (add `getYearTier` to the existing `sessionStore.js` import).

- [ ] **Step 3: Run** — `npx vitest run src/lib/__tests__/sessionStore.test.js` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sessionStore.js src/lib/__tests__/sessionStore.test.js
git commit -m "feat(admirer): getYearTier for year-3 seed gating"
```

---

## Task F: Tools + Admirer host wiring

**Files:** Modify `src/lib/admirerTools.js`, `src/phases/Admirer.jsx`. Verified by `npm run build` + `npm run lint` (agent/host glue isn't unit-tested, per repo posture).

- [ ] **Step 1: Add the two tools** to `buildAdmirerTools` in `src/lib/admirerTools.js`. Add to the JSDoc callback list:

```
//   onNextQuestion()                          — returns the next authored seed (or null)
//   onRecordAnswer({seedId, texture, intensity, rationale})
```

Add these two entries to the returned object (alongside the existing tools):

```js
    // nextQuestion BLOCKS the agent (registered expects_response: true). The
    // host selects the next authored seed and returns its text; the agent
    // speaks that line, lightly re-voiced. Returns { done: true } when the
    // session's question budget is spent — the agent then moves on (fragments
    // / startGeneration).
    nextQuestion: async () => {
      if (!cb.onNextQuestion) return { done: true }
      const seed = await cb.onNextQuestion()
      if (!seed) return { done: true }
      return {
        seedId: seed.id,
        kind: seed.kind,
        text: seed.text,
        callbackHint: seed.callbackHint || '',
        ...(seed.options ? { options: seed.options.map((o) => o.label) } : {}),
      }
    },

    // recordAnswer is the agent's structured texture judgment of the user's
    // spoken answer (Admirer spec §3.3). The host blends it into an AVD target
    // and commits the turn.
    recordAnswer: ({ seedId, texture, intensity, rationale } = {}) => {
      cb.onRecordAnswer?.({ seedId, texture, intensity, rationale })
      return { ok: true }
    },
```

- [ ] **Step 2: Wire the host callbacks** in `src/phases/Admirer.jsx`. Read the file first to find where `buildAdmirerTools({...})` is called and where other refs live. Add imports:

```jsx
import { selectNextSeed } from '../lib/seedSelection.js'
import { getSeed } from '../lib/questionSeeds.js'
import { textureToTarget, blendTarget } from '../lib/textureToAvd.js'
import { getAvd, commitTurn, resetAvd } from '../lib/avdStore.js'
import { getEntries, getYearTier } from '../lib/sessionStore.js'
```

Add a ref for asked seed ids near the other refs:

```jsx
  const askedSeedIdsRef = useRef([])
```

Reset the AVD store + asked-ids when the Admirer mounts (idempotent with the scene's reset):

```jsx
  useEffect(() => {
    resetAvd()
    askedSeedIdsRef.current = []
    return () => resetAvd()
  }, [])
```

Add the callbacks (define near the other tool callbacks, then pass into `buildAdmirerTools`):

```jsx
  const onNextQuestion = useCallback(() => {
    const seed = selectNextSeed({
      vector: getAvd(),
      askedIds: askedSeedIdsRef.current,
      sessionCount: getEntries().length,
      yearTier: getYearTier(),
    })
    if (!seed) return null
    askedSeedIdsRef.current = [...askedSeedIdsRef.current, seed.id]
    return seed
  }, [])

  const onRecordAnswer = useCallback(({ seedId, texture, intensity }) => {
    const seed = getSeed(seedId)
    if (seed && (seed.kind === 'closing')) return
    const observed = textureToTarget(texture, intensity ?? 1)
    const target = blendTarget(observed, seed?.intent)
    commitTurn(target, { gain: seed?.gain ?? 0.8 })
  }, [])

  // Selection-seed tap: the chosen option's AVD is the observed value (no
  // texture classification). Wired to the option buttons (Step 3).
  const onSelectOption = useCallback((seedId, label) => {
    const seed = getSeed(seedId)
    const opt = seed?.options?.find((o) => o.label === label)
    if (!opt) return
    const target = blendTarget(opt.avd, seed.intent)
    commitTurn(target, { gain: seed.gain ?? 0.8 })
  }, [])
```

Pass `onNextQuestion` and `onRecordAnswer` into the existing `buildAdmirerTools({ ... })` call.

- [ ] **Step 3: Selection-seed tap UI.** When `nextQuestion` returns a seed with `options`, render tap buttons (reuse the `FragmentControls` Yes/No button styling — see `src/phases/FragmentControls.jsx`). On tap, call `onSelectOption(seedId, label)`. Minimal approach: hold the current selection seed in state set inside `onNextQuestion` (when `seed.kind === 'selection'`), render an options row near where `FragmentControls` mounts, and clear it on tap. Keep the markup consistent with the existing controls. (If the existing fragment-controls block is complex, add a sibling `<SelectionOptions>` block guarded by the selection-seed state.)

- [ ] **Step 4: Verify** — `npm run build` succeeds; `npx eslint src/lib/admirerTools.js src/phases/Admirer.jsx` reports no NEW errors (fix any unused-import/hook issues you introduce).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admirerTools.js src/phases/Admirer.jsx
git commit -m "feat(admirer): nextQuestion/recordAnswer tools + AVD writeback host wiring"
```

---

## Task G: Agent prompt — the re-voicer role

**Files:** Modify `scripts/create-admirer-agent.js`, then run `scripts/update-admirer-agent.js`; mirror in `docs/admirer-agent-dashboard.md`. Read all three first.

- [ ] **Step 1: Rewrite `SYSTEM_PROMPT`** so the agent is a re-voicer + classifier, not a question author. The prompt must instruct (keep the Admirer's existing character/voice guidance):
  - "You never invent questions. To ask anything, call the `nextQuestion` tool; it returns an authored line. Speak that line, adapted ONLY for pronouns, a brief callback to something earlier, or a smooth transition — never change its meaning or add new questions."
  - "If `nextQuestion` returns `{ done: true }`, stop asking questions and move to the listening run (`playFragment`) and then `startGeneration`, as before."
  - "If the returned seed has `options`, it is a tap question — speak it, then stay silent and wait; the person answers by tapping. Do not call `recordAnswer` for option questions."
  - "After the person answers a spoken question, call `recordAnswer` with your honest read of the answer's emotional texture: `texture` ∈ {calm, sharp, melancholic, exalted}, `intensity` 0..1, and a one-line `rationale`."
  - Register `nextQuestion` as a blocking tool: `expects_response: true`, `disable_interruptions: true`, a sensible `response_timeout_secs` (e.g. 30) — same shape as `playFragment`'s registration in the create script.
  - Register `recordAnswer` as a normal (non-blocking) client tool with the param schema `{ seedId: string, texture: string, intensity: number, rationale: string }`.

- [ ] **Step 2: Keep the two scripts in sync.** `update-admirer-agent.js` regex-extracts the prompt/tools from the create script — confirm the edits land in the regions it reads (per the file's existing comments). Mirror the prompt + new tools in `docs/admirer-agent-dashboard.md`.

- [ ] **Step 3: Apply to the live agent** — `node scripts/update-admirer-agent.js` (requires the ElevenLabs API key in env). If the key isn't available in this environment, report that and leave the script edits committed for the user to run.

- [ ] **Step 4: Commit**

```bash
git add scripts/create-admirer-agent.js scripts/update-admirer-agent.js docs/admirer-agent-dashboard.md
git commit -m "feat(admirer): agent prompt — re-voicer role + nextQuestion/recordAnswer tools"
```

---

## Task H: Reliability spike + full gate

**Files:** none (verification); optional notes doc.

- [ ] **Step 1: Reliability spike.** With `npm run dev`, run a real Admirer conversation and confirm: (a) the agent asks the `nextQuestion`-returned lines, in order, without inventing its own questions; (b) it calls `recordAnswer` with a plausible texture after each spoken answer; (c) selection seeds present tap options and the tap moves the vector; (d) the three-plane visuals shift as the vector moves (watch rotation/color/rings). Capture findings in `docs/admirer-slice2-spike-2026-06-09.md` (a short report).
  - If the agent improvises questions or skips `recordAnswer`: firm up the prompt wording (Task G) and re-run. If it stays unreliable on `gemini-2.5-flash-lite`, fall back to a server-side classifier for `recordAnswer` (a new `api/` endpoint that classifies the transcript) — note this as a follow-up; the client wiring is unchanged.

- [ ] **Step 2: Full gate** — `npm test` (no regressions; new suites pass), `npm run build` (clean), `npm run lint` (problem count ≤ the ~149 baseline, i.e. no new errors).

- [ ] **Step 3: Final commit (if anything was fixed)**

```bash
git add -A && git commit -m "test(admirer): Slice 2 green — Admirer→AVD writeback"
```

---

## Self-Review

**Spec coverage:** Option-B authored seeds (Task B) ✓; client-driven selection w/ least-resolved axis + tier gating + biography-first (Task C) ✓; `nextQuestion`/`recordAnswer` two-tool pattern (Task F) ✓; texture→AVD blend with α=0.6 (Task A) ✓; `commitTurn` confidence/gain step (Task D) ✓; year-tier (Task E) ✓; agent re-voicer prompt (Task G) ✓; reliability spike + fallback (Task H) ✓. Song/scene-by-AVD, Y3 scene pools, Orchestra-as-session-1, IndexedDB, server STT — all explicitly deferred per the spec §9.

**Placeholder scan:** every code step has complete code; the seed *wording* is intentionally editable data, and selection/tests key off structure not text (called out). Task F Step 3 (selection UI) and Tasks G/H are glue/config/manual by design — described with concrete directives, no invented test code.

**Type/name consistency:** `selectNextSeed`, `getSeed`, `LOCATE_BUDGET`, `textureToTarget`, `blendTarget`, `commitTurn(target, {confidence, gain})`, `getYearTier`, `getAvd`, `getEntries` are referenced with identical signatures across Tasks A–F. Seed shape (`id/kind/text/probes/intent/gain/sessionScope/tier/options`) is consistent between Task B, the fixtures in Task C, and the host wiring in Task F.
