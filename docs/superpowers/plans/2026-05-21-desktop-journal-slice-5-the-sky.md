# Desktop Journal — Slice 5: The Sky — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the collective "sky" — a Mapbox GL globe of glyph-lights, the "rise to the field" transition from a book page, and geographic placement of the user's own entries.

**Architecture:** A new `CollectiveSky` component owns a Mapbox GL globe; it is mounted *inside* `Journal.jsx` and crossfaded with the book via the journal's existing rAF transition orchestrator + cloud veil. Location is captured server-side from Vercel geo headers (`api/geo`), coarsened to a 1° grid, and stored in the existing `entries.region` column. Three new pure modules (`geo.js`, `skyPresets.js`, `mockCollective.js`) carry the testable logic.

**Tech Stack:** React 19, Vite 7, `mapbox-gl` v3, Supabase, Vitest. Spec: `docs/superpowers/specs/2026-05-21-desktop-journal-slice-5-the-sky-design.md`.

---

## File Structure

**Create**
- `src/lib/geo.js` — pure geo helpers (coarsen, parse, jitter).
- `src/lib/skyPresets.js` — the rise camera presets (INTIMATE/EXPANDED).
- `src/lib/mockCollective.js` — the deterministic mock collective field.
- `src/journal/skyStyle.js` — the code-defined Mapbox dark style + fog.
- `src/journal/CollectiveSky.jsx` — the Mapbox globe component.
- `api/geo.js` — the Vercel geolocation endpoint.
- Tests: `src/lib/__tests__/geo.test.js`, `skyPresets.test.js`, `mockCollective.test.js`.

**Modify**
- `src/journal/Journal.jsx` — `view: 'sky'`, `rise`/`descend` transitions, mount `CollectiveSky`, the affordances.
- `src/hooks/useRiteSession.js` — best-effort `/api/geo` fetch; pass `region` to `createEntry`.
- `src/lib/entriesRepo.js` — `region` through `createEntry`/`fetchEntries`/`seedSampleEntries`.
- `src/lib/entryFormat.js` — `normalizeEntries` + `loadMockEntries` carry `region`.
- `src/journal/mockEntries.js` — each mock entry gains a `region`.
- `src/lib/__tests__/entryFormat.test.js` — region cases.
- `package.json` — `mapbox-gl` dependency.
- `CLAUDE.md`, `docs/desktop-journal-design.md` — status + reference updates.

**Unchanged:** `supabase/schema.sql` (the `region` column already exists), `vite.config.js` (the api middleware auto-discovers `api/geo.js`).

---

## Task 1: Add the mapbox-gl dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install mapbox-gl**

Run: `npm install mapbox-gl@^3.24.0`
Expected: `package.json` `dependencies` gains `"mapbox-gl": "^3.24.0"`; `package-lock.json` updates.

- [ ] **Step 2: Note the required env var**

`CollectiveSky` reads `import.meta.env.VITE_MAPBOX_TOKEN`. Before manual verification (Task 12) a free public token (`pk.*`) from https://account.mapbox.com must be added to `.env.local`:

```
VITE_MAPBOX_TOKEN=pk.your_token_here
```

No code action this step — the token is a user-supplied secret. The build and the test suite do not need it; the sky degrades cleanly without it.

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: build succeeds (mapbox-gl is installed but not yet imported anywhere).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add mapbox-gl dependency for the collective sky" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `geo.js` — pure geo helpers

**Files:**
- Create: `src/lib/geo.js`
- Test: `src/lib/__tests__/geo.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/geo.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { coarsenLocation, regionToLatLng, jitterInCell } from '../geo.js'

describe('coarsenLocation', () => {
  it('snaps a coordinate to the 1° grid as a "lat,lng" string', () => {
    expect(coarsenLocation(40.71, -74.01)).toBe('41,-74')
    expect(coarsenLocation(-23.55, -46.63)).toBe('-24,-47')
  })
  it('returns null for non-finite input', () => {
    expect(coarsenLocation(NaN, 10)).toBeNull()
    expect(coarsenLocation(10, undefined)).toBeNull()
  })
})

describe('regionToLatLng', () => {
  it('round-trips a coarsened region string', () => {
    expect(regionToLatLng('41,-74')).toEqual({ lat: 41, lng: -74 })
  })
  it('returns null for malformed input', () => {
    expect(regionToLatLng('')).toBeNull()
    expect(regionToLatLng('41')).toBeNull()
    expect(regionToLatLng('a,b')).toBeNull()
    expect(regionToLatLng(null)).toBeNull()
  })
})

describe('jitterInCell', () => {
  it('is deterministic for a given region + seed', () => {
    expect(jitterInCell('41,-74', 'entry-7')).toEqual(jitterInCell('41,-74', 'entry-7'))
  })
  it('places the point inside the 1° cell around the centre', () => {
    const p = jitterInCell('41,-74', 'entry-7')
    expect(Math.abs(p.lat - 41)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(p.lng - -74)).toBeLessThanOrEqual(0.5)
  })
  it('different seeds give different points', () => {
    expect(jitterInCell('41,-74', 'a')).not.toEqual(jitterInCell('41,-74', 'b'))
  })
  it('returns null for a malformed region', () => {
    expect(jitterInCell('nope', 'a')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- geo`
Expected: FAIL — `Failed to resolve import "../geo.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/geo.js`:

