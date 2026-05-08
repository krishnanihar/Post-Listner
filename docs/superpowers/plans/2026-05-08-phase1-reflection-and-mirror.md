# Phase 1 — Reflection & Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manufacture the "being seen" feeling by inserting a Reflection screen (signal read-back) and a Mirror beat (archetype + Forer + memory callback) before the AI track plays — using only data already captured in PostListener phases 0–6.

**Architecture:** Insert a new `reflection` phase between `moment` and `reveal`. Restructure `Reveal.score.jsx` so its first ~25s is a Mirror stage (archetype reveal, "because you…" attribution band, Forer paragraph, memory callback, time-of-day passive line, temporal-uniqueness frame), then the AI track plays as before. Add hover-without-commit logging and a mid-pairs operational-transparency comment to `Spectrum.score.jsx`. Pure-function modules (archetype scoring, line generators) live in `src/lib/` and are unit-tested with vitest.

**Tech Stack:** React 19, Vite 7, Tailwind v4, Framer Motion 12, vitest (added in Task 1). Existing `src/score/` primitives (`Paper`, `Score`, `Stave`, `marks`, `tokens`, `voice`) reused for the cream-paper aesthetic. No ElevenLabs, no new audio assets, no backend.

---

## Research grounding (read once, then refer back)

The plan implements these specific mechanisms — keep them in mind when wording text content:

- **Replika/Midjourney/ChatGPT reflection-before-output** — show the user their inputs interpreted, *then* deliver the personalized output. The reflection screen is "where the 'being seen' feeling is manufactured" (`Research/stealable-techniques-feeling-seen.md` §Reflection).
- **Forer 1949 + Furnham & Schofield 1987 Barnum recipe** — 60% genuine specificity (echoed user choices), 40% broadly resonant identity language. Three flattering claims + one mild challenge + one specific-but-unfalsifiable image.
- **Pandora "Why this song" + Netflix "because you watched"** — causal-attribution framing converts black-box → legible story.
- **Daylist microgenre labels** — playful insider-y specificity (e.g., *"2010s · lo-fi piano for cab rides home"*) outperforms clean genre tags. 20,000% search-lift evidence.
- **Endel/Co-Star passive sensing** — one un-asked-for line (time-of-day) creates uncanny "how did it know?" response.
- **Mubert temporal uniqueness** — "Composed at HH:MM on {date}. Has never existed before." Concrete timestamp makes generative uniqueness feel real.

---

## File structure

**New files:**

| File | Responsibility |
|---|---|
| `src/lib/archetypes.js` | The 6 archetypes × 4 variations grid. Each archetype: id, displayName, scoringWeights (A/V/D/spectrumAxes), forerTemplate (3 flattering + 1 challenge + 1 unfalsifiable image, with `{name}` placeholders). Each variation: id, microgenreLabel (Daylist-style). |
| `src/lib/scoreArchetype.js` | Pure function `scoreArchetype(avd, phaseData) → { archetypeId, variationId, confidence, scores }`. Cascade hybrid: archetype via weighted dot-product + softmax (no stochasticity), variation via cosine similarity in subspace + ε-greedy (ε=0.12). |
| `src/lib/reflectionLines.js` | Pure function `buildReflectionLines(avd, phaseData) → { spectrum, depth, textures, moment }` — each is `{ signal: string, interpretation: string }`. E.g. `{ signal: "warmth chosen 6 / 9 times", interpretation: "you favor warmth over shadow" }`. |
| `src/lib/forerLines.js` | Pure functions for Mirror copy: `buildBecauseLine(phaseData) → string[]` (3 fragments), `buildMemoryCallback(phaseData) → string \| null`, `buildTimeOfDayLine(now) → string`, `buildLatencyLine(phaseData) → string`, `buildTemporalFrame(now) → string`. |
| `src/phases/Reflection.score.jsx` | NEW phase 5.5 — ink-on-cream score-paper screen, ~10s total, 4 lines fade in sequentially (one per signal: spectrum, depth, textures, moment), then crossfade out. |
| `src/phases/Mirror.score.jsx` | Component used as the first stage of `Reveal.score.jsx` (not a top-level phase, see Architecture). Renders archetype reveal → because-you band → Forer paragraph → memory callback → time-of-day line → temporal frame. ~25s total. Triggers `onComplete()` callback. |
| `vitest.config.js` | Vitest configuration: jsdom environment, alias `@` → `./src`. |
| `src/lib/__tests__/scoreArchetype.test.js` | Unit tests for archetype scoring. |
| `src/lib/__tests__/reflectionLines.test.js` | Unit tests for reflection line generation. |
| `src/lib/__tests__/forerLines.test.js` | Unit tests for Mirror line generators. |

**Modified files:**

| File | Change |
|---|---|
| `package.json` | Add vitest, jsdom devDeps. Add `test` script. |
| `src/App.jsx` | Add `'reflection'` to `PHASES` array between `moment` and `reveal`. Wire `Reflection` component into `phaseComponent` map. |
| `src/engine/avd.js` | Extend `phaseData.spectrum` default to include `hoveredButNotChosen: []`. Update `reset()` accordingly. |
| `src/phases/Spectrum.score.jsx` | (a) Log hover-without-commit events: when user leans past `LEAN_THRESHOLD` toward a side then reverses without locking, push `{ pair, side, dwellMs }` to `hoveredButNotChosen[]`. (b) After pair 4 commits, render an inline "operational-transparency" comment (a single italic line below stave area) computed from running tally — text only, no voice. Auto-hides after 3.5s. |
| `src/phases/Reveal.score.jsx` | Restructure stage flow: `computing → mirror → listening → done`. Replace existing `assembling` + voice-over flow with `<Mirror onComplete={beginListening} ... />`. The existing score-paper assembling visuals are removed (their job is now done by `Reflection.score.jsx`). The track audio element creation remains here; sub-audible fade-up is started by Mirror via callback during the Forer stage. |

---

## The 6 × 4 archetype grid (final)

This grid is the canonical reference used by `archetypes.js`, `scoreArchetype.js`, and `Mirror.score.jsx`. Variation labels follow Daylist's "playful insider-y specificity" pattern.

| # | Archetype | Variations |
|---|---|---|
| 1 | The Late-Night Architect | 2010s · lo-fi piano for cab rides home / 1980s · synth-melancholy for the kitchen at midnight / 2020s · neo-classical with field recordings / 1970s · ECM jazz piano for unfinished conversations |
| 2 | The Hearth-Keeper | 2010s · folk for the long drive back / 1970s · slow R&B for two in a room / 2000s · acoustic-soft for early Sundays / 1960s · Americana for the porch hour |
| 3 | The Velvet Mystic | 2020s · chamber-strings for the ceremony / 1990s · dream-pop for the stairwell / 1810s-orchestral revisited / 2010s · ambient-choral for empty cathedrals |
| 4 | The Quiet Insurgent | 2000s · post-rock for the slow burn / 1990s · minor-key indie for the walk home / 2010s · restrained punk for the rooftop / 1980s · post-punk for the kitchen floor |
| 5 | The Slow Glow | 2020s · downtempo soul for steam and tile / 2010s · chillwave for warm pavement / 1990s · trip-hop for headlight rain / 1970s · soft funk for low-light rooms |
| 6 | The Sky-Seeker | 2010s · cinematic ambient for the long climb / 2020s · post-classical for first light / 1990s · triumphant rock for the highway / 2000s · electronic-orchestral for the threshold |

---

## Forer paragraph templates (referenced in `archetypes.js`)

Each archetype's `forerTemplate` is a **3-sentence array** (compressed for ~25s read at calm tempo). Each sentence follows the recipe:
- Sentences 1 + 2: flattering specificity (echoed against user data)
- Sentence 3: mild challenge OR unfalsifiable image

**The Late-Night Architect:**
1. *"You appreciate music that rewards a second listen — the kind with hidden depth."*
2. *"You give an entire night to a song that earns it, but you resist anything that demands attention up front."*
3. *"You keep your saddest songs for cab rides home."*

**The Hearth-Keeper:**
1. *"You are drawn to music that arrives like a person sitting down beside you."*
2. *"You trust warmth more than spectacle, and you can tell the difference."*
3. *"There's a song you only play when no one else is in the house."*

**The Velvet Mystic:**
1. *"You hear architecture in music — height, light, the way a room holds sound."*
2. *"You're moved by what other people find too quiet."*
3. *"You collect songs the way other people collect rooms."*

**The Quiet Insurgent:**
1. *"You're loyal to music that holds tension without resolving it — the kind that ends the way a question ends."*
2. *"You prefer the half-spoken thing to the chorus."*
3. *"You have a song you've never put on a playlist for anyone."*

