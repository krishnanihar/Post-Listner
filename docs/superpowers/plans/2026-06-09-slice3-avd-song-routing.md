# Slice 3 — AVD → Song Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the matched song follow the committed AVD vector — at `startGeneration`, pick the archetype by nearest AVD centroid (Slice 1's `selectScene` over the archetypes' existing `scoringWeights`), with `era` still picking the variation and a turn-count fallback to the legacy descriptor pick.

**Architecture:** One new pure module (`avdToStems.js`) mirroring `descriptorsToStems.js`'s bundle shape, consumed by the `startGeneration` client tool. No visual/asset changes (Option 2 deferred).

**Design spec:** `docs/superpowers/specs/2026-06-09-slice3-avd-song-routing-design.md`.

---

## File Structure

- **Modify** `src/lib/descriptorsToStems.js` — export the currently-private `pickVariationByEra`.
- **Create** `src/lib/avdToStems.js` + `src/lib/__tests__/avdToStems.test.js`.
- **Modify** `src/lib/admirerTools.js` — `startGeneration` reads AVD + turn count; extend `src/lib/__tests__/admirerTools.test.js`.

---

## Task 1: Export `pickVariationByEra`

**Files:** Modify `src/lib/descriptorsToStems.js`.

- [ ] **Step 1:** Change the `pickVariationByEra` declaration from `function pickVariationByEra(` to `export function pickVariationByEra(` (it stays used internally by `mapDescriptorsToStems` — just also exported now).

- [ ] **Step 2:** Verify nothing else broke — `npx vitest run src/lib/__tests__/descriptorsToStems.test.js` → PASS (no behavior change).

- [ ] **Step 3:** Commit

```bash
git add src/lib/descriptorsToStems.js
git commit -m "refactor(stems): export pickVariationByEra for reuse"
```

---

## Task 2: `avdToStems.js` — AVD → archetype → bundle

**Files:** Create `src/lib/avdToStems.js`, `src/lib/__tests__/avdToStems.test.js`.

- [ ] **Step 1: Write the failing test** (against the real `ARCHETYPES`; centroids are stable data)

```js
// src/lib/__tests__/avdToStems.test.js
import { describe, it, expect } from 'vitest'
import {
  ARCHETYPE_CENTROIDS,
  selectArchetypeByAvd,
  mapAvdToStems,
} from '../avdToStems.js'
import { ARCHETYPES } from '../archetypes.js'

describe('avdToStems — ARCHETYPE_CENTROIDS', () => {
  it('has one signed centroid per archetype, mapped [0,1]->[-1,1]', () => {
    expect(ARCHETYPE_CENTROIDS.length).toBe(ARCHETYPES.length)
    const sky = ARCHETYPE_CENTROIDS.find((c) => c.id === 'sky-seeker')
    // sky-seeker scoringWeights {a:0.78, v:0.75, d:0.78} → *2-1
    expect(sky.anchor[0]).toBeCloseTo(0.56, 6)
    expect(sky.anchor[1]).toBeCloseTo(0.5, 6)
    expect(sky.anchor[2]).toBeCloseTo(0.56, 6)
  })
})

describe('avdToStems — selectArchetypeByAvd', () => {
  it('high A/V/D → sky-seeker', () => {
    expect(selectArchetypeByAvd({ a: 0.9, v: 0.9, d: 0.9 })).toBe('sky-seeker')
  })
  it('high-A low-V → quiet-insurgent', () => {
    expect(selectArchetypeByAvd({ a: 0.6, v: -0.6, d: 0.1 })).toBe('quiet-insurgent')
  })
  it('low-A high-V high-D → velvet-mystic', () => {
    expect(selectArchetypeByAvd({ a: -0.4, v: 0.5, d: 0.7 })).toBe('velvet-mystic')
  })
  it('neutral vector → nearest-to-origin (slow-glow)', () => {
    expect(selectArchetypeByAvd({ a: 0, v: 0, d: 0 })).toBe('slow-glow')
  })
  it('excludes restricted archetypes', () => {
    // sky-seeker would win, but restricted → next nearest is velvet-mystic
    expect(selectArchetypeByAvd({ a: 0.9, v: 0.9, d: 0.9 }, { restricted: ['sky-seeker'] }))
      .toBe('velvet-mystic')
  })
  it('falls back to the first archetype when all are restricted', () => {
    const all = ARCHETYPES.map((a) => a.id)
    expect(selectArchetypeByAvd({ a: 0, v: 0, d: 0 }, { restricted: all }))
      .toBe(ARCHETYPES[0].id)
  })
})

describe('avdToStems — mapAvdToStems', () => {
  it('returns the same bundle shape as descriptorsToStems', () => {
    const b = mapAvdToStems({ a: 0.9, v: 0.9, d: 0.9 }, { era: 2015 })
    expect(b).toMatchObject({
      archetypeId: 'sky-seeker',
      variationId: expect.any(String),
      stems: expect.any(Object),
      masterUrl: expect.any(String),
    })
  })
  it('era selects the variation', () => {
    const archetype = ARCHETYPES.find((a) => a.id === 'sky-seeker')
    const b1990 = mapAvdToStems({ a: 0.9, v: 0.9, d: 0.9 }, { era: 1990 })
    // the chosen variation should be the era-closest one
    let best = archetype.variations[0]
    let bestDist = Math.abs((best.era || 2000) - 1990)
    for (const v of archetype.variations.slice(1)) {
      const dist = Math.abs((v.era || 2000) - 1990)
      if (dist < bestDist) { best = v; bestDist = dist }
    }
    expect(b1990.variationId).toBe(best.id)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/avdToStems.test.js` → FAIL (import unresolved).