```js
/**
 * geo — pure geographic helpers for the collective sky (spec §3.2).
 *
 * Location is coarsened to a 1° grid (~100 km cells) so a stored region never
 * carries finer-than-city precision. jitterInCell de-stacks co-located
 * entries visually without narrowing that coarsening — the offset stays
 * inside the cell.
 */
import { mulberry32 } from './mulberry32.js'
import { hashText } from './textHash.js'

/**
 * Snap a coordinate to the 1° grid and return its cell-centre as a "lat,lng"
 * string — the value stored in entries.region. null for non-finite input.
 */
export function coarsenLocation(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return `${Math.round(lat)},${Math.round(lng)}`
}

/** Parse a stored "lat,lng" region string back to { lat, lng }. null if malformed. */
export function regionToLatLng(region) {
  if (typeof region !== 'string') return null
  const parts = region.split(',')
  if (parts.length !== 2) return null
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/**
 * Deterministic per-entry jitter of up to ±0.45° around the region's cell
 * centre — keeps co-located entries from stacking. The offset stays inside
 * the 1° cell, so coarsening is preserved. null if the region is malformed.
 */
export function jitterInCell(region, seed) {
  const center = regionToLatLng(region)
  if (!center) return null
  const intSeed = parseInt(hashText(String(seed ?? '')), 16) >>> 0
  const rand = mulberry32(intSeed)
  const dLat = (rand() - 0.5) * 0.9 // ±0.45° — safely inside the cell
  const dLng = (rand() - 0.5) * 0.9
  return { lat: center.lat + dLat, lng: center.lng + dLng }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- geo`
Expected: PASS — all 9 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.js src/lib/__tests__/geo.test.js
git commit -m "feat: add geo helpers — coarsen, parse, jitter (slice 5)" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `skyPresets.js` — the rise camera presets

**Files:**
- Create: `src/lib/skyPresets.js`
- Test: `src/lib/__tests__/skyPresets.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/skyPresets.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { INTIMATE, EXPANDED, easeExpansion } from '../skyPresets.js'

describe('skyPresets', () => {
  it('INTIMATE is a closer zoom than EXPANDED', () => {
    expect(INTIMATE.zoom).toBeGreaterThan(EXPANDED.zoom)
  })
  it('re-exports easeExpansion as a smoothstep (0->0, 1->1, 0.5->0.5)', () => {
    expect(easeExpansion(0)).toBe(0)
    expect(easeExpansion(1)).toBe(1)
    expect(easeExpansion(0.5)).toBeCloseTo(0.5, 5)
  })
  it('easeExpansion clamps out-of-range input to [0,1]', () => {
    expect(easeExpansion(-1)).toBe(0)
    expect(easeExpansion(2)).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- skyPresets`
Expected: FAIL — `Failed to resolve import "../skyPresets.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/skyPresets.js`:

```js
/**
 * skyPresets — the camera presets for the journal→collective "rise" (spec §4.3).
 *
 * Mirrors roomPresets.js: two named endpoints + the project's one canonical
 * expansion curve. The design doc (§7, §9) frames the whole desktop
 * transition as the INTIMATE ↔ EXPANDED interpolation; this is that pattern
 * applied to the globe camera. CollectiveSky feeds these two zoom endpoints
 * and the easing into a single Mapbox easeTo, which interpolates internally —
 * so unlike roomPresets there is no per-frame sampler here.
 */
import { easeExpansion } from './roomPresets.js'

// INTIMATE — the user's own cluster, close. EXPANDED — the whole turning globe.
export const INTIMATE = { zoom: 4.2 }
export const EXPANDED = { zoom: 1.4 }

export { easeExpansion }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- skyPresets`
Expected: PASS — 3 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skyPresets.js src/lib/__tests__/skyPresets.test.js
git commit -m "feat: add skyPresets — the rise camera endpoints (slice 5)" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `mockCollective.js` — the mock collective field

**Files:**
- Create: `src/lib/mockCollective.js`
- Test: `src/lib/__tests__/mockCollective.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/mockCollective.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { MOCK_COLLECTIVE, buildMockCollective } from '../mockCollective.js'

describe('mockCollective', () => {
  it('is deterministic — two builds are identical', () => {
    expect(buildMockCollective()).toEqual(buildMockCollective())
  })
  it('MOCK_COLLECTIVE holds a few hundred points', () => {
    expect(MOCK_COLLECTIVE.length).toBeGreaterThan(400)
    expect(MOCK_COLLECTIVE.length).toBeLessThan(800)
  })
  it('every point is a valid lat/lng', () => {
    for (const p of MOCK_COLLECTIVE) {
      expect(p.lat).toBeGreaterThanOrEqual(-90)
      expect(p.lat).toBeLessThanOrEqual(90)
      expect(p.lng).toBeGreaterThanOrEqual(-180)
      expect(p.lng).toBeLessThan(180)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- mockCollective`
Expected: FAIL — `Failed to resolve import "../mockCollective.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/mockCollective.js`:

```js
/**
 * mockCollective — a deterministic mock "field" of collective lights for the
 * sky (spec §6.1). Slice 5 has no real collective; Slice 6 replaces this.
 *
 * Real geography does the emergent-clustering for free: ~35 world-metro
 * anchors, each spawning a small jittered cluster. Built once at module load
 * from a fixed seed, so the field is identical across renders and reloads.
 */
import { mulberry32 } from './mulberry32.js'

// [lat, lng] of ~35 world metros — the clustering anchors.
const METROS = [
  [40.7, -74.0], [34.0, -118.2], [41.9, -87.6], [19.4, -99.1], [-23.5, -46.6],
  [-34.6, -58.4], [51.5, -0.1], [48.9, 2.3], [40.4, -3.7], [52.5, 13.4],
  [55.8, 37.6], [41.0, 28.9], [30.0, 31.2], [6.5, 3.4], [-26.2, 28.0],
  [-1.3, 36.8], [19.1, 72.9], [28.6, 77.2], [13.1, 80.3], [23.8, 90.4],
  [13.8, 100.5], [-6.2, 106.8], [1.4, 103.8], [22.3, 114.2], [31.2, 121.5],
  [39.9, 116.4], [37.6, 127.0], [35.7, 139.7], [-33.9, 151.2], [-37.8, 144.9],
  [-36.8, 174.8], [49.3, -123.1], [43.7, -79.4], [25.8, -80.2], [59.3, 18.1],
]

const SEED = 0x5c01dfee
const BASE_PER_METRO = 14

/** Build the deterministic mock field — a flat array of { lat, lng }. */
export function buildMockCollective() {
  const rand = mulberry32(SEED)
  const points = []
  for (const [lat, lng] of METROS) {
    const n = BASE_PER_METRO + Math.floor(rand() * 8) // 14..21 per metro
    for (let i = 0; i < n; i++) {
      // sum-of-two-uniforms → a soft gaussian-ish spread around the anchor
      const dLat = (rand() + rand() - 1) * 3.5
      const dLng = (rand() + rand() - 1) * 3.5
      points.push({
        lat: Math.max(-85, Math.min(85, lat + dLat)),
        lng: ((lng + dLng + 540) % 360) - 180,
      })
    }
  }
  return points
}

export const MOCK_COLLECTIVE = buildMockCollective()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- mockCollective`
Expected: PASS — 3 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mockCollective.js src/lib/__tests__/mockCollective.test.js
git commit -m "feat: add mockCollective — the mock sky field (slice 5)" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `api/geo.js` — the Vercel geolocation endpoint

**Files:**
- Create: `api/geo.js`

This is an IO route — not unit-tested (covered by manual verification, Task 12).

- [ ] **Step 1: Write the implementation**

Create `api/geo.js`:

```js
/**
 * api/geo — resolves the desktop's coarse location from Vercel's geolocation
 * request headers (spec §3.1).
 *
 * Coarsens server-side (rounds to the 1° grid — the same rule as
 * src/lib/geo.js coarsenLocation) so raw IP-precision coordinates never reach
 * the client. The coarsening is inlined rather than imported: api/ routes
 * can't import from src/ in Vercel without a build step (see api/admirer.js).
 *
 * Returns { region } — a "lat,lng" cell-centre string, or null when the
 * headers are absent (local dev) or unparseable.
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  const lat = Number(req.headers['x-vercel-ip-latitude'])
  const lng = Number(req.headers['x-vercel-ip-longitude'])
  const region =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `${Math.round(lat)},${Math.round(lng)}`
      : null
  res.statusCode = 200
  res.end(JSON.stringify({ region }))
}
```

- [ ] **Step 2: Verify the endpoint responds in dev**

Run: `npm run dev` in one shell, then in another:
`curl -sk https://localhost:5173/api/geo`
Expected: `{"region":null}` — local dev has no Vercel headers, so it degrades cleanly. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add api/geo.js
git commit -m "feat: add api/geo — coarse location from Vercel headers (slice 5)" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `region` through the data layer

**Files:**
- Modify: `src/journal/mockEntries.js`
- Modify: `src/lib/entryFormat.js`
- Modify: `src/lib/entriesRepo.js`
- Test: `src/lib/__tests__/entryFormat.test.js`

- [ ] **Step 1: Write the failing tests**

Append this block to `src/lib/__tests__/entryFormat.test.js` (the file already imports `describe`, `it`, `expect`, `normalizeEntries`, `loadMockEntries` — add any of those to the import line if missing):

```js
describe('region (slice 5)', () => {
  it('normalizeEntries carries region through', () => {
    const rows = [
      { id: 1, created_at: '2026-05-21T19:00:00.000Z', summary: 's', region: '41,-74' },
    ]
    expect(normalizeEntries(rows)[0].region).toBe('41,-74')
  })
  it('normalizeEntries defaults a missing region to null', () => {
    const rows = [{ id: 1, created_at: '2026-05-21T19:00:00.000Z', summary: 's' }]
    expect(normalizeEntries(rows)[0].region).toBeNull()
  })
  it('loadMockEntries places every mock entry with a region string', () => {
    for (const e of loadMockEntries()) {
      expect(typeof e.region).toBe('string')
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- entryFormat`
Expected: FAIL — `region` is `undefined`, not `'41,-74'` / not a string.

- [ ] **Step 3: Add a region to every mock entry**