**The Slow Glow:**
1. *"You like music that takes its time and assumes you will too."*
2. *"You hear groove as a kind of patience, not a kind of speed."*
3. *"You play certain songs only after the room has gone warm."*

**The Sky-Seeker:**
1. *"You're drawn to music that makes the ceiling feel higher."*
2. *"You give yourself permission to be moved — most people don't."*
3. *"There's a moment you keep waiting for in songs, and you know it when it arrives."*

These are the exact strings to ship in `archetypes.js`. Do not paraphrase.

---

## Task 1: Vitest setup + lint passes

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`

- [ ] **Step 1: Install vitest + jsdom**

Run from repo root:
```bash
npm install -D vitest jsdom @vitest/ui
```

- [ ] **Step 2: Create `vitest.config.js`**

Write the file at repo root:
```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/__tests__/**/*.test.{js,jsx}'],
  },
})
```

- [ ] **Step 3: Add `test` script to `package.json`**

In `package.json` `"scripts"` block, add after `"preview"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs (with no tests yet)**

Run: `npm test`
Expected: vitest exits successfully with "No test files found" or similar — confirms install worked. (If it errors with a config problem, fix before proceeding.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js
git commit -m "chore: add vitest + jsdom for pure-function tests"
```

---

## Task 2: Build the archetype grid module

**Files:**
- Create: `src/lib/archetypes.js`
- Create: `src/lib/__tests__/archetypes.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/archetypes.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { ARCHETYPES, getArchetype, getVariation } from '../archetypes'

describe('archetypes', () => {
  it('has exactly 6 archetypes', () => {
    expect(ARCHETYPES).toHaveLength(6)
  })

  it('each archetype has exactly 4 variations', () => {
    for (const a of ARCHETYPES) {
      expect(a.variations).toHaveLength(4)
    }
  })

  it('each archetype has a 3-sentence Forer template', () => {
    for (const a of ARCHETYPES) {
      expect(a.forerTemplate).toHaveLength(3)
      for (const sentence of a.forerTemplate) {
        expect(typeof sentence).toBe('string')
        expect(sentence.length).toBeGreaterThan(20)
      }
    }
  })

  it('each archetype has scoringWeights with a, v, d numeric fields', () => {
    for (const a of ARCHETYPES) {
      expect(typeof a.scoringWeights.a).toBe('number')
      expect(typeof a.scoringWeights.v).toBe('number')
      expect(typeof a.scoringWeights.d).toBe('number')
    }
  })

  it('getArchetype returns the archetype by id', () => {
    expect(getArchetype('late-night-architect').displayName).toBe('The Late-Night Architect')
  })

  it('getVariation returns the variation by archetype + variation id', () => {
    const v = getVariation('late-night-architect', 'lo-fi-piano-2010s')
    expect(v.microgenreLabel).toContain('lo-fi piano')
  })

  it('all variation ids are unique within an archetype', () => {
    for (const a of ARCHETYPES) {
      const ids = a.variations.map(v => v.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/archetypes.test.js`
Expected: FAIL — "Cannot find module '../archetypes'"

- [ ] **Step 3: Implement `src/lib/archetypes.js`**

Create `src/lib/archetypes.js`:
```js
// 6 archetypes × 4 variations grid for PostListener Mirror.
// Forer templates follow Furnham & Schofield 1987 recipe:
//   2 flattering specificity sentences + 1 unfalsifiable image / mild challenge.
// Variation labels follow Daylist's "playful insider-y specificity" pattern.

export const ARCHETYPES = [
  {
    id: 'late-night-architect',
    displayName: 'The Late-Night Architect',
    // Higher D (depth/structure), lower-mid A, mid V — introspective, intricate.
    scoringWeights: { a: 0.35, v: 0.45, d: 0.85 },
    spectrumAffinities: { warmth: 0.4, shadow: 0.6, density: 0.7, air: 0.3 },
    forerTemplate: [
      'You appreciate music that rewards a second listen — the kind with hidden depth.',
      'You give an entire night to a song that earns it, but you resist anything that demands attention up front.',
      'You keep your saddest songs for cab rides home.',
    ],
    variations: [
      { id: 'lo-fi-piano-2010s', microgenreLabel: '2010s · lo-fi piano for cab rides home', era: 2015 },
      { id: 'synth-melancholy-1980s', microgenreLabel: '1980s · synth-melancholy for the kitchen at midnight', era: 1985 },
      { id: 'neo-classical-2020s', microgenreLabel: '2020s · neo-classical with field recordings', era: 2022 },
      { id: 'ecm-jazz-piano-1970s', microgenreLabel: '1970s · ECM jazz piano for unfinished conversations', era: 1975 },
    ],
  },
  {
    id: 'hearth-keeper',
    displayName: 'The Hearth-Keeper',
    // Mid A, high V (warmth), mid D — warm, sung, acoustic.
    scoringWeights: { a: 0.4, v: 0.78, d: 0.5 },
    spectrumAffinities: { warmth: 0.9, shadow: 0.1, density: 0.55, air: 0.45 },
    forerTemplate: [
      'You are drawn to music that arrives like a person sitting down beside you.',
      'You trust warmth more than spectacle, and you can tell the difference.',
      "There's a song you only play when no one else is in the house.",
    ],
    variations: [
      { id: 'folk-2010s', microgenreLabel: '2010s · folk for the long drive back', era: 2014 },
      { id: 'slow-rnb-1970s', microgenreLabel: '1970s · slow R&B for two in a room', era: 1973 },
      { id: 'acoustic-soft-2000s', microgenreLabel: '2000s · acoustic-soft for early Sundays', era: 2005 },
      { id: 'americana-1960s', microgenreLabel: '1960s · Americana for the porch hour', era: 1965 },
    ],
  },
  {
    id: 'velvet-mystic',
    displayName: 'The Velvet Mystic',
    // Low A, high V, high D — lush orchestral, dream-pop, chamber.
    scoringWeights: { a: 0.3, v: 0.72, d: 0.82 },
    spectrumAffinities: { warmth: 0.6, shadow: 0.4, density: 0.85, air: 0.7 },
    forerTemplate: [
      'You hear architecture in music — height, light, the way a room holds sound.',
      "You're moved by what other people find too quiet.",
      'You collect songs the way other people collect rooms.',
    ],
    variations: [
      { id: 'chamber-strings-2020s', microgenreLabel: '2020s · chamber-strings for the ceremony', era: 2021 },
      { id: 'dream-pop-1990s', microgenreLabel: '1990s · dream-pop for the stairwell', era: 1993 },
      { id: 'orchestral-revisited', microgenreLabel: '1810s-orchestral revisited', era: 1815 },
      { id: 'ambient-choral-2010s', microgenreLabel: '2010s · ambient-choral for empty cathedrals', era: 2016 },
    ],
  },
  {
    id: 'quiet-insurgent',
    displayName: 'The Quiet Insurgent',
    // Mid-high A, low V (minor-key tension), mid D — post-rock, indie.
    scoringWeights: { a: 0.62, v: 0.28, d: 0.55 },
    spectrumAffinities: { warmth: 0.3, shadow: 0.7, density: 0.6, air: 0.4 },
    forerTemplate: [
      "You're loyal to music that holds tension without resolving it — the kind that ends the way a question ends.",
      'You prefer the half-spoken thing to the chorus.',
      "You have a song you've never put on a playlist for anyone.",
    ],
    variations: [
      { id: 'post-rock-2000s', microgenreLabel: '2000s · post-rock for the slow burn', era: 2003 },
      { id: 'minor-indie-1990s', microgenreLabel: '1990s · minor-key indie for the walk home', era: 1995 },
      { id: 'restrained-punk-2010s', microgenreLabel: '2010s · restrained punk for the rooftop', era: 2014 },
      { id: 'post-punk-1980s', microgenreLabel: '1980s · post-punk for the kitchen floor', era: 1981 },
    ],
  },
  {
    id: 'slow-glow',
    displayName: 'The Slow Glow',
    // Low-mid A, mid-high V, mid D — downtempo, lo-fi, chillwave.
    scoringWeights: { a: 0.32, v: 0.6, d: 0.45 },
    spectrumAffinities: { warmth: 0.7, shadow: 0.3, density: 0.4, air: 0.6 },
    forerTemplate: [
      'You like music that takes its time and assumes you will too.',
      'You hear groove as a kind of patience, not a kind of speed.',
      'You play certain songs only after the room has gone warm.',
    ],
    variations: [
      { id: 'downtempo-soul-2020s', microgenreLabel: '2020s · downtempo soul for steam and tile', era: 2022 },
      { id: 'chillwave-2010s', microgenreLabel: '2010s · chillwave for warm pavement', era: 2013 },
      { id: 'trip-hop-1990s', microgenreLabel: '1990s · trip-hop for headlight rain', era: 1996 },
      { id: 'soft-funk-1970s', microgenreLabel: '1970s · soft funk for low-light rooms', era: 1976 },
    ],
  },
  {
    id: 'sky-seeker',
    displayName: 'The Sky-Seeker',
    // High A, high V, high D — cinematic, triumphant, awe-inducing.
    scoringWeights: { a: 0.78, v: 0.75, d: 0.78 },
    spectrumAffinities: { warmth: 0.55, shadow: 0.45, density: 0.85, air: 0.75 },
    forerTemplate: [
      "You're drawn to music that makes the ceiling feel higher.",
      'You give yourself permission to be moved — most people don\'t.',
      "There's a moment you keep waiting for in songs, and you know it when it arrives.",
    ],
    variations: [
      { id: 'cinematic-ambient-2010s', microgenreLabel: '2010s · cinematic ambient for the long climb', era: 2015 },
      { id: 'post-classical-2020s', microgenreLabel: '2020s · post-classical for first light', era: 2023 },
      { id: 'triumphant-rock-1990s', microgenreLabel: '1990s · triumphant rock for the highway', era: 1994 },
      { id: 'electronic-orchestral-2000s', microgenreLabel: '2000s · electronic-orchestral for the threshold', era: 2007 },
    ],
  },
]

export function getArchetype(id) {
  return ARCHETYPES.find(a => a.id === id)
}

export function getVariation(archetypeId, variationId) {
  const a = getArchetype(archetypeId)
  if (!a) return null
  return a.variations.find(v => v.id === variationId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/__tests__/archetypes.test.js`
Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/archetypes.js src/lib/__tests__/archetypes.test.js
git commit -m "feat(score-v2): add 6x4 archetype grid with Forer templates"
```

---

## Task 3: Build the archetype scoring module

**Files:**
- Create: `src/lib/scoreArchetype.js`
- Create: `src/lib/__tests__/scoreArchetype.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/scoreArchetype.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { scoreArchetype, _archetypeScores } from '../scoreArchetype'

const fakePhaseData = (overrides = {}) => ({
  spectrum: { pairs: [], hoveredButNotChosen: [] },
  depth: { finalLayer: 4, maxLayer: 4, reEngaged: false },
  textures: { preferred: ['strings', 'keys'], rejected: [], neutral: [] },
  moment: { totalTaps: 12, peakTapRate: 1.4 },
  ...overrides,
})

describe('scoreArchetype', () => {
  it('returns an archetypeId, variationId, confidence, scores', () => {
    const result = scoreArchetype({ a: 0.5, v: 0.5, d: 0.5 }, fakePhaseData())
    expect(result.archetypeId).toBeTruthy()
    expect(result.variationId).toBeTruthy()
    expect(typeof result.confidence).toBe('number')
    expect(result.scores).toBeTypeOf('object')
  })

  it('low-A high-D introspective profile selects Late-Night Architect', () => {
    const result = scoreArchetype({ a: 0.3, v: 0.4, d: 0.85 }, fakePhaseData())
    expect(result.archetypeId).toBe('late-night-architect')
  })

  it('mid-A high-V warm profile selects Hearth-Keeper', () => {
    const result = scoreArchetype({ a: 0.4, v: 0.78, d: 0.5 }, fakePhaseData())
    expect(result.archetypeId).toBe('hearth-keeper')
  })

  it('high-A low-V tense profile selects Quiet Insurgent', () => {
    const result = scoreArchetype({ a: 0.65, v: 0.25, d: 0.55 }, fakePhaseData())
    expect(result.archetypeId).toBe('quiet-insurgent')
  })

  it('high-A high-V high-D triumphant profile selects Sky-Seeker', () => {
    const result = scoreArchetype({ a: 0.8, v: 0.78, d: 0.78 }, fakePhaseData())
    expect(result.archetypeId).toBe('sky-seeker')
  })

  it('confidence is in [0, 1]', () => {
    const result = scoreArchetype({ a: 0.5, v: 0.5, d: 0.5 }, fakePhaseData())
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('archetype scores sum to 1.0 (softmax)', () => {
    const scores = _archetypeScores({ a: 0.5, v: 0.5, d: 0.5 })
    const sum = Object.values(scores).reduce((s, v) => s + v, 0)
    expect(sum).toBeCloseTo(1.0, 5)
  })

  it('selects a valid variation id within the chosen archetype', () => {
    const result = scoreArchetype({ a: 0.3, v: 0.4, d: 0.85 }, fakePhaseData())
    const validIds = [
      'lo-fi-piano-2010s', 'synth-melancholy-1980s',
      'neo-classical-2020s', 'ecm-jazz-piano-1970s',
    ]
    expect(validIds).toContain(result.variationId)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/scoreArchetype.test.js`
Expected: FAIL — "Cannot find module '../scoreArchetype'"

- [ ] **Step 3: Implement `src/lib/scoreArchetype.js`**

Create `src/lib/scoreArchetype.js`:
```js
// Hierarchical knowledge-based archetype scoring (Burke 2002 cascade hybrid).
// Step 1: archetype via weighted Euclidean distance in AVD space + softmax. No stochasticity.
// Step 2: variation via era / texture density tie-breaking + ε-greedy (ε=0.12) for surprise.

import { ARCHETYPES } from './archetypes.js'

const TEMPERATURE = 0.18  // softmax temperature — lower = sharper confidence
const EPSILON_VARIATION = 0.12

// Distance in AVD-weighted space: lower distance = higher fit.
function avdDistance(avd, weights) {
  const da = avd.a - weights.a
  const dv = avd.v - weights.v
  const dd = avd.d - weights.d
  return Math.sqrt(da * da + dv * dv + dd * dd)
}

// Internal: returns { archetypeId: softmaxScore } with all values summing to 1.
export function _archetypeScores(avd) {
  const distances = ARCHETYPES.map(a => ({
    id: a.id,
    distance: avdDistance(avd, a.scoringWeights),
  }))

  // Convert distance → score: -distance / temperature, then softmax.
  const logits = distances.map(d => -d.distance / TEMPERATURE)
  const maxLogit = Math.max(...logits)
  const exps = logits.map(l => Math.exp(l - maxLogit))
  const sumExp = exps.reduce((s, v) => s + v, 0)
  const result = {}
  distances.forEach((d, i) => {
    result[d.id] = exps[i] / sumExp
  })
  return result
}

function selectVariation(archetype, phaseData, rand = Math.random) {
  // ε-greedy: sometimes return a random variation for serendipity.
  if (rand() < EPSILON_VARIATION) {
    const idx = Math.floor(rand() * archetype.variations.length)
    return archetype.variations[idx]
  }

  // Otherwise: prefer the variation whose era and density best matches signals.
  // Heuristic: depth (finalLayer / 8) signals density preference, mapped to
  // a per-variation density score that combines era recency + label keywords.
  const depthNorm = Math.min(1, (phaseData.depth?.finalLayer || 1) / 8)
  const texCount = (phaseData.textures?.preferred || []).length

  // Score each variation by an arbitrary fit signal: more depth → newer/denser.
  const variationScores = archetype.variations.map(v => {
    const eraNorm = (v.era - 1960) / 70  // 1960 → 0, 2030 → 1
    const eraFit = 1 - Math.abs(depthNorm - eraNorm)
    const textureFit = texCount / 8
    return { variation: v, score: eraFit * 0.7 + textureFit * 0.3 }
  })

  variationScores.sort((a, b) => b.score - a.score)
  return variationScores[0].variation
}

export function scoreArchetype(avd, phaseData, rand = Math.random) {
  const scores = _archetypeScores(avd)
  let topId = null
  let topScore = -Infinity
  for (const [id, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score
      topId = id
    }
  }
  const archetype = ARCHETYPES.find(a => a.id === topId)
  const variation = selectVariation(archetype, phaseData, rand)

  return {
    archetypeId: topId,
    variationId: variation.id,
    confidence: topScore,
    scores,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/__tests__/scoreArchetype.test.js`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoreArchetype.js src/lib/__tests__/scoreArchetype.test.js
git commit -m "feat(score-v2): add cascade archetype scorer with ε-greedy variation pick"
```

---

## Task 4: Build the reflection-lines module

**Files:**
- Create: `src/lib/reflectionLines.js`
- Create: `src/lib/__tests__/reflectionLines.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/reflectionLines.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { buildReflectionLines } from '../reflectionLines'

describe('buildReflectionLines', () => {
  const baseAvd = { a: 0.5, v: 0.5, d: 0.5 }

  it('produces four lines: spectrum, depth, textures, moment', () => {
    const phaseData = {
      spectrum: {
        pairs: [
          { choice: 'left', label: 'shadow' }, { choice: 'right', label: 'warmth' },
          { choice: 'right', label: 'shimmer' }, { choice: 'right', label: 'air' },
          { choice: 'right', label: 'bloom' }, { choice: 'left', label: 'machine' },
          { choice: 'right', label: 'resolve' }, { choice: 'right', label: 'glass' },
        ],
        hoveredButNotChosen: [],
      },
      depth: { finalLayer: 5, maxLayer: 6 },
      textures: { preferred: ['strings', 'keys'], rejected: [], neutral: [] },
      moment: { totalTaps: 14, peakTapRate: 1.6, tapsDuringBuild: 10, tapsDuringRelease: 4 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.spectrum).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.depth).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.textures).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.moment).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
  })

  it('spectrum line counts the dominant side and references it', () => {
    const phaseData = {
      spectrum: {
        pairs: Array.from({ length: 8 }, (_, i) => ({
          choice: i < 6 ? 'right' : 'left',
          label: i < 6 ? 'warmth' : 'shadow',
        })),
        hoveredButNotChosen: [],
      },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.spectrum.signal).toMatch(/6/)
    expect(lines.spectrum.signal.toLowerCase()).toMatch(/8/)
  })

  it('depth line includes the final layer count', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 7, maxLayer: 7 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.depth.signal).toMatch(/7/)
  })

  it('textures line lists preferred names', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: ['strings', 'voice', 'field'], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.textures.signal).toContain('strings')
    expect(lines.textures.signal).toContain('voice')
    expect(lines.textures.signal).toContain('field')
  })

  it('moment line includes a BPM-like number', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 14, peakTapRate: 1.5, tapsDuringBuild: 10, tapsDuringRelease: 4 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.moment.signal).toMatch(/\d+\s*BPM/i)
  })

  it('handles missing/zero data gracefully', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1, maxLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0, tapsDuringBuild: 0, tapsDuringRelease: 0 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.spectrum.signal).toBeTruthy()
    expect(lines.depth.signal).toBeTruthy()
    expect(lines.textures.signal).toBeTruthy()
    expect(lines.moment.signal).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/reflectionLines.test.js`
Expected: FAIL — "Cannot find module '../reflectionLines'"

- [ ] **Step 3: Implement `src/lib/reflectionLines.js`**

Create `src/lib/reflectionLines.js`:
```js
// Reflection-screen line generators. Each signal renders as:
//   { signal: <what we observed>, interpretation: <what it points to> }.
// Designed to be read line-by-line on cream paper, italic serif.

function dominantSide(pairs) {
  let left = 0, right = 0
  const labels = { left: [], right: [] }
  for (const p of pairs) {
    if (p.choice === 'left') { left++; labels.left.push(p.label) }
    if (p.choice === 'right') { right++; labels.right.push(p.label) }
  }
  if (right >= left) return { count: right, total: pairs.length, side: 'right', samples: labels.right }
  return { count: left, total: pairs.length, side: 'left', samples: labels.left }
}

function buildSpectrumLine(phaseData) {
  const pairs = phaseData.spectrum?.pairs || []
  if (pairs.length === 0) {
    return {
      signal: 'no spectrum data',
      interpretation: 'a blank page is also a kind of answer',
    }
  }
  const dom = dominantSide(pairs)
  const sample = dom.samples[0] || 'a word'
  const otherSample = dom.samples[1] || ''
  const examples = otherSample ? `${sample}, ${otherSample}` : sample

  return {
    signal: `${examples} chosen ${dom.count} of ${dom.total} times`,
    interpretation: `you favor ${examples.split(',')[0]} — your hand keeps reaching the same way`,
  }
}

function buildDepthLine(phaseData) {
  const layer = phaseData.depth?.finalLayer || 1
  let interp
  if (layer <= 2) interp = 'you stayed close to the surface — repetition was a kind of refuge'
  else if (layer <= 5) interp = 'you went in until the room had shape'
  else interp = 'you stayed until the layers stopped arriving'

  return {
    signal: `you held ${layer} of 8 layers`,
    interpretation: interp,
  }
}

function buildTexturesLine(phaseData) {
  const kept = phaseData.textures?.preferred || []
  if (kept.length === 0) {
    return {
      signal: 'no textures kept',
      interpretation: 'you let everything go — spareness is also a kind of taste',
    }
  }
  const list = kept.slice(0, 3).join(', ')
  const interp = kept.length === 1
    ? `you only kept ${list} — that means something`
    : `you kept ${list} — these are the ones you'll come back to`
  return {
    signal: `kept: ${list}`,
    interpretation: interp,
  }
}

function buildMomentLine(phaseData) {
  const peak = phaseData.moment?.peakTapRate || 0
  // peakTapRate is taps/sec → BPM
  const bpm = Math.max(40, Math.round(peak * 60))
  let interp
  if (bpm < 70) interp = 'a contemplative pace — the tempo of a long thought'
  else if (bpm < 100) interp = 'a walking pace — measured, deliberate'
  else if (bpm < 130) interp = 'a steady drive — the tempo of moving forward'
  else interp = 'a quickened pulse — the tempo of something arriving'

  return {
    signal: `your tap tempo: ${bpm} BPM`,
    interpretation: interp,
  }
}

export function buildReflectionLines(avd, phaseData) {
  return {
    spectrum: buildSpectrumLine(phaseData),
    depth: buildDepthLine(phaseData),
    textures: buildTexturesLine(phaseData),
    moment: buildMomentLine(phaseData),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/__tests__/reflectionLines.test.js`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reflectionLines.js src/lib/__tests__/reflectionLines.test.js
git commit -m "feat(score-v2): add reflection-line generators for signal read-back"
```

---

## Task 5: Build the Mirror line generators (forer + memory + time-of-day + temporal frame)

**Files:**
- Create: `src/lib/forerLines.js`
- Create: `src/lib/__tests__/forerLines.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/forerLines.test.js`:
```js
import { describe, it, expect } from 'vitest'
import {
  buildBecauseLine,
  buildMemoryCallback,
  buildTimeOfDayLine,
  buildLatencyLine,
  buildTemporalFrame,
} from '../forerLines'

const fakePhaseData = (overrides = {}) => ({
  spectrum: {
    pairs: [
      { choice: 'right', label: 'warmth', reactionMs: 2200 },
      { choice: 'right', label: 'shimmer', reactionMs: 1800 },
      { choice: 'left', label: 'weight', reactionMs: 3000 },
    ],
    hoveredButNotChosen: [],
  },
  depth: { finalLayer: 5 },
  textures: { preferred: ['strings'], rejected: [], neutral: [] },
  moment: { totalTaps: 14, peakTapRate: 1.4 },
  ...overrides,
})

describe('buildBecauseLine', () => {
  it('returns an array of 3 short fragments', () => {
    const fragments = buildBecauseLine(fakePhaseData())
    expect(fragments).toHaveLength(3)
    for (const f of fragments) {
      expect(typeof f).toBe('string')
      expect(f.toLowerCase().startsWith('because')).toBe(true)
    }
  })

  it('mentions a real spectrum word, the depth, and a tempo descriptor', () => {
    const fragments = buildBecauseLine(fakePhaseData())
    const joined = fragments.join(' ').toLowerCase()
    expect(joined).toContain('warmth')
  })
})

describe('buildMemoryCallback', () => {
  it('returns a string that names a kept texture or chosen word', () => {
    const line = buildMemoryCallback(fakePhaseData())
    expect(typeof line).toBe('string')
    expect(line.toLowerCase()).toMatch(/strings|warmth|shimmer/)
  })

  it('returns null when no texture is kept and no spectrum pair has a label', () => {
    const line = buildMemoryCallback({
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0 },
    })
    expect(line).toBeNull()
  })
})

describe('buildTimeOfDayLine', () => {
  it('returns a late-hour line at midnight', () => {
    const at = new Date('2026-05-08T23:30:00')
    expect(buildTimeOfDayLine(at).toLowerCase()).toContain('hour')
  })

  it('returns an early-morning line at 6am', () => {
    const at = new Date('2026-05-08T06:30:00')
    expect(buildTimeOfDayLine(at).toLowerCase()).toMatch(/early|got here/)
  })

  it('returns a midday line at noon', () => {
    const at = new Date('2026-05-08T12:30:00')
    expect(buildTimeOfDayLine(at).toLowerCase()).toContain('middle')
  })

  it('returns an evening line at 8pm', () => {
    const at = new Date('2026-05-08T20:00:00')
    expect(typeof buildTimeOfDayLine(at)).toBe('string')
  })
})

describe('buildLatencyLine', () => {
  it('returns a "took your time" line for slow average reaction', () => {
    const phaseData = fakePhaseData({
      spectrum: {
        pairs: [{ reactionMs: 4000 }, { reactionMs: 4500 }, { reactionMs: 5000 }],
        hoveredButNotChosen: [],
      },
    })
    expect(buildLatencyLine(phaseData).toLowerCase()).toContain('time')
  })

  it('returns a "knew what you wanted" line for fast average reaction', () => {
    const phaseData = fakePhaseData({
      spectrum: {
        pairs: [{ reactionMs: 1200 }, { reactionMs: 1100 }, { reactionMs: 1000 }],
        hoveredButNotChosen: [],
      },
    })
    expect(buildLatencyLine(phaseData).toLowerCase()).toMatch(/knew|certain|wanted/)
  })

  it('returns null for empty data', () => {
    expect(buildLatencyLine({
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0 },
    })).toBeNull()
  })
})

describe('buildTemporalFrame', () => {
  it('formats the time and date and includes "Has never existed before"', () => {
    const at = new Date('2026-05-08T23:47:00')
    const line = buildTemporalFrame(at)
    expect(line).toContain('11:47')
    expect(line).toContain('2026')
    expect(line.toLowerCase()).toContain('never existed before')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/forerLines.test.js`
Expected: FAIL — "Cannot find module '../forerLines'"

- [ ] **Step 3: Implement `src/lib/forerLines.js`**

Create `src/lib/forerLines.js`:
```js
// Mirror copy generators. All functions take phaseData (and optionally `now` Date)
// and return strings rendered during the Mirror beat in Reveal.

function dominantSpectrumLabel(pairs) {
  if (!pairs?.length) return null
  const counts = {}
  for (const p of pairs) {
    if (!p.label) continue
    counts[p.label] = (counts[p.label] || 0) + 1
  }
  let topLabel = null, topCount = 0
  for (const [k, v] of Object.entries(counts)) {
    if (v > topCount) { topCount = v; topLabel = k }
  }
  return topLabel
}

function tempoDescriptor(peakTapRate) {
  const bpm = Math.max(40, Math.round((peakTapRate || 0) * 60))
  if (bpm < 70) return 'tapped slow'
  if (bpm < 100) return 'kept a walking pulse'
  if (bpm < 130) return 'tapped with momentum'
  return 'tapped fast'
}

function depthDescriptor(layer) {
  if (layer <= 2) return 'stayed close to the surface'
  if (layer <= 5) return 'went past the surface'
  return 'held all the way down'
}

export function buildBecauseLine(phaseData) {
  const label = dominantSpectrumLabel(phaseData.spectrum?.pairs) || 'a word'
  const layer = phaseData.depth?.finalLayer || 1
  const peak = phaseData.moment?.peakTapRate || 0

  return [
    `because you chose ${label}`,
    `because you ${depthDescriptor(layer)}`,
    `because you ${tempoDescriptor(peak)}`,
  ]
}

export function buildMemoryCallback(phaseData) {
  const kept = phaseData.textures?.preferred || []
  if (kept.length > 0) {
    const t = kept[0]
    return `the way you held onto ${t} — i made sure it stayed`
  }
  const label = dominantSpectrumLabel(phaseData.spectrum?.pairs)
  if (label) {
    return `you said ${label} more than once. i listened.`
  }
  return null
}

export function buildTimeOfDayLine(now = new Date()) {
  const hour = now.getHours()
  if (hour >= 23 || hour < 4) {
    return 'you came to me at this hour. that means something.'
  }
  if (hour >= 4 && hour < 9) {
    return 'you got here early. most people sleep through this.'
  }
  if (hour >= 11 && hour < 14) {
    return 'the middle of the day is hard for music. you came anyway.'
  }
  if (hour >= 18 && hour < 23) {
    return 'the light is going. that helps.'
  }
  return 'this hour suits you.'
}

export function buildLatencyLine(phaseData) {
  const pairs = phaseData.spectrum?.pairs || []
  if (pairs.length === 0) return null
  const total = pairs.reduce((s, p) => s + (p.reactionMs || 0), 0)
  const avg = total / pairs.length
  if (avg > 3500) return 'you took your time. that\'s what i needed from you.'
  if (avg < 1500) return 'you knew what you wanted. that helped.'
  return null
}

function pad2(n) { return n < 10 ? `0${n}` : `${n}` }

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function buildTemporalFrame(now = new Date()) {
  const h24 = now.getHours()
  const min = now.getMinutes()
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = ((h24 % 12) || 12)
  const time = `${h12}:${pad2(min)} ${period}`
  const date = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
  return `Composed at ${time} on ${date}. Has never existed before.`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/__tests__/forerLines.test.js`
Expected: 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/forerLines.js src/lib/__tests__/forerLines.test.js
git commit -m "feat(score-v2): add Mirror line generators (because/memory/time-of-day/temporal)"
```

---

## Task 6: Extend AVDEngine to track hover-without-commit in Spectrum

**Files:**
- Modify: `src/engine/avd.js:8-13` (constructor `phaseData`), `src/engine/avd.js:218-223` (`reset` `phaseData`)

- [ ] **Step 1: Inspect current `phaseData.spectrum` shape**

Read `src/engine/avd.js` lines 8–13. Current default: `spectrum: { pairs: [] }`. We're adding `hoveredButNotChosen: []`.

- [ ] **Step 2: Extend constructor `phaseData` default**

In `src/engine/avd.js`, find the constructor block:
```js
this.phaseData = {
  spectrum: { pairs: [] },
  depth: { finalLayer: 1, maxLayer: 1, reEngaged: false },
  textures: { preferred: [], rejected: [], neutral: [] },
  moment: { totalTaps: 0, tapsDuringBuild: 0, preDropSilence: false, tapsDuringRelease: 0, peakTapRate: 0 },
}
```

Replace with:
```js
this.phaseData = {
  spectrum: { pairs: [], hoveredButNotChosen: [] },
  depth: { finalLayer: 1, maxLayer: 1, reEngaged: false },
  textures: { preferred: [], rejected: [], neutral: [] },
  moment: { totalTaps: 0, tapsDuringBuild: 0, preDropSilence: false, tapsDuringRelease: 0, peakTapRate: 0 },
}
```

- [ ] **Step 3: Mirror the change in `reset()`**

In `src/engine/avd.js`, find the `reset()` method's `phaseData` block (lines ~219–223). Make the same edit there: change `spectrum: { pairs: [] },` to `spectrum: { pairs: [], hoveredButNotChosen: [] },`.

- [ ] **Step 4: Verify with a quick manual check**

Run: `npm run dev` and open the browser console. Type:
```js
window.__avd ??= (await import('/src/engine/avd.js')).avdEngine
window.__avd.getPhaseData().spectrum
```
Expected output: `{ pairs: [], hoveredButNotChosen: [] }`. (If this is awkward, skip — the next task's logging will exercise the field.)

- [ ] **Step 5: Commit**

```bash
git add src/engine/avd.js
git commit -m "feat(score-v2): track hoveredButNotChosen in spectrum phaseData"
```

---

## Task 7: Log hover-without-commit + add operational-transparency comment in Spectrum

**Files:**
- Modify: `src/phases/Spectrum.score.jsx`

- [ ] **Step 1: Add hover-without-commit logging refs**

In `src/phases/Spectrum.score.jsx`, locate the ref block at the top of the component (around line 55–67). Add two new refs after `firstHovered`:
```js
const hoveredButNotChosen = useRef([])
const hoverEnterTime = useRef(null)
```

- [ ] **Step 2: Detect hover-then-cancel events in the rAF loop**

Find the rAF loop in `src/phases/Spectrum.score.jsx` (around lines 205–270). Locate this block where commit progress is reset when the user un-leans:
```js
} else {
  leanSideRef.current = null
  leanStartRef.current = null
  setCommitProgress(0)
  setCommitSide(null)
}
```

Replace with:
```js
} else {
  // If the user was leaning past threshold and then released without locking,
  // record a hover-without-commit event.
  if (leanSideRef.current && leanStartRef.current && hoverEnterTime.current) {
    const dwellMs = Date.now() - hoverEnterTime.current
    if (dwellMs > 400) {
      hoveredButNotChosen.current.push({
        pair: pairIdx + 1,
        side: leanSideRef.current,
        label: leanSideRef.current === 'left' ? pair.left : pair.right,
        dwellMs,
      })
    }
  }
  leanSideRef.current = null
  leanStartRef.current = null
  hoverEnterTime.current = null
  setCommitProgress(0)
  setCommitSide(null)
}
```

Then locate the block where `leanSideRef.current = side` is set (when entering threshold). It looks like:
```js
if (Math.abs(position) > LEAN_THRESHOLD) {
  const side = position < 0 ? 'left' : 'right'
  if (leanSideRef.current !== side) {
    leanSideRef.current = side
    leanStartRef.current = Date.now()
  }
```

Add `hoverEnterTime` capture inside the side-change branch:
```js
if (Math.abs(position) > LEAN_THRESHOLD) {
  const side = position < 0 ? 'left' : 'right'
  if (leanSideRef.current !== side) {
    leanSideRef.current = side
    leanStartRef.current = Date.now()
    hoverEnterTime.current = Date.now()
  }
```

- [ ] **Step 3: Persist the array on phase finish**

In the `lockChoice` callback, locate the final block that runs after the last pair:
```js
} else {
  playVoice(VOICE_PATHS[3])
  avd.setPhaseData('spectrum', { pairs: results.current })
  setTimeout(() => onNext({ spectrum: results.current }), 1500)
}
```

Replace with:
```js
} else {
  playVoice(VOICE_PATHS[3])
  avd.setPhaseData('spectrum', {
    pairs: results.current,
    hoveredButNotChosen: hoveredButNotChosen.current,
  })
  setTimeout(() => onNext({ spectrum: results.current }), 1500)
}
```

- [ ] **Step 4: Add the operational-transparency comment**

Add a new `useState` to track the transparency comment near the other `useState` declarations (around lines 48–54):
```js
const [transparencyComment, setTransparencyComment] = useState(null)
```

In the `lockChoice` callback, after `setMarks(prev => [...prev, { x: markX, dip }])`, add:
```js
// Operational-transparency comment after pair 4 commits.
// Computes a directional tally (warm/dense/sung axes) and surfaces one Forer-y line.
if (completedPair === 4) {
  // Tally V deltas to figure out warm vs cold lean
  const warmCount = results.current.filter(r => r.coord.v > 0.5).length
  const coldCount = results.current.filter(r => r.coord.v < 0.5).length
  let comment = null
  if (warmCount >= 3) comment = 'you\'re choosing the warmer ones — interesting'
  else if (coldCount >= 3) comment = 'you\'re leaning into shadow — i see it'
  else comment = 'you\'re holding the middle. that\'s also a choice.'
  setTransparencyComment(comment)
  setTimeout(() => setTransparencyComment(null), 3500)
}
```

Then render it in the JSX. Find the existing "Hint" block near the bottom and add a sibling block above the closing `</div>`:
```jsx
{/* Operational-transparency comment after pair 4 */}
{transparencyComment && (
  <motion.div
    style={{
      position: 'absolute',
      top: '60%',
      left: 24,
      right: 24,
      textAlign: 'center',
      fontFamily: FONTS.serif,
      fontStyle: 'italic',
      fontSize: 13,
      color: COLORS.scoreAmber,
      lineHeight: 1.7,
    }}
    initial={{ opacity: 0 }}
    animate={{ opacity: 0.85 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.6 }}
  >
    {transparencyComment}
  </motion.div>
)}
```

- [ ] **Step 5: Verify in dev server**

Run: `npm run dev`
Open the app at `http://localhost:5173/?phase=spectrum`. Lock 4 pair choices. Expected:
- After pair 4 commits, an italic amber line appears for ~3.5s near the bottom-middle of the screen.
- Open DevTools console; type `(await import('/src/engine/avd.js')).avdEngine.getPhaseData().spectrum.hoveredButNotChosen` after deliberately hovering past threshold and pulling back. Expected: an array with at least one entry containing `{ pair, side, label, dwellMs }`.

- [ ] **Step 6: Commit**

```bash
git add src/phases/Spectrum.score.jsx
git commit -m "feat(score-v2): log hover-without-commit + add transparency comment after pair 4"
```

---

## Task 8: Build the Reflection phase component

**Files:**
- Create: `src/phases/Reflection.score.jsx`

- [ ] **Step 1: Create the component skeleton**

Create `src/phases/Reflection.score.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { buildReflectionLines } from '../lib/reflectionLines'

const LINE_FADE_MS = 1200
const LINE_HOLD_MS = 1700  // time between line appearances
const LINES_TOTAL = 4
const HOLD_AFTER_LAST_MS = 2200

export default function Reflection({ onNext, avd }) {
  const [lines] = useState(() => {
    const avdValues = avd.getAVD()
    const phaseData = avd.getPhaseData()
    const built = buildReflectionLines(avdValues, phaseData)
    return [
      built.spectrum,
      built.depth,
      built.textures,
      built.moment,
    ]
  })
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    const timers = []
    for (let i = 0; i < LINES_TOTAL; i++) {
      timers.push(setTimeout(() => setVisibleCount(i + 1), i * LINE_HOLD_MS + 600))
    }
    timers.push(setTimeout(() => onNext(), LINES_TOTAL * LINE_HOLD_MS + HOLD_AFTER_LAST_MS))
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Paper variant="cream">
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 32px',
        gap: 28,
      }}>
        <motion.div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: COLORS.inkCreamSecondary,
            letterSpacing: '0.18em',
            marginBottom: 12,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 0.8 }}
        >
          v. what i heard
        </motion.div>

        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{
              opacity: visibleCount > i ? 1 : 0,
              y: visibleCount > i ? 0 : 6,
            }}
            transition={{ duration: LINE_FADE_MS / 1000, ease: 'easeOut' }}
          >
            <div style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 16,
              color: COLORS.inkCream,
              lineHeight: 1.5,
            }}>
              {line.signal}
            </div>
            <div style={{
              fontFamily: FONTS.serif,
              fontSize: 13,
              color: COLORS.inkCreamSecondary,
              marginTop: 6,
              lineHeight: 1.6,
            }}>
              {line.interpretation}
            </div>
          </motion.div>
        ))}
      </div>
    </Paper>
  )
}
```

- [ ] **Step 2: Wire into App.jsx PHASES**

Open `src/App.jsx`. Locate:
```jsx
import Reveal from './phases/Reveal.score'
```
Add directly above:
```jsx
import Reflection from './phases/Reflection.score'
```

Locate the PHASES constant:
```js
const PHASES = ['entry', 'spectrum', 'depth', 'textures', 'moment', 'reveal', 'orchestra']
```
Replace with:
```js
const PHASES = ['entry', 'spectrum', 'depth', 'textures', 'moment', 'reflection', 'reveal', 'orchestra']
```

Locate the `phaseComponent` map. Add after `moment:` and before `reveal:`:
```jsx
reflection: <Reflection onNext={nextPhase} avd={avdEngine} />,
```

- [ ] **Step 3: Verify in dev server**

Run: `npm run dev`
Open `http://localhost:5173/?phase=reflection` directly. Expected:
- Cream paper with italic header `v. what i heard`.
- Four lines fade in sequentially (~1.7s apart). Each shows a stronger italic signal line and a smaller secondary interpretation line below it.
- After all four are visible + ~2.2s, advances to `reveal` (which currently still has its assembling stage — we'll restructure it in Task 10).

(If the AVD state is empty because we jumped straight to `reflection`, the lines will use the fallback strings — that's fine for now.)

For a real end-to-end check, navigate from `?phase=spectrum`, complete spectrum, depth, textures, moment, then arrive at reflection. Confirm the lines reference your real choices.

- [ ] **Step 4: Commit**

```bash
git add src/phases/Reflection.score.jsx src/App.jsx
git commit -m "feat(score-v2): add Reflection phase — line-by-line signal read-back"
```

---

## Task 9: Build the Mirror component

**Files:**
- Create: `src/phases/Mirror.score.jsx`

- [ ] **Step 1: Create the component**

Mirror is a *component* (not a top-level phase) used inside `Reveal.score.jsx`. It runs ~25s of staged content, then invokes `onComplete()`. It also invokes `onSubAudibleStart()` partway through so the parent can begin the track fade-up beneath the Forer read.

Create `src/phases/Mirror.score.jsx`:
```jsx
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { scoreArchetype } from '../lib/scoreArchetype'
import { getArchetype, getVariation } from '../lib/archetypes'
import {
  buildBecauseLine,
  buildMemoryCallback,
  buildTimeOfDayLine,
  buildLatencyLine,
  buildTemporalFrame,
} from '../lib/forerLines'

// Stage timing (ms from Mirror mount):
//   t=0      : archetype name fades in
//   t=3000   : variation/microgenre line fades in
//   t=4500   : because-you band fades in (3 fragments)
//   t=8000   : Forer paragraph begins (3 sentences fading in over ~10s)
//   t=8000   : trigger sub-audible track fade-up
//   t=18000  : memory callback fades in
//   t=20500  : time-of-day OR latency line fades in
//   t=22500  : temporal frame fades in (small, mono)
//   t=25000  : onComplete()
const T = {
  variation: 3000,
  because: 4500,
  forer: 8000,
  forerSentences: [8000, 11200, 14400],
  subAudibleStart: 8000,
  memory: 18000,
  passive: 20500,
  temporal: 22500,
  complete: 25000,
}

export default function Mirror({ avd, onComplete, onSubAudibleStart }) {
  const result = useMemo(() => {
    const avdValues = avd.getAVD()
    const phaseData = avd.getPhaseData()
    const scored = scoreArchetype(avdValues, phaseData)
    const archetype = getArchetype(scored.archetypeId)
    const variation = getVariation(scored.archetypeId, scored.variationId)
    const becauseFragments = buildBecauseLine(phaseData)
    const memoryLine = buildMemoryCallback(phaseData)
    const latencyLine = buildLatencyLine(phaseData)
    const timeOfDayLine = buildTimeOfDayLine(new Date())
    // Prefer latency line if available (more uncannily specific); else time-of-day.
    const passiveLine = latencyLine || timeOfDayLine
    const temporalFrame = buildTemporalFrame(new Date())
    return {
      archetype,
      variation,
      becauseFragments,
      memoryLine,
      passiveLine,
      temporalFrame,
    }
  }, [avd])

  const [visible, setVisible] = useState({
    archetype: false,
    variation: false,
    because: false,
    forerSentences: [false, false, false],
    memory: false,
    passive: false,
    temporal: false,
  })

  useEffect(() => {
    const timers = []
    const at = (ms, fn) => timers.push(setTimeout(fn, ms))

    at(200, () => setVisible(v => ({ ...v, archetype: true })))
    at(T.variation, () => setVisible(v => ({ ...v, variation: true })))
    at(T.because, () => setVisible(v => ({ ...v, because: true })))
    T.forerSentences.forEach((t, i) => at(t, () => setVisible(v => {
      const next = [...v.forerSentences]
      next[i] = true
      return { ...v, forerSentences: next }
    })))
    at(T.subAudibleStart, () => onSubAudibleStart && onSubAudibleStart())
    at(T.memory, () => setVisible(v => ({ ...v, memory: true })))
    at(T.passive, () => setVisible(v => ({ ...v, passive: true })))
    at(T.temporal, () => setVisible(v => ({ ...v, temporal: true })))
    at(T.complete, () => onComplete && onComplete())

    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!result.archetype) return null
  const { archetype, variation, becauseFragments, memoryLine, passiveLine, temporalFrame } = result
  const forerSentences = archetype.forerTemplate

  return (
    <Paper variant="cream">
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '40px 28px',
        gap: 18,
      }}>
        {/* Archetype name */}
        <motion.h2
          style={{
            fontFamily: FONTS.serif,
            fontSize: 30,
            color: COLORS.inkCream,
            lineHeight: 1.1,
            margin: 0,
            letterSpacing: '0.01em',
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: visible.archetype ? 1 : 0, y: visible.archetype ? 0 : 8 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        >
          {archetype.displayName}
        </motion.h2>

        {/* Variation microgenre label */}
        <motion.div
          style={{
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 14,
            color: COLORS.inkCreamSecondary,
            marginTop: -8,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: visible.variation ? 0.85 : 0 }}
          transition={{ duration: 1.2 }}
        >
          {variation.microgenreLabel}
        </motion.div>

        {/* Because-you band */}
        <motion.div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 12,
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: COLORS.scoreAmber,
            letterSpacing: '0.08em',
            textTransform: 'lowercase',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: visible.because ? 0.9 : 0 }}
          transition={{ duration: 1.0 }}
        >
          {becauseFragments.map((f, i) => (
            <span key={i}>{f}{i < becauseFragments.length - 1 ? ' · ' : ''}</span>
          ))}
        </motion.div>

        {/* Forer paragraph — 3 sentences staggered */}
        <div style={{ marginTop: 20 }}>
          {forerSentences.map((s, i) => (
            <motion.p
              key={i}
              style={{
                fontFamily: FONTS.serif,
                fontSize: 17,
                fontStyle: 'italic',
                color: COLORS.inkCream,
                lineHeight: 1.5,
                marginBottom: 14,
              }}
              initial={{ opacity: 0, y: 4 }}
              animate={{
                opacity: visible.forerSentences[i] ? 1 : 0,
                y: visible.forerSentences[i] ? 0 : 4,
              }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
            >
              {s}
            </motion.p>
          ))}
        </div>

        {/* Memory callback */}
        {memoryLine && (
          <motion.p
            style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 14,
              color: COLORS.inkCreamSecondary,
              lineHeight: 1.5,
              marginTop: 8,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: visible.memory ? 0.85 : 0 }}
            transition={{ duration: 1.2 }}
          >
            {memoryLine}
          </motion.p>
        )}

        {/* Passive line (latency or time-of-day) */}
        {passiveLine && (
          <motion.p
            style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 13,
              color: COLORS.inkCreamSecondary,
              lineHeight: 1.5,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: visible.passive ? 0.7 : 0 }}
            transition={{ duration: 1.0 }}
          >
            {passiveLine}
          </motion.p>
        )}

        {/* Temporal-uniqueness frame */}
        <motion.p
          style={{
            position: 'absolute',
            bottom: 28,
            left: 28,
            right: 28,
            textAlign: 'center',
            fontFamily: FONTS.mono,
            fontSize: 9,
            color: COLORS.inkCreamSecondary,
            letterSpacing: '0.08em',
            margin: 0,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: visible.temporal ? 0.55 : 0 }}
          transition={{ duration: 1.2 }}
        >
          {temporalFrame}
        </motion.p>
      </div>
    </Paper>
  )
}
```

- [ ] **Step 2: Visual smoke test**

Mirror is rendered inside Reveal in the next task — for now, verify the file lints cleanly:
```bash
npm run lint -- src/phases/Mirror.score.jsx
```
Expected: PASS (no errors). Warnings about unused imports are fine.

- [ ] **Step 3: Commit**

```bash
git add src/phases/Mirror.score.jsx
git commit -m "feat(score-v2): add Mirror component (archetype + Forer + memory + temporal)"
```

---

## Task 10: Restructure Reveal — replace assembling stage with Mirror beat

**Files:**
- Modify: `src/phases/Reveal.score.jsx`

- [ ] **Step 1: Replace the stage flow**

Open `src/phases/Reveal.score.jsx`. The current stage flow is `computing → assembling → listening → done`. We replace `assembling` with `mirror`. The score-paper assembly visuals are removed (their job is done in Reflection now). The track audio element creation stays here — Mirror calls `onSubAudibleStart()` partway through, which we use to begin the track fade-up.

Replace the entire file contents with:
```jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import Mirror from './Mirror.score'
import { COLORS, FONTS } from '../score/tokens'
import { playVoice, preloadVoices } from '../score/voice'

const VOICE_PATHS = [
  '/chamber/voices/score/reveal-05.mp3',  // "Listen to what it sounds like."
  '/chamber/voices/score/reveal-06.mp3',  // "Made by an algorithm. Read by you. Held by you."
]

const SUB_AUDIBLE_FADE_MS = 9000   // gradual fade-up from ~0 → 0.05 during Forer
const FULL_VOLUME_FADE_MS = 1800   // jump from sub-audible → 0.8 when listening begins
const SUB_AUDIBLE_TARGET = 0.05
const FULL_VOLUME_TARGET = 0.8

export default function Reveal({ onNext, avd, sessionData, revealAudioRef }) {
  const [stage, setStage] = useState('computing')

  const audioRef = useRef(null)
  const advancedRef = useRef(false)
  const fadeRafRef = useRef(null)

  useEffect(() => {
    preloadVoices(VOICE_PATHS)

    const promise = sessionData?.musicPromise
    if (!promise) {
      setStage('mirror')
      return
    }

    promise.then(url => {
      const audio = new Audio(url)
      audio.volume = 0
      audio.loop = true
      audioRef.current = audio
      if (revealAudioRef) revealAudioRef.current = audio
      setStage('mirror')
    }).catch(() => {
      setStage('mirror')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fadeAudio = useCallback((targetVolume, durationMs) => {
    if (!audioRef.current) return
    const audio = audioRef.current
    if (audio.paused) audio.play().catch(() => {})
    const start = audio.volume
    const t0 = performance.now()
    if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current)
    const loop = (t) => {
      const p = Math.min(1, (t - t0) / durationMs)
      audio.volume = start + (targetVolume - start) * p
      if (p < 1) fadeRafRef.current = requestAnimationFrame(loop)
    }
    fadeRafRef.current = requestAnimationFrame(loop)
  }, [])

  const handleSubAudibleStart = useCallback(() => {
    fadeAudio(SUB_AUDIBLE_TARGET, SUB_AUDIBLE_FADE_MS)
  }, [fadeAudio])

  const handleMirrorComplete = useCallback(() => {
    setStage('listening')
    fadeAudio(FULL_VOLUME_TARGET, FULL_VOLUME_FADE_MS)
    setTimeout(() => playVoice(VOICE_PATHS[0]), 1500)  // "Listen to what it sounds like."

    // Detect first play-through completion or safety ceiling.
    if (audioRef.current) {
      let revealTriggered = false
      let maxTime = 0
      const checkLoop = () => {
        if (revealTriggered || !audioRef.current) return
        const a = audioRef.current
        if (a.currentTime > maxTime) maxTime = a.currentTime
        if (a.duration && a.currentTime >= a.duration - 0.5) {
          revealTriggered = true
          finishReveal()
          return
        }
        if (maxTime > 5 && a.currentTime < maxTime - 2) {
          revealTriggered = true
          finishReveal()
          return
        }
        requestAnimationFrame(checkLoop)
      }
      setTimeout(() => requestAnimationFrame(checkLoop), 8000)
    }
    // Safety ceiling
    setTimeout(() => finishReveal(), 65000)
  }, [fadeAudio]) // eslint-disable-line react-hooks/exhaustive-deps

  const finishReveal = useCallback(() => {
    if (advancedRef.current) return
    advancedRef.current = true
    setStage('done')

    const currentAVD = avd.getAVD()
    const session = {
      sessionId: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      avd: currentAVD,
      phases: avd.getPhaseData(),
      selectedTrack: 'procedural',
      sunoPrompt: avd.getPrompt(),
    }
    try {
      localStorage.setItem('postlistener_session', JSON.stringify(session))
      const sessions = JSON.parse(localStorage.getItem('postlistener_sessions') || '[]')
      sessions.push(session)
      localStorage.setItem('postlistener_sessions', JSON.stringify(sessions))
    } catch (e) { /* storage full */ }

    playVoice(VOICE_PATHS[1])
    setTimeout(() => onNext(), 3000)
  }, [avd, onNext])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {stage === 'computing' && (
        <Paper variant="cream">
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 16,
              color: COLORS.inkCreamSecondary,
            }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            composing your score...
          </motion.div>
        </Paper>
      )}

      {stage === 'mirror' && (
        <Mirror
          avd={avd}
          onSubAudibleStart={handleSubAudibleStart}
          onComplete={handleMirrorComplete}
        />
      )}

      {(stage === 'listening' || stage === 'done') && (
        <Paper variant="cream">
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 32px',
              textAlign: 'center',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            <div style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 16,
              color: COLORS.inkCream,
              lineHeight: 1.6,
            }}>
              listen to what it sounds like
            </div>
            <div style={{
              marginTop: 32,
              fontFamily: FONTS.mono,
              fontSize: 9,
              color: COLORS.inkCreamSecondary,
              letterSpacing: '0.1em',
            }}>
              vi. reveal
            </div>
          </motion.div>
        </Paper>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the full flow in dev server**

Run: `npm run dev`
Open `http://localhost:5173/?phase=spectrum`. Walk through: spectrum → depth → textures → moment → reflection (~10s of line read-back) → reveal (~25s Mirror beat: archetype name → variation → because-you band → 3 Forer sentences → memory line → passive line → temporal frame → song fades from sub-audible to full).

Verify:
- Reflection lines reflect your real choices.
- Mirror archetype matches your AVD profile (e.g. low-A high-D → Late-Night Architect).
- The variation microgenre label uses Daylist style.
- The "because you…" band shows three lowercase fragments separated by `·`.
- The Forer paragraph is one of the 6 templates.
- Memory callback names a real texture you kept (or a real spectrum word).
- The passive line is either a latency line or a time-of-day line.
- The temporal frame at the bottom shows current time/date and "Has never existed before."
- The track fades up sub-audibly during Forer, then comes to full volume when Mirror completes.

If the AI music generation hasn't returned by the time Mirror starts, Mirror will play silently and `audioRef.current` will be null — that's the existing fallback behavior preserved.

- [ ] **Step 3: Commit**

```bash
git add src/phases/Reveal.score.jsx
git commit -m "feat(score-v2): split Reveal — Mirror beat with sub-audible fade-up before song"
```

---

## Task 11: Final integration verification

**Files:** none (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: 32+ tests across `archetypes`, `scoreArchetype`, `reflectionLines`, `forerLines` all PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS (no errors). Warnings about unused vars in test fixtures are acceptable.

- [ ] **Step 3: Run a clean build**

Run: `npm run build`
Expected: build succeeds, outputs to `dist/`.

- [ ] **Step 4: Full end-to-end manual walkthrough**

Run: `npm run dev`
Walk through the full PostListener flow from `entry`. Specifically verify:

| Check | Expected |
|---|---|
| Spectrum operational-transparency comment | After completing pair 4, an italic amber line ("you're choosing the warmer ones — interesting" or similar) appears for ~3.5s. |
| Spectrum hover-without-commit | If you lean past threshold and pull back without locking, the event is logged. Verify in console: `(await import('/src/engine/avd.js')).avdEngine.getPhaseData().spectrum.hoveredButNotChosen.length > 0`. |
| Reflection phase | After Moment, a cream-paper screen appears with header `v. what i heard` and four lines fading in sequentially. Total duration ~10s. |
| Reflection lines reflect real data | The signal lines name real spectrum words, real depth layer count, real kept textures, and a real BPM. |
| Mirror archetype reveal | Reveal opens with the Mirror beat. Archetype display name appears first, then variation microgenre label. |
| Mirror because-you band | 3 lowercase amber fragments (e.g. `because you chose warmth · because you went past the surface · because you tapped slow`). |
| Mirror Forer paragraph | 3 italic sentences fading in over ~10s, matching the chosen archetype's template. |
| Mirror memory callback | A line referencing a real texture you kept (or a real spectrum word). Italic, smaller, secondary color. |
| Mirror passive line | Either a latency line ("you took your time…") or a time-of-day line. |
| Mirror temporal frame | Bottom-anchored mono line: `Composed at HH:MM AM/PM on Month D, YYYY. Has never existed before.` |
| Sub-audible fade-up | The track's volume slowly rises from 0 to ~0.05 during the Forer paragraph (8s in), then jumps to full when Mirror ends. |
| Listening → Orchestra | After song plays its first cycle (or 65s), advances to Orchestra phase — existing behavior preserved. |

- [ ] **Step 5: Final commit (any cleanup or stray fixes)**

If any small inconsistencies surfaced during E2E:
```bash
git add -p
git commit -m "fix(score-v2): polish Phase 1 reflection/mirror integration"
```

If nothing to fix, skip.

---

## Self-review checklist

Before handing off:

- [ ] Spec coverage:
  - Reflection screen → Task 8 ✓
  - Mirror beat (archetype + microgenre + because-you + Forer + memory + sub-audible fade-up) → Tasks 9 + 10 ✓
  - Spectrum operational-transparency comment → Task 7 ✓
  - Temporal-uniqueness frame → Task 9 (Mirror) ✓
  - Latency + hover-without-commit logging → Tasks 6 + 7 ✓
  - Time-of-day passive line → Tasks 5 + 9 ✓
- [ ] No placeholders ("TBD", "implement later", etc.) — all code blocks contain shippable code.
- [ ] Type/name consistency: `archetypeId`/`variationId` used uniformly; `phaseData.spectrum.hoveredButNotChosen` defined in Task 6 and used in Task 7; `onSubAudibleStart`/`onComplete` defined in Mirror (Task 9) and called from Reveal (Task 10) with matching names; `buildReflectionLines`/`scoreArchetype`/`buildBecauseLine` etc. all match between definition and import.
- [ ] Constraint compliance:
  - No new audio assets ✓
  - No backend changes ✓
  - No ElevenLabs integration ✓
  - Existing AVDEngine model preserved (only extended with `hoveredButNotChosen`) ✓
  - Phase flow preserved (Reflection inserted between moment and reveal; Mirror is a stage inside Reveal) ✓

---

## Out-of-scope notes (Phase 2 territory)

- Autobiographical bump module (3 song prompts) — not built in Phase 1; memory callback uses Spectrum/Texture data only.
- Replace Textures phase with GEMS discrete-emotion probe — Phase 2.
- Daylist microgenre tags are designed in (`archetypes.js`) but the variations themselves don't yet drive the audio composition plan — that's Phase 2/3 work.
- ElevenLabs Admirer voice across phases — Phase 3.
- Name capture for the temporal frame — currently the frame omits the name; in Phase 3 (Threshold rite) name capture lands and the frame becomes `For {name}.`.