- [ ] **Step 3: Implement**

```js
// src/lib/avdToStems.js
// AVD vector → (archetypeId, variationId, stems, masterUrl). The committed
// signed AVD vector (Slice 1 spine) picks the archetype by nearest centroid;
// `era` (still from the agent's descriptors) picks the variation. Mirrors
// descriptorsToStems.js's bundle shape so it's a drop-in at startGeneration.
//
// The archetype centroids are the existing `scoringWeights` ({a,v,d} in [0,1])
// mapped into the signed [-1,1] spine. Slice 3 of the spec-integration program.

import { ARCHETYPES } from './archetypes.js'
import { selectScene } from './avdRuntime.js'
import { pickVariationByEra } from './descriptorsToStems.js'
import { getStems, getMasterUrl } from './stemsCatalog.js'

const toSigned = (x) => x * 2 - 1

// { id, anchor: [a, v, d] } per archetype, in signed [-1,1] space.
export const ARCHETYPE_CENTROIDS = ARCHETYPES.map((a) => ({
  id: a.id,
  anchor: [toSigned(a.scoringWeights.a), toSigned(a.scoringWeights.v), toSigned(a.scoringWeights.d)],
}))

// Nearest archetype centroid to `vector`, excluding restricted ids. One-shot
// pick (no hysteresis) — selectScene with currentId = null returns plain
// nearest. Falls back to the first archetype if every archetype is restricted.
export function selectArchetypeByAvd(vector, { restricted = [] } = {}) {
  const block = new Set(restricted)
  const eligible = ARCHETYPE_CENTROIDS.filter((c) => !block.has(c.id))
  if (eligible.length === 0) return ARCHETYPES[0].id
  return selectScene(vector, eligible, null)
}

// Full bundle: AVD → archetype, era → variation, then resolve R2 stem URLs.
export function mapAvdToStems(vector, { restricted = [], era } = {}) {
  const archetypeId = selectArchetypeByAvd(vector, { restricted })
  const archetype = ARCHETYPES.find((a) => a.id === archetypeId) || ARCHETYPES[0]
  const variation = pickVariationByEra(archetype, era)
  return {
    archetypeId: archetype.id,
    variationId: variation.id,
    stems: getStems(archetype.id, variation.id),
    masterUrl: getMasterUrl(archetype.id, variation.id),
  }
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lib/__tests__/avdToStems.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/avdToStems.js src/lib/__tests__/avdToStems.test.js
git commit -m "feat(avd): AVD→archetype song routing (selectScene over scoringWeights)"
```

---

## Task 3: Wire `startGeneration` to the AVD path

**Files:** Modify `src/lib/admirerTools.js`; extend `src/lib/__tests__/admirerTools.test.js`.

- [ ] **Step 1: Add imports** at the top of `src/lib/admirerTools.js`:

```js
import { getAvd, getTurnCount } from './avdStore.js'
import { mapAvdToStems } from './avdToStems.js'
```