Replace the `MOCK_ENTRIES` array in `src/journal/mockEntries.js` with (one person's "hand" — mostly one city, two travelled outliers):

```js
export const MOCK_ENTRIES = [
  { id: 10, date: 'may 21 · evening', summary: 'the late one — it settled where it wanted to', region: '41,-74' },
  { id: 9, date: 'may 14 · morning', summary: 'something with rain in it, and no hurry', region: '41,-74' },
  { id: 8, date: 'may 06 · night', summary: 'a louder room than usual', region: '34,-118' },
  { id: 7, date: 'apr 28 · afternoon', summary: 'the warm one came back around', region: '41,-74' },
  { id: 6, date: 'apr 19 · evening', summary: 'low and slow, a held breath', region: '41,-74' },
  { id: 5, date: 'apr 11 · morning', summary: 'brighter than i expected to be', region: '49,2' },
  { id: 4, date: 'apr 02 · night', summary: 'an old key, a near-quiet', region: '41,-74' },
  { id: 3, date: 'mar 25 · evening', summary: 'the first real storm of the spread', region: '41,-74' },
  { id: 2, date: 'mar 14 · afternoon', summary: 'patient — it asked nothing of me', region: '34,-118' },
  { id: 1, date: 'mar 03 · morning', summary: 'where the record begins', region: '41,-74' },
]
```

- [ ] **Step 4: Carry region through `entryFormat.js`**

In `src/lib/entryFormat.js`, in `normalizeEntries`, add `region` to the mapped object — change:

```js
    song: r.song ?? null,
    glyph: r.glyph ?? null,
  }))
```

to:

```js
    song: r.song ?? null,
    glyph: r.glyph ?? null,
    region: r.region ?? null,
  }))
```

In the same file, in `loadMockEntries`, change the inner map — from:

```js
      summary: e.summary,
      song: null,
      glyph: null,
    })),
```

to:

```js
      summary: e.summary,
      song: null,
      glyph: null,
      region: e.region ?? null,
    })),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- entryFormat`
Expected: PASS — all cases, including the three new region cases.

- [ ] **Step 6: Carry region through `entriesRepo.js`**

In `src/lib/entriesRepo.js`:

In `fetchEntries`, add `region` to the select — change `.select('id, created_at, song, summary, glyph')` to:

```js
    .select('id, created_at, song, summary, glyph, region')
```

In `createEntry`, accept and insert `region` — change the signature and insert. From:

```js
export async function createEntry(userId, { song, summary, glyph }) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('entries')
    .insert({ user_id: userId, song, summary, glyph })
```

to:

```js
export async function createEntry(userId, { song, summary, glyph, region }) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('entries')
    .insert({ user_id: userId, song, summary, glyph, region })
```

In `seedSampleEntries`, write each mock entry's region — change:

```js
  const rows = MOCK_ENTRIES.map((e) => ({
    user_id: userId,
    created_at: mockDateToIso(e.date),
    summary: e.summary,
    song: null,
  }))
```

to:

```js
  const rows = MOCK_ENTRIES.map((e) => ({
    user_id: userId,
    created_at: mockDateToIso(e.date),
    summary: e.summary,
    song: null,
    region: e.region ?? null,
  }))
```

- [ ] **Step 7: Run the full suite + build**

Run: `npm test`
Expected: PASS — the whole suite, no regressions.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/journal/mockEntries.js src/lib/entryFormat.js src/lib/entriesRepo.js src/lib/__tests__/entryFormat.test.js
git commit -m "feat(journal): carry entry region through the data layer (slice 5)" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `skyStyle.js` — the code-defined Mapbox style

**Files:**
- Create: `src/journal/skyStyle.js`

A pure config object — no unit test (it is data; verified visually in Task 12).

- [ ] **Step 1: Write the implementation**

Create `src/journal/skyStyle.js`:

```js
/**
 * skyStyle — the journal sky's custom Mapbox style, code-defined (spec §4.2).
 *
 * A Mapbox style spec v8 object: a void-ocean background + a single faint ink
 * land fill from Mapbox's public country-boundaries tileset, drawn with no
 * outline so the union of country polygons reads as continents and no borders
 * show. Nothing else — no roads, labels, POIs, water, symbols.
 *
 * SKY_FOG is passed to map.setFog() once the style loads — the atmospheric
 * halo at the globe's edge.
 */

// One worldview only — drops disputed double-polygons so the faint fill never
// stacks into brighter seams.
const LAND_FILTER = [
  'all',
  ['==', ['get', 'disputed'], 'false'],
  ['any', ['==', 'all', ['get', 'worldview']], ['in', 'US', ['get', 'worldview']]],
]

export const SKY_STYLE = {
  version: 8,
  sources: {
    countries: {
      type: 'vector',
      url: 'mapbox://mapbox.country-boundaries-v1',
    },
  },
  layers: [
    {
      id: 'void-ocean',
      type: 'background',
      paint: { 'background-color': '#06070c' },
    },
    {
      id: 'ink-land',
      type: 'fill',
      source: 'countries',
      'source-layer': 'country_boundaries',
      filter: LAND_FILTER,
      paint: { 'fill-color': '#12141d', 'fill-opacity': 1 },
    },
  ],
}

export const SKY_FOG = {
  range: [0.8, 8],
  color: '#0a0b12',
  'high-color': '#1a1c2e',
  'space-color': '#04040a',
  'horizon-blend': 0.04,
  'star-intensity': 0.15,
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/journal/skyStyle.js
git commit -m "feat(journal): add the code-defined Mapbox sky style (slice 5)" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `CollectiveSky.jsx` — the Mapbox globe component

**Files:**
- Create: `src/journal/CollectiveSky.jsx`

An IO/WebGL component — not unit-tested (`mapbox-gl` does not run in jsdom; verified in Task 12).

- [ ] **Step 1: Write the implementation**

Create `src/journal/CollectiveSky.jsx`:

```jsx
import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { SKY_STYLE, SKY_FOG } from './skyStyle.js'
import { INTIMATE, EXPANDED, easeExpansion } from '../lib/skyPresets.js'
import { MOCK_COLLECTIVE } from '../lib/mockCollective.js'
import { jitterInCell } from '../lib/geo.js'

/**
 * CollectiveSky — the journal's third surface: a Mapbox GL globe of glyph-
 * lights (design doc §7, spec §4.1).
 *
 * The user's own entries glow warm in their "hand" hue; a mock collective is
 * a cooler, faint wash around them. Driven by `phase` from Journal:
 *   'rising' — held at the intimate framing on the user's cluster (under the
 *              cloud veil while the rise transition runs)
 *   'open'   — the one-shot slow zoom-out reveal, then idle auto-rotation
 *   'hidden' — descended; the map stays alive, idle
 *
 * Mounted inside Journal and crossfaded by an opacity wrapper Journal owns —
 * this component only fills its container.
 */

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const REVEAL_MS = 7000
const SPIN_DEG_PER_SEC = 1.4
// framing when the user has no placed entries — a calm globe overview
const DEFAULT_CENTER = { lat: 20, lng: 0 }

// [{ lat, lng }] → a GeoJSON FeatureCollection of Points
function toFeatureCollection(points) {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {},
    })),
  }
}

export default function CollectiveSky({ entries, hand, phase }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layersAddedRef = useRef(false)
  const revealingRef = useRef(false)

  // the user's own placed lights — entries that carry a region (spec §5.1)
  const selfPoints = useMemo(
    () =>
      (entries || [])
        .filter((e) => e && e.region)
        .map((e) => jitterInCell(e.region, e.id))
        .filter(Boolean),
    [entries],
  )

  // the framing the rise zooms to: the mean of the user's own lights
  const centroid = useMemo(() => {
    if (selfPoints.length === 0) return DEFAULT_CENTER
    const sum = selfPoints.reduce(
      (a, p) => ({ lat: a.lat + p.lat, lng: a.lng + p.lng }),
      { lat: 0, lng: 0 },
    )
    return { lat: sum.lat / selfPoints.length, lng: sum.lng / selfPoints.length }
  }, [selfPoints])

  const hasCluster = selfPoints.length > 0
  const selfColor = `hsl(${hand?.inkHue ?? 30}, 85%, 62%)`

  // build the map once
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: SKY_STYLE,
      projection: 'globe',
      center: [centroid.lng, centroid.lat],
      zoom: hasCluster ? INTIMATE.zoom : EXPANDED.zoom,
      minZoom: 1.1,
      maxZoom: 4.5, // privacy floor — no single light is individually resolvable
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: true, // Mapbox TOS requires attribution
    })
    mapRef.current = map

    map.on('style.load', () => {
      map.setFog(SKY_FOG)
      if (layersAddedRef.current) return
      layersAddedRef.current = true

      map.addSource('collective', {
        type: 'geojson',
        data: toFeatureCollection(MOCK_COLLECTIVE),
      })
      map.addLayer({
        id: 'collective-lights',
        type: 'circle',
        source: 'collective',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.1, 4.5, 3.6],
          'circle-color': '#7c90c0',
          'circle-blur': 1.0,
          'circle-opacity': 0.32,
        },
      })

      map.addSource('self', { type: 'geojson', data: toFeatureCollection(selfPoints) })
      map.addLayer({
        id: 'self-halo',
        type: 'circle',
        source: 'self',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 7, 4.5, 24],
          'circle-color': selfColor,
          'circle-blur': 1.0,
          'circle-opacity': 0.22,
        },
      })
      map.addLayer({
        id: 'self-core',
        type: 'circle',
        source: 'self',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.8, 4.5, 6.5],
          'circle-color': selfColor,
          'circle-blur': 0.45,
          'circle-opacity': 0.95,
        },
      })
      map.resize()
    })

    return () => {
      map.remove()
      mapRef.current = null
      layersAddedRef.current = false
    }
    // build once — centroid/hasCluster/selfPoints seed the constructor and
    // are then kept current by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep the self layer in sync as entries change (e.g. a new rite settles)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersAddedRef.current) return
    const src = map.getSource('self')
    if (src) src.setData(toFeatureCollection(selfPoints))
  }, [selfPoints])

  // recolour the self lights if the hand changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersAddedRef.current) return
    map.setPaintProperty('self-halo', 'circle-color', selfColor)
    map.setPaintProperty('self-core', 'circle-color', selfColor)
  }, [selfColor])

  // phase choreography: hold INTIMATE while rising, run the reveal on 'open'
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (phase === 'rising') {
      map.jumpTo({
        center: [centroid.lng, centroid.lat],
        zoom: hasCluster ? INTIMATE.zoom : EXPANDED.zoom,
      })
    } else if (phase === 'open') {
      revealingRef.current = true
      map.easeTo({
        center: [centroid.lng, centroid.lat],
        zoom: EXPANDED.zoom,
        duration: REVEAL_MS,
        easing: easeExpansion,
      })
      map.once('moveend', () => {
        revealingRef.current = false
      })
    }
  }, [phase, centroid, hasCluster])

  // slow idle auto-rotation while the sky is open
  useEffect(() => {
    const map = mapRef.current
    if (!map || phase !== 'open') return
    let raf = 0
    let interacting = false
    let last = performance.now()
    const onDown = () => {
      interacting = true
    }
    const onUp = () => {
      interacting = false
    }
    map.on('mousedown', onDown)
    map.on('touchstart', onDown)
    map.on('mouseup', onUp)
    map.on('touchend', onUp)
    map.on('dragend', onUp)
    const spin = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!interacting && !revealingRef.current && !map.isMoving()) {
        const c = map.getCenter()
        c.lng += dt * SPIN_DEG_PER_SEC
        map.setCenter(c)
      }
      raf = requestAnimationFrame(spin)
    }
    raf = requestAnimationFrame(spin)
    return () => {
      cancelAnimationFrame(raf)
      map.off('mousedown', onDown)
      map.off('touchstart', onDown)
      map.off('mouseup', onUp)
      map.off('touchend', onUp)
      map.off('dragend', onUp)
    }
  }, [phase])

  if (!TOKEN) {
    // belt-and-braces — Journal hides the rise affordance without a token,
    // so this component is in practice never mounted unconfigured
    return <div style={{ position: 'absolute', inset: 0, background: '#06070c' }} />
  }
  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: build succeeds; Vite reports a separate `mapbox-gl` chunk (CollectiveSky is dynamically imported by Journal in Task 9 — at this point it is still tree-shaken out, so the build is unaffected).

- [ ] **Step 3: Commit**