(`mapDescriptorsToStems` stays imported — it's the fallback.)

- [ ] **Step 2: Replace the `startGeneration` tool body** so it routes by AVD once any turn has committed, else falls back to descriptors:

```js
    startGeneration: (descriptors = {}) => {
      const restricted = getRestricted()
      // Once the conversation has moved the AVD vector (≥1 committed turn), the
      // vector chooses the archetype; era still picks the variation. With no
      // committed turns (vector still neutral — e.g. recordAnswer never fired)
      // fall back to the legacy descriptor pick so song variety never regresses.
      const bundle = getTurnCount() > 0
        ? mapAvdToStems(getAvd(), { restricted, era: descriptors.era })
        : mapDescriptorsToStems(descriptors, { restricted })
      cb.onStartGeneration?.(bundle)
      return {
        ok: true,
        archetypeId: bundle.archetypeId,
        variationId: bundle.variationId,
      }
    },
```

- [ ] **Step 3: Add tests** to `src/lib/__tests__/admirerTools.test.js`. Read that file first to match its setup (how it builds tools + imports). Add a block that exercises both paths via `avdStore`:

```js
import { resetAvd, commitTurn } from '../avdStore.js'

describe('startGeneration — AVD routing', () => {
  beforeEach(() => resetAvd())

  it('uses the AVD path once a turn has committed', () => {
    commitTurn({ a: 1, v: 1, d: 1 }) // pushes toward sky-seeker; turnCount → 1
    let bundle = null
    const tools = buildAdmirerTools({ onStartGeneration: (b) => { bundle = b } })
    const res = tools.startGeneration({ era: 2015 })
    expect(res.ok).toBe(true)
    expect(bundle.archetypeId).toBe('sky-seeker')
  })

  it('falls back to the descriptor path when no turn has committed', () => {
    let bundle = null
    const tools = buildAdmirerTools({ onStartGeneration: (b) => { bundle = b } })
    tools.startGeneration({ mood: 'tense' }) // descriptorsToStems: tense → quiet-insurgent
    expect(bundle.archetypeId).toBe('quiet-insurgent')
  })
})
```

(If `buildAdmirerTools` / `describe` / `beforeEach` import lines already exist in the file, reuse them rather than re-importing.)

- [ ] **Step 4: Run** — `npx vitest run src/lib/__tests__/admirerTools.test.js` → PASS.

- [ ] **Step 5: Verify build + lint** — `npm run build` succeeds; `npx eslint src/lib/admirerTools.js src/lib/avdToStems.js src/lib/descriptorsToStems.js` → no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admirerTools.js src/lib/__tests__/admirerTools.test.js
git commit -m "feat(admirer): startGeneration routes the song by AVD (turn-count fallback)"
```

---

## Task 4: Full gate + docs

**Files:** `CLAUDE.md`, memory (verification + doc).

- [ ] **Step 1: Full gate** — `npm test` (no regressions; new suites pass), `npm run build` (clean), `npm run lint` (≤ ~149 baseline, no new errors).

- [ ] **Step 2: Update `CLAUDE.md`** — in the audio-continuity + Admirer sections, note that `startGeneration` now routes the song by the committed AVD vector (`avdToStems.js`, nearest archetype centroid) with `era → variation` and a turn-count fallback to `descriptorsToStems`; update the Slice status line to mark Slice 3 done and Slice 4 (IndexedDB archive) next.

- [ ] **Step 3: Update memory** `project_spec_integration.md` — mark Slice 3 done (ends at the final commit), Slice 4 next.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: AVD→song routing (Slice 3)"
```

---

## Self-Review

**Spec coverage:** AVD→archetype via `selectScene` over signed `scoringWeights` (Task 2) ✓; era→variation reuse (Tasks 1–2) ✓; turn-count fallback (Task 3) ✓; restricted exclusion (Task 2) ✓; same bundle shape / drop-in (Tasks 2–3) ✓. Option 2 (visual scene deck), real generation, continuous re-routing — all explicitly deferred.

**Placeholder scan:** every code step is complete; test expectations are computed from the real archetype centroids (sky-seeker/quiet-insurgent/velvet-mystic/slow-glow), no invented data.

**Type/name consistency:** `ARCHETYPE_CENTROIDS`, `selectArchetypeByAvd`, `mapAvdToStems` (Task 2) match their consumer in `admirerTools.js` (Task 3); the bundle keys `archetypeId/variationId/stems/masterUrl` match `descriptorsToStems.js`'s shape and `onStartGeneration`'s existing contract; `getAvd`/`getTurnCount`/`commitTurn`/`resetAvd` match the Slice 1 `avdStore` API; `pickVariationByEra` is exported in Task 1 and imported in Task 2.