```bash
git add src/journal/CollectiveSky.jsx
git commit -m "feat(journal): add CollectiveSky — the Mapbox globe (slice 5)" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `Journal.jsx` — the rise/descend transitions

**Files:**
- Modify: `src/journal/Journal.jsx`

A UI component — not unit-tested (verified in Task 12). Apply each edit exactly.

- [ ] **Step 1: Import `lazy`, lazy-load CollectiveSky, add the token flag**

Change line 1 — from:

```js
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

to:

```js
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

Then change the timing constants block — from:

```js
const TRANS_MS = 3800
const JUMP_MS = 2400
```

to:

```js
const TRANS_MS = 3800
const JUMP_MS = 2400
const RISE_MS = 4200

// the collective sky is heavy (Mapbox GL) — load it only on the first rise
const CollectiveSky = lazy(() => import('./CollectiveSky.jsx'))
const HAS_MAPBOX = !!import.meta.env.VITE_MAPBOX_TOKEN
```

- [ ] **Step 2: Add the sky state and crossfade refs**

Change — from:

```js
  const [pageVisible, setPageVisible] = useState(false)
  const [busy, setBusy] = useState(false)
```

to:

```js
  const [pageVisible, setPageVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [skyMounted, setSkyMounted] = useState(false)
  const [skyPhase, setSkyPhase] = useState('hidden')
```

Then change — from:

```js
  const veilRef = useRef({ opacity: 0 })
  const transRef = useRef(null)
```

to:

```js
  const veilRef = useRef({ opacity: 0 })
  const transRef = useRef(null)
  // book↔sky crossfade — applied to the two full-screen wrappers each frame
  const mixRef = useRef({ book: 1, sky: 0 })
  const bookWrapRef = useRef(null)
  const skyWrapRef = useRef(null)
```

- [ ] **Step 3: Add the `rise` / `descend` branches to the rAF loop**

In the transition `loop`, change — from:

```js
        } else {
          // turn: page turn (visible) -> intense zoom-in (visible) -> cloud -> page.
```

to:

```js
        } else if (tr.kind === 'rise') {
          // book → sky: the veil covers, the wrappers crossfade behind it,
          // the veil clears onto the user's own cluster
          veilRef.current.opacity = pulse(t, 0.0, 0.42, 0.58, 1.0)
          {
            const mix = smoothstep(0.3, 0.7, t)
            mixRef.current.book = 1 - mix
            mixRef.current.sky = mix
          }
          if (t >= 0.5 && !tr.swapped) {
            tr.swapped = true
            setPageVisible(false)
            setView('sky')
          }
        } else if (tr.kind === 'descend') {
          // sky → book: the reverse crossfade
          veilRef.current.opacity = pulse(t, 0.0, 0.42, 0.58, 1.0)
          {
            const mix = smoothstep(0.3, 0.7, t)
            mixRef.current.book = mix
            mixRef.current.sky = 1 - mix
          }
          if (t >= 0.5 && !tr.swapped) {
            tr.swapped = true
            setView('page')
            setPageVisible(true)
          }
        } else {
          // turn: page turn (visible) -> intense zoom-in (visible) -> cloud -> page.
```

- [ ] **Step 4: Handle rise/descend completion in the `t >= 1` block**

Change — from:

```js
          veilRef.current.opacity = 0
          if (tr.kind === 'open') setView('page')
          setBusy(false)
```

to:

```js
          veilRef.current.opacity = 0
          if (tr.kind === 'open') setView('page')
          if (tr.kind === 'rise') setSkyPhase('open')
          if (tr.kind === 'descend') setSkyPhase('hidden')
          setBusy(false)
```

- [ ] **Step 5: Apply the crossfade to the wrappers every frame**

Change — from:

```js
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
```

to:

```js
      }
      if (bookWrapRef.current) bookWrapRef.current.style.opacity = String(mixRef.current.book)
      if (skyWrapRef.current) skyWrapRef.current.style.opacity = String(mixRef.current.sky)
      raf = requestAnimationFrame(loop)
    }
    loop()
```

- [ ] **Step 6: Add the `rise` and `descend` callbacks**

After the `jumpTo` callback (the `useCallback` ending `[index, maxIndex],` just before the `// after a rite settles` comment), insert:

```js
  const rise = useCallback(() => {
    if (transRef.current || view !== 'page') return
    setBusy(true)
    setSkyMounted(true)
    setSkyPhase('rising')
    transRef.current = { kind: 'rise', dur: RISE_MS, start: performance.now() }
  }, [view])

  const descend = useCallback(() => {
    if (transRef.current || view !== 'sky') return
    setBusy(true)
    transRef.current = { kind: 'descend', dur: RISE_MS, start: performance.now() }
  }, [view])

```

- [ ] **Step 7: Let Escape descend from the sky**

Change the key handler — from:

```js
    const onKey = (e) => {
      if (view === 'landing' && (e.key === 'Enter' || e.key === ' ')) open()
      // entries are newest-first: turn(+1) = older = earlier in time
      if (view === 'page' && e.key === 'ArrowLeft') turn(1)
      if (view === 'page' && e.key === 'ArrowRight') turn(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, open, turn])
```

to:

```js
    const onKey = (e) => {
      if (view === 'landing' && (e.key === 'Enter' || e.key === ' ')) open()
      // entries are newest-first: turn(+1) = older = earlier in time
      if (view === 'page' && e.key === 'ArrowLeft') turn(1)
      if (view === 'page' && e.key === 'ArrowRight') turn(-1)
      if (view === 'sky' && e.key === 'Escape') descend()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, open, turn, descend])
```

- [ ] **Step 8: Wrap the book Canvas in an opacity wrapper**

Change the Canvas opening tag — from:

```js
      <Canvas camera={{ position: [0, 3.7, 4.7], fov: 36 }} gl={{ antialias: true }} dpr={[1, 2]}>
```

to:

```js
      <div ref={bookWrapRef} style={{ position: 'absolute', inset: 0 }}>
      <Canvas camera={{ position: [0, 3.7, 4.7], fov: 36 }} gl={{ antialias: true }} dpr={[1, 2]}>
```

Change the Canvas closing tag — from:

```js
      </Canvas>

      {pageVisible && <EntryPage entry={entries[index]} handStyle={handStyle} />}
```

to:

```js
      </Canvas>
      </div>

      {skyMounted && (
        <div ref={skyWrapRef} style={{ position: 'absolute', inset: 0, opacity: 0 }}>
          <Suspense fallback={null}>
            <CollectiveSky entries={entries} hand={handStyle} phase={skyPhase} />
          </Suspense>
        </div>
      )}

      {pageVisible && <EntryPage entry={entries[index]} handStyle={handStyle} />}
```

- [ ] **Step 9: Add the rise + descend affordances**

After the `{!busy && view === 'page' && (` bottom-nav block (the one ending with the `later →` button and its closing `</div>\n      )}`), insert before the final closing `</div>` of the component:

```jsx
      {!busy && view === 'page' && HAS_MAPBOX && (
        <button
          onClick={rise}
          style={{
            position: 'absolute',
            top: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            font: 'italic 14px Palatino, Georgia, serif',
            letterSpacing: '0.12em',
            color: 'rgba(28,24,20,0.42)',
          }}
        >
          ↑ rise to the field
        </button>
      )}
      {!busy && view === 'sky' && (
        <button
          onClick={descend}
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            font: 'italic 14px Palatino, Georgia, serif',
            letterSpacing: '0.12em',
            color: 'rgba(231,222,198,0.5)',
          }}
        >
          ↓ return to the book
        </button>
      )}
```

- [ ] **Step 10: Fix the sign-out + QR-label colours for the dark sky**

Change the sign-out button colour — from:

```js
            color: view === 'landing' ? 'rgba(231,222,198,0.4)' : 'rgba(28,24,20,0.4)',
```

to:

```js
            color: view === 'page' ? 'rgba(28,24,20,0.4)' : 'rgba(231,222,198,0.4)',
```

Change the QR-label colour — from:

```js
              color: view === 'landing' ? 'rgba(231,222,198,0.5)' : 'rgba(28,24,20,0.45)',
```

to:

```js
              color: view === 'page' ? 'rgba(28,24,20,0.45)' : 'rgba(231,222,198,0.5)',
```

- [ ] **Step 11: Verify the build passes**

Run: `npm run build`
Expected: build succeeds; Vite reports a separate dynamically-imported `mapbox-gl` chunk.

- [ ] **Step 12: Commit**

```bash
git add src/journal/Journal.jsx
git commit -m "feat(journal): the rise to the field — book↔sky transition (slice 5)" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `useRiteSession.js` — capture region at settle

**Files:**
- Modify: `src/hooks/useRiteSession.js`

A hook with IO — not unit-tested (verified in Task 12).

- [ ] **Step 1: Add the module-level region resolver**

In `src/hooks/useRiteSession.js`, immediately before `export function useRiteSession({ userId, onEntryWritten }) {`, insert:

```js
// the desktop's coarse location, resolved once per page load from /api/geo
// (spec §3.4). Best-effort: any failure resolves to null and the entry still
// writes — the loop is never blocked on geolocation.
let cachedRegion // undefined until the first resolve
async function resolveRegion() {
  if (cachedRegion !== undefined) return cachedRegion
  try {
    const res = await fetch('/api/geo')
    const data = await res.json()
    cachedRegion = data && typeof data.region === 'string' ? data.region : null
  } catch {
    cachedRegion = null
  }
  return cachedRegion
}

```

- [ ] **Step 2: Resolve the region before writing the entry**

Change — from:

```js
          createEntry(uid, { song: msg.song, summary: msg.summary, glyph: msg.glyph })
            .then((row) => {
```

to:

```js
          resolveRegion()
            .then((region) =>
              createEntry(uid, { song: msg.song, summary: msg.summary, glyph: msg.glyph, region }),
            )
            .then((row) => {
```

- [ ] **Step 3: Verify the build + suite pass**

Run: `npm run build`
Expected: build succeeds.
Run: `npm test`
Expected: PASS — the whole suite, no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useRiteSession.js
git commit -m "feat(journal): capture coarse region when a rite settles (slice 5)" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Documentation updates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/desktop-journal-design.md`

- [ ] **Step 1: Add `VITE_MAPBOX_TOKEN` to the CLAUDE.md env table**

In `CLAUDE.md`, in the `## Environment` table, add a row after the `VITE_SUPABASE_ANON_KEY` row:

```
| `VITE_MAPBOX_TOKEN` | Runtime (`CollectiveSky.jsx`) | The desktop journal's collective sky (Mapbox globe). Without it the "rise to the field" affordance is hidden. |
```

Also add `VITE_MAPBOX_TOKEN` to the sentence listing the Vercel Production env vars (after `VITE_SUPABASE_ANON_KEY`).

- [ ] **Step 2: Document `api/geo.js` in CLAUDE.md**

In `CLAUDE.md`, in the `### Server-side proxy (`api/`)` section, add a bullet:

```
- **`api/geo.js`** — Resolves the desktop's coarse location from Vercel's `x-vercel-ip-*` geolocation headers, coarsened server-side to a 1° grid. Returns `{ region }`. Used by `useRiteSession` to stamp a journal entry's `region` (desktop journal Slice 5).
```

- [ ] **Step 3: Update the desktop journal section in CLAUDE.md**

In `CLAUDE.md`, in the `### Desktop journal (`/journal`)` section, change the intro line `**Slices 1–4 are built; Slice 5 is next.**` to `**Slices 1–5 are built; Slice 6 is next.**`, and add a new paragraph after the Slice 4 paragraph:

```
**Slice 5 — the sky (built).** The journal's third surface: a Mapbox GL
globe of glyph-lights (`src/journal/CollectiveSky.jsx`), reached from a book
page by the "rise to the field" transition — a `rise`/`descend` crossfade in
`Journal.jsx`'s rAF orchestrator, reusing the cloud veil. The custom dark
style is code-defined (`src/journal/skyStyle.js`): faint ink land over a void
ocean. The user's own entries glow warm in their hand hue, placed at a
coarsened location; a mock collective wash (`src/lib/mockCollective.js`)
fills the field. Location is captured at settle from Vercel geo headers
(`api/geo.js` → `entries.region`); `src/lib/geo.js` coarsens to a 1° grid and
`src/lib/skyPresets.js` holds the INTIMATE↔EXPANDED rise camera. Needs
`VITE_MAPBOX_TOKEN`; without it the rise affordance is hidden. **Slice 6
(next) — the real collective:** anonymized glyphs from all accounts, the
mine/field/both view (§7).
```

- [ ] **Step 4: Update the status banner in CLAUDE.md**

In `CLAUDE.md`, in the `> **Status — 2026-05-21.**` block near the top, change `Slices 1–4 of the 6-slice plan ... are built; **Slice 5 — the Mapbox collective "sky" — is next**, then Slice 6` to `Slices 1–5 of the 6-slice plan ... are built; **Slice 6 — the real collective — is next**`.

- [ ] **Step 5: Update the test count in CLAUDE.md**

Run: `npm test` and read the reported total.
In `CLAUDE.md`, replace every occurrence of `295 tests` / `295-test` with the new total (search for `295`).

- [ ] **Step 6: Update the design doc slice status**

In `docs/desktop-journal-design.md`, in `## 12. Build sequence (slices)`, change slice 5's line to begin with `5. **The sky. (Built 2026-05-21.)**` (matching the `(Built …)` style of slices 3 and 4).

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md docs/desktop-journal-design.md
git commit -m "docs: mark desktop journal Slice 5 (the sky) built" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full build + test suite**

Run: `npm run build`
Expected: build succeeds, with a separate `mapbox-gl` chunk.
Run: `npm test`
Expected: PASS — the whole suite, including the new `geo` / `skyPresets` / `mockCollective` / `entryFormat` region cases.

- [ ] **Step 2: Lint — no new errors**

Run: `npm run lint`
Expected: `npm run lint` is **not** clean in this repo (~133 pre-existing errors). Confirm none of the new files (`src/lib/geo.js`, `skyPresets.js`, `mockCollective.js`, `src/journal/skyStyle.js`, `CollectiveSky.jsx`, `api/geo.js`) and no edited lines appear in the output. If they do, fix them and re-run.

- [ ] **Step 3: Manual end-to-end (requires `VITE_MAPBOX_TOKEN` in `.env.local`)**

Run: `npm run dev`, open `/journal`, and walk the spec §8 checklist:

1. Open the journal to a page → the faint "↑ rise to the field" affordance shows top-centre.
2. Click it → the cloud veil covers, the book recedes, the veil clears onto the user's own warm cluster, then a slow zoom-out reveals the field.
3. The user's own lights glow warm (the hand hue); the mock collective is a cooler, fainter wash; the globe turns slowly and rotates on drag.
4. The zoom floor holds — no single light becomes individually resolvable.
5. Click "↓ return to the book" (or press Escape) → the veil crossfades back onto the book page.
6. Temporarily rename `VITE_MAPBOX_TOKEN` in `.env.local`, restart dev → the rise affordance is absent; the book is otherwise unchanged. Restore the token.
7. The no-backend path: with Supabase env unset, `/journal` still shows a self cluster (the mock entries' regions).

- [ ] **Step 4: Manual rite check (optional, needs a QR-paired phone + Supabase)**

Run a real QR-paired rite; at settle confirm the new `entries` row carries a non-null `region` when run on Vercel (local dev resolves `region: null` — expected, §9), and rising afterwards shows the new entry placed on the globe.

- [ ] **Step 5: Final commit (only if Step 2 required fixes)**

```bash
git add -A
git commit -m "fix: lint cleanup for the collective sky (slice 5)" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §3.1 `api/geo.js` → Task 5. §3.2 `geo.js` → Task 2. §3.3 region data layer → Task 6. §3.4 capture at settle → Task 10.
- §4.1 `CollectiveSky` → Task 8. §4.2 `skyStyle.js` → Task 7. §4.3 `skyPresets.js` → Task 3.
- §5 the rise transition (rise/descend, placement, affordances) → Task 9 (placement logic lives in `CollectiveSky`, Task 8).
- §6 mock collective + mock entry regions → Tasks 4 and 6.
- §7 file change map → all tasks; `package.json` → Task 1; `CLAUDE.md` → Task 11.
- §8 testing → Tasks 2/3/4/6 (unit), Task 12 (manual). §9 risks → addressed (graceful token degradation, two WebGL contexts accepted, dev `region: null`).

**Placeholder scan:** none — every step carries full code or an exact command.

**Type consistency:** `coarsenLocation`/`regionToLatLng`/`jitterInCell` signatures match across Tasks 2, 6, 8. `region` is a `"lat,lng"` string everywhere. `phase` is `'rising' | 'open' | 'hidden'` in both `CollectiveSky` (Task 8) and `Journal` (Task 9). `INTIMATE`/`EXPANDED` are `{ zoom }` in Tasks 3 and 8. `entries[].region` / `entries[].id` consumed by `CollectiveSky` match what `normalizeEntries` produces (Task 6).
