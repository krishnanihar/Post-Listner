# Phase 2 — GEMS Probe & Autobiographical Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AVD-only Textures phase with a GEMS discrete-emotion probe that recovers nostalgia/awe/tenderness, and insert a 3-prompt autobiographical bump module before Reflection so Mirror's memory callback names real songs from the user's life.

**Architecture:** Two new phases inserted into `App.jsx`'s PHASES (Gems replaces Textures at index 3; Autobio is new at index 5 between Moment and Reflection). Five new pure-function modules in `src/lib/` (era, autobio data validation, iTunes Search wrapper, GEMS tag definitions, Spectrum v2 pair definitions). Existing Mirror/Reflection/scoreArchetype modules extended to consume the new data.

**Tech Stack:** React 19, Vite 7, Tailwind v4, Framer Motion 12, vitest. iTunes Search API (`https://itunes.apple.com/search`) called directly from the client (CORS-friendly, no auth, no proxy). All new audio assets are flagged as out-of-scope dependencies — placeholder paths used.

---

## Research grounding (refer back as needed)

- **GEMS-9 + Cowen-13:** Zentner et al. 2008 + Cowen et al. 2020. AVD geometrically cannot recover nostalgia, awe, tenderness (all collapse onto same V/A point). Six tiles drawn from both: *nostalgic, awed, tender, melancholic, defiant, peaceful*.
- **Reminiscence bump:** Krumhansl & Zupnick 2013, Jakubowski et al. 2020. Peak autobiographical salience at age 14–16; cascading bump from parents' era ~25 years earlier.
- **Self-engagement:** Janata 2009 — dorsal mPFC tracks autobiographical salience. Belfi et al. 2018 — lesion evidence that music's identity-binding power depends on self-system circuitry. Place autobio prompts in calmed mPFC-engaged window (after Moment, before Mirror).
- **Rathbone "I am…" framing:** Three identity-tied prompts produce denser MEAMs than experimenter-selected songs.
- **Equivoque agency illusion:** Sundar 2008 + Vaccaro et al. 2018. Small placebo controls increase satisfaction. Unfalsifiable framing ("Pull this until it feels like the room you want to be in") preserves agency without algorithmic burden.
- **Hurley liking probe:** Hurley et al. 2014. Distinguishes high-arousal-loved from high-arousal-tolerated.

---

## File structure

**New pure-function modules:**

| File | Responsibility |
|---|---|
| `src/lib/era.js` | `detectEraCluster(years) → { median, span, clustered }`, `buildEraLine(cluster) → string \| null`. Pure; no API calls. |
| `src/lib/autobio.js` | `validateSong({ title, artist, year }) → { valid, reason }`, `summarizeAutobio(songs) → { songs, eraSummary }`. Pure shape helpers. |
| `src/lib/itunesSearch.js` | `searchTracks(query, signal?) → Promise<Track[]>` calling iTunes Search API. Single async function. |
| `src/lib/gemsTags.js` | `GEMS_TAGS` array of 6 tile definitions (id + label + AVD nudge), `gemsExcerptsToAvdNudge(excerpts) → { a, v, d }`. |
| `src/lib/spectrumPairs.js` | `PAIRS_LEGACY` (current 8 pairs, copied from Spectrum.score.jsx), `PAIRS_V2` (new 9 polar pairs), `ACTIVE_PAIRS` toggle (defaults to `PAIRS_LEGACY` until v2 audio assets land). |
| `src/lib/__tests__/era.test.js`, `autobio.test.js`, `itunesSearch.test.js`, `gemsTags.test.js`, `spectrumPairs.test.js` | Unit tests for the above. |

**New phase components:**

| File | Responsibility |
|---|---|
| `src/phases/Gems.score.jsx` | Replaces Textures in the phase flow at index 3. 3 × 15s excerpts (placeholder paths). After each, a 6-tile multi-select fade. Captures `phaseData.gems = { excerpts: [{ id, tilesSelected, reactionMs }] }`. |
| `src/phases/Autobio.score.jsx` | New phase at index 5 (between Moment and Reflection). 3 sequential Rathbone prompts with iTunes autocomplete + free-text fallback. Captures `phaseData.autobio = { songs: [{ title, artist, year, prompt }], eraSummary: {...} }`. |

**Modified files:**

| File | Change |
|---|---|
| `src/App.jsx` | PHASES updated: `'textures'` → `'gems'`; insert `'autobio'` between `'moment'` and `'reflection'`. phaseComponent map updated. |
| `src/engine/avd.js` | Extend `phaseData` constructor + `reset()` defaults with `gems: { excerpts: [] }` and `autobio: { songs: [], eraSummary: null }`. Existing `textures` field kept for backward compatibility. |
| `src/lib/forerLines.js` | `buildMemoryCallback` prefers `autobio.songs[0].title + year` when available; falls back to current texture/spectrum logic. |
| `src/lib/reflectionLines.js` | Replace `textures` line with `gems` line; add `autobio` line. `buildReflectionLines` now returns `{ spectrum, depth, gems, moment, autobio }`. |
| `src/lib/scoreArchetype.js` | Variation selector prefers `phaseData.autobio.eraSummary.median` for era fit when present; falls back to depth-based heuristic. |
| `src/phases/Reflection.score.jsx` | Render 5 lines instead of 4 (timing extends from ~10s to ~12s). |
| `src/phases/Spectrum.score.jsx` | Replace inline `PAIRS` with `import { ACTIVE_PAIRS } from '../lib/spectrumPairs'`. No behavior change while toggle is `LEGACY`. |
| `src/phases/Depth.score.jsx` | Replace `tap anywhere` instruction with equivoque copy. |
| `src/phases/Moment.score.jsx` | Insert Hurley probe between phase completion and `onNext`. New stage `hurley` with yes/no UI and 4s auto-advance. Persist `hedonic: true \| false \| null` to `phaseData.moment`. |

---

## Final placeholder asset paths (document in plan, hand to asset producer)

| Asset | Path | Notes |
|---|---|---|
| GEMS Sublimity excerpt | `public/gems/sublimity.mp3` | 15s. Wonder / awe / transcendence. Composer brief: ECM-style, slow, expansive, no vocal. |
| GEMS Tenderness excerpt | `public/gems/tenderness.mp3` | 15s. Longing / nostalgia. Soft piano + cello, mid-tempo. |
| GEMS Tension excerpt | `public/gems/tension.mp3` | 15s. Defiance / unresolved. Minor key, driving but withheld. |
| Spectrum v2 audio | `public/spectrum/v2/{warm,cold,dense,spare,sung,instrumental,analog,digital,major,modal,slow,mid,driving,floating,low,high,reverberant,dry}.mp3` | 18 files × 8s each (9 pairs). Set `ACTIVE_PAIRS = PAIRS_V2` in `spectrumPairs.js` once landed. |

Phase 2 ships with placeholder paths and graceful fallback (audio playback errors are silently caught — same pattern Phase 1 uses). UI works without these assets.

---

## Task 1: era.js — era cluster detection

**Files:**
- Create: `src/lib/era.js`
- Create: `src/lib/__tests__/era.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/era.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { detectEraCluster, buildEraLine } from '../era'

describe('detectEraCluster', () => {
  it('returns null median for empty input', () => {
    expect(detectEraCluster([])).toEqual({ median: null, span: 0, clustered: false })
  })

  it('returns single year for one input', () => {
    expect(detectEraCluster([2003])).toEqual({ median: 2003, span: 0, clustered: false })
  })

  it('flags clustered when span is ≤5 years', () => {
    const result = detectEraCluster([2001, 2003, 2005])
    expect(result.median).toBe(2003)
    expect(result.span).toBe(4)
    expect(result.clustered).toBe(true)
  })

  it('does not flag clustered when span exceeds 5 years', () => {
    const result = detectEraCluster([1995, 2005, 2018])
    expect(result.span).toBe(23)
    expect(result.clustered).toBe(false)
  })

  it('ignores null/undefined years', () => {
    const result = detectEraCluster([2003, null, 2005, undefined])
    expect(result.median).toBeTruthy()
    expect(result.span).toBe(2)
  })
})

describe('buildEraLine', () => {
  it('returns null when no median', () => {
    expect(buildEraLine({ median: null, span: 0, clustered: false })).toBeNull()
  })

  it('returns a tight-cluster line when span ≤3', () => {
    const line = buildEraLine({ median: 2003, span: 2, clustered: true })
    expect(line.toLowerCase()).toContain('2003')
    expect(line.toLowerCase()).toMatch(/bump|period/)
  })

  it('returns a moderate-cluster line when 3<span≤5', () => {
    const line = buildEraLine({ median: 2003, span: 4, clustered: true })
    expect(line.toLowerCase()).toContain('2003')
    expect(line.toLowerCase()).toContain('cluster')
  })

  it('returns a span line when not clustered', () => {
    const line = buildEraLine({ median: 2003, span: 18, clustered: false })
    expect(line).toContain('18')
    expect(line.toLowerCase()).toMatch(/span|years|moment/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/era.test.js`
Expected: FAIL — "Cannot find module '../era'"

- [ ] **Step 3: Implement `src/lib/era.js`**

Create `src/lib/era.js`:
```js
// Era cluster detection for the autobiographical module.
// Krumhansl & Zupnick 2013: songs cluster around age 14–16 (the reminiscence bump).
// Without user age we cannot detect parental cascade — phase 2 only flags
// tight clusters and reports the median.

export function detectEraCluster(years) {
  const valid = (years || []).filter(y => typeof y === 'number' && y > 0).sort((a, b) => a - b)
  if (valid.length === 0) return { median: null, span: 0, clustered: false }
  if (valid.length === 1) return { median: valid[0], span: 0, clustered: false }
  const median = valid[Math.floor(valid.length / 2)]
  const span = valid[valid.length - 1] - valid[0]
  const clustered = span <= 5
  return { median, span, clustered }
}

export function buildEraLine(cluster) {
  if (!cluster || !cluster.median) return null
  const { median, span, clustered } = cluster
  if (clustered && span <= 3) {
    return `three songs from ${median}-ish — your bump period, maybe`
  }
  if (clustered) {
    return `your songs cluster around ${median}. that means something.`
  }
  return `your songs span ${span} years — you don't anchor to one moment`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run src/lib/__tests__/era.test.js`
Expected: 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/era.js src/lib/__tests__/era.test.js
git commit -m "feat(score-v2): add era cluster detection for autobio module"
```

---

## Task 2: autobio.js — song validation + summary

**Files:**
- Create: `src/lib/autobio.js`
- Create: `src/lib/__tests__/autobio.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/autobio.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { validateSong, summarizeAutobio } from '../autobio'

describe('validateSong', () => {
  it('accepts a complete song entry', () => {
    expect(validateSong({ title: 'Karma Police', artist: 'Radiohead', year: 1997 }))
      .toEqual({ valid: true, reason: null })
  })

  it('accepts a song without a year (free-text fallback)', () => {
    const result = validateSong({ title: 'Karma Police', artist: 'Radiohead', year: null })
    expect(result.valid).toBe(true)
  })

  it('rejects a song missing both title and artist', () => {
    expect(validateSong({ title: '', artist: '', year: null }).valid).toBe(false)
  })

  it('rejects a song missing title', () => {
    expect(validateSong({ title: '', artist: 'Radiohead', year: 1997 }).valid).toBe(false)
  })

  it('rejects null or undefined input', () => {
    expect(validateSong(null).valid).toBe(false)
    expect(validateSong(undefined).valid).toBe(false)
  })
})

describe('summarizeAutobio', () => {
  it('returns empty summary for no songs', () => {
    const result = summarizeAutobio([])
    expect(result.songs).toEqual([])
    expect(result.eraSummary).toEqual({ median: null, span: 0, clustered: false })
  })

  it('extracts years and computes era cluster', () => {
    const songs = [
      { title: 'A', artist: 'X', year: 2001 },
      { title: 'B', artist: 'Y', year: 2003 },
      { title: 'C', artist: 'Z', year: 2005 },
    ]
    const result = summarizeAutobio(songs)
    expect(result.songs).toHaveLength(3)
    expect(result.eraSummary.median).toBe(2003)
    expect(result.eraSummary.clustered).toBe(true)
  })

  it('handles songs without year', () => {
    const songs = [
      { title: 'A', artist: 'X', year: null },
      { title: 'B', artist: 'Y', year: 2003 },
    ]
    const result = summarizeAutobio(songs)
    expect(result.songs).toHaveLength(2)
    expect(result.eraSummary.median).toBe(2003)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/autobio.test.js`
Expected: FAIL — "Cannot find module '../autobio'"

- [ ] **Step 3: Implement `src/lib/autobio.js`**

Create `src/lib/autobio.js`:
```js
// Pure shape helpers for the autobiographical module.
// Phase 2 collects 3 Rathbone "I am..." prompts; this module validates entries
// and summarizes them into a shape the Mirror + Reflection screens can render.

import { detectEraCluster } from './era.js'

export function validateSong(entry) {
  if (!entry || typeof entry !== 'object') {
    return { valid: false, reason: 'no entry' }
  }
  const title = (entry.title || '').trim()
  if (!title) {
    return { valid: false, reason: 'no title' }
  }
  return { valid: true, reason: null }
}

export function summarizeAutobio(songs) {
  const valid = (songs || []).filter(s => validateSong(s).valid)
  const years = valid.map(s => s.year).filter(y => typeof y === 'number' && y > 0)
  return {
    songs: valid,
    eraSummary: detectEraCluster(years),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run src/lib/__tests__/autobio.test.js`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autobio.js src/lib/__tests__/autobio.test.js
git commit -m "feat(score-v2): add autobio song validation + summary"
```

---

## Task 3: itunesSearch.js — iTunes Search API wrapper

**Files:**
- Create: `src/lib/itunesSearch.js`
- Create: `src/lib/__tests__/itunesSearch.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/itunesSearch.test.js`:
```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchTracks } from '../itunesSearch'

describe('searchTracks', () => {
  let originalFetch
  beforeEach(() => {
    originalFetch = global.fetch
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns a normalized track list from iTunes results', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        resultCount: 2,
        results: [
          {
            trackName: 'Karma Police',
            artistName: 'Radiohead',
            releaseDate: '1997-08-25T07:00:00Z',
            trackId: 12345,
            artworkUrl60: 'https://example.com/a.jpg',
          },
          {
            trackName: 'No Surprises',
            artistName: 'Radiohead',
            releaseDate: '1998-01-12T07:00:00Z',
            trackId: 12346,
            artworkUrl60: 'https://example.com/b.jpg',
          },
        ],
      }),
    })
    const tracks = await searchTracks('radiohead karma')
    expect(tracks).toHaveLength(2)
    expect(tracks[0]).toEqual({
      title: 'Karma Police',
      artist: 'Radiohead',
      year: 1997,
      id: 12345,
      artworkUrl: 'https://example.com/a.jpg',
    })
    expect(tracks[1].year).toBe(1998)
  })

  it('returns empty array when iTunes returns no results', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ resultCount: 0, results: [] }),
    })
    const tracks = await searchTracks('asdfqwer')
    expect(tracks).toEqual([])
  })

  it('handles tracks without releaseDate', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { trackName: 'X', artistName: 'Y', trackId: 1 },
        ],
      }),
    })
    const tracks = await searchTracks('x')
    expect(tracks[0].year).toBeNull()
  })

  it('throws when fetch returns non-ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    await expect(searchTracks('x')).rejects.toThrow(/iTunes/i)
  })

  it('returns empty array for empty query', async () => {
    global.fetch = vi.fn()
    const tracks = await searchTracks('')
    expect(tracks).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('encodes query parameters correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    })
    await searchTracks('radiohead & friends')
    const calledUrl = global.fetch.mock.calls[0][0]
    expect(calledUrl).toContain('term=radiohead%20%26%20friends')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/itunesSearch.test.js`
Expected: FAIL — "Cannot find module '../itunesSearch'"

- [ ] **Step 3: Implement `src/lib/itunesSearch.js`**

Create `src/lib/itunesSearch.js`:
```js
// Thin wrapper around the iTunes Search API.
// Public, CORS-friendly, no auth, ~20 req/min/IP rate limit.
// Used by the Autobio phase for typeahead song search.

const BASE_URL = 'https://itunes.apple.com/search'

export async function searchTracks(query, signal) {
  const trimmed = (query || '').trim()
  if (!trimmed) return []

  const params = new URLSearchParams({
    term: trimmed,
    entity: 'song',
    limit: '8',
  })
  const url = `${BASE_URL}?${params.toString()}`

  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new Error(`iTunes search failed: ${res.status}`)
  }
  const data = await res.json()
  return (data.results || []).map(r => ({
    title: r.trackName,
    artist: r.artistName,
    year: r.releaseDate ? Number(String(r.releaseDate).slice(0, 4)) : null,
    id: r.trackId,
    artworkUrl: r.artworkUrl60 || null,
  }))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run src/lib/__tests__/itunesSearch.test.js`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/itunesSearch.js src/lib/__tests__/itunesSearch.test.js
git commit -m "feat(score-v2): add iTunes Search API wrapper for autobio autocomplete"
```

---

## Task 4: gemsTags.js — GEMS-9 + Cowen-13 tile definitions

**Files:**
- Create: `src/lib/gemsTags.js`
- Create: `src/lib/__tests__/gemsTags.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/gemsTags.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { GEMS_TAGS, gemsExcerptsToAvdNudge, dominantGemsTag } from '../gemsTags'

describe('GEMS_TAGS', () => {
  it('has exactly 6 tiles', () => {
    expect(GEMS_TAGS).toHaveLength(6)
  })

  it('includes the canonical GEMS-9 + Cowen-13 union', () => {
    const ids = GEMS_TAGS.map(t => t.id)
    expect(ids).toContain('nostalgic')
    expect(ids).toContain('awed')
    expect(ids).toContain('tender')
    expect(ids).toContain('melancholic')
    expect(ids).toContain('defiant')
    expect(ids).toContain('peaceful')
  })

  it('each tile has id, label, and avdNudge with a/v/d numeric fields', () => {
    for (const tag of GEMS_TAGS) {
      expect(typeof tag.id).toBe('string')
      expect(typeof tag.label).toBe('string')
      expect(typeof tag.avdNudge.a).toBe('number')
      expect(typeof tag.avdNudge.v).toBe('number')
      expect(typeof tag.avdNudge.d).toBe('number')
    }
  })
})

describe('gemsExcerptsToAvdNudge', () => {
  it('returns zero nudge for empty excerpts', () => {
    expect(gemsExcerptsToAvdNudge([])).toEqual({ a: 0, v: 0, d: 0 })
  })

  it('sums nudges across excerpts and selected tiles', () => {
    const excerpts = [
      { id: 'sublimity', tilesSelected: ['awed', 'peaceful'] },
      { id: 'tenderness', tilesSelected: ['tender', 'nostalgic'] },
    ]
    const nudge = gemsExcerptsToAvdNudge(excerpts)
    expect(typeof nudge.a).toBe('number')
    expect(typeof nudge.v).toBe('number')
    expect(typeof nudge.d).toBe('number')
  })

  it('ignores unknown tile ids', () => {
    const excerpts = [{ id: 'x', tilesSelected: ['unknown', 'awed'] }]
    const nudge = gemsExcerptsToAvdNudge(excerpts)
    // Should still produce a non-zero nudge from "awed".
    expect(Math.abs(nudge.v) + Math.abs(nudge.a) + Math.abs(nudge.d)).toBeGreaterThan(0)
  })

  it('clamps total nudge to a reasonable range (≤0.3 magnitude per axis)', () => {
    // Three excerpts × all 6 tiles selected = max stack
    const excerpts = [
      { id: 'a', tilesSelected: ['nostalgic', 'awed', 'tender', 'melancholic', 'defiant', 'peaceful'] },
      { id: 'b', tilesSelected: ['nostalgic', 'awed', 'tender', 'melancholic', 'defiant', 'peaceful'] },
      { id: 'c', tilesSelected: ['nostalgic', 'awed', 'tender', 'melancholic', 'defiant', 'peaceful'] },
    ]
    const nudge = gemsExcerptsToAvdNudge(excerpts)
    expect(Math.abs(nudge.a)).toBeLessThanOrEqual(0.3)
    expect(Math.abs(nudge.v)).toBeLessThanOrEqual(0.3)
    expect(Math.abs(nudge.d)).toBeLessThanOrEqual(0.3)
  })
})

describe('dominantGemsTag', () => {
  it('returns null for empty excerpts', () => {
    expect(dominantGemsTag([])).toBeNull()
  })

  it('returns the most frequently selected tile across excerpts', () => {
    const excerpts = [
      { id: 'a', tilesSelected: ['nostalgic', 'awed'] },
      { id: 'b', tilesSelected: ['nostalgic'] },
      { id: 'c', tilesSelected: ['tender'] },
    ]
    expect(dominantGemsTag(excerpts)).toBe('nostalgic')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/gemsTags.test.js`
Expected: FAIL — "Cannot find module '../gemsTags'"

- [ ] **Step 3: Implement `src/lib/gemsTags.js`**

Create `src/lib/gemsTags.js`:
```js
// GEMS-9 + Cowen-13 union: 6 emotion tiles for the Gems probe.
// Each tile carries a small AVD nudge derived from the discrete emotion's
// canonical position in valence/arousal space. Nudges are intentionally small
// (~0.05 per tile) so AVD doesn't get hijacked by GEMS — Phase 1's archetype
// selection still dominates.

export const GEMS_TAGS = [
  // Sublimity cluster (Zentner 2008): wonder, transcendence, nostalgia, peacefulness.
  { id: 'awed',        label: 'awed',        avdNudge: { a:  0.04, v:  0.05, d:  0.06 } },
  { id: 'peaceful',    label: 'peaceful',    avdNudge: { a: -0.06, v:  0.04, d:  0.02 } },
  { id: 'tender',      label: 'tender',      avdNudge: { a: -0.04, v:  0.05, d:  0.03 } },
  { id: 'nostalgic',   label: 'nostalgic',   avdNudge: { a: -0.02, v:  0.02, d:  0.05 } },
  // Unease cluster: tension, sadness, defiance.
  { id: 'melancholic', label: 'melancholic', avdNudge: { a: -0.05, v: -0.06, d:  0.04 } },
  { id: 'defiant',     label: 'defiant',     avdNudge: { a:  0.07, v: -0.04, d:  0.02 } },
]

const TAG_BY_ID = Object.fromEntries(GEMS_TAGS.map(t => [t.id, t]))

const NUDGE_CAP = 0.3

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function gemsExcerptsToAvdNudge(excerpts) {
  let a = 0, v = 0, d = 0
  for (const ex of excerpts || []) {
    for (const tileId of ex.tilesSelected || []) {
      const tag = TAG_BY_ID[tileId]
      if (!tag) continue
      a += tag.avdNudge.a
      v += tag.avdNudge.v
      d += tag.avdNudge.d
    }
  }
  return {
    a: clamp(a, -NUDGE_CAP, NUDGE_CAP),
    v: clamp(v, -NUDGE_CAP, NUDGE_CAP),
    d: clamp(d, -NUDGE_CAP, NUDGE_CAP),
  }
}

export function dominantGemsTag(excerpts) {
  const counts = {}
  for (const ex of excerpts || []) {
    for (const tileId of ex.tilesSelected || []) {
      if (!TAG_BY_ID[tileId]) continue
      counts[tileId] = (counts[tileId] || 0) + 1
    }
  }
  let topId = null, topCount = 0
  for (const [id, c] of Object.entries(counts)) {
    if (c > topCount) { topCount = c; topId = id }
  }
  return topId
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run src/lib/__tests__/gemsTags.test.js`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemsTags.js src/lib/__tests__/gemsTags.test.js
git commit -m "feat(score-v2): add GEMS-9/Cowen-13 emotion tile definitions + AVD nudge"
```

---

## Task 5: spectrumPairs.js — extract pair definitions, define v2 axes

**Files:**
- Create: `src/lib/spectrumPairs.js`
- Create: `src/lib/__tests__/spectrumPairs.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/spectrumPairs.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { PAIRS_LEGACY, PAIRS_V2, ACTIVE_PAIRS } from '../spectrumPairs'

describe('spectrumPairs', () => {
  it('PAIRS_LEGACY has 8 pairs', () => {
    expect(PAIRS_LEGACY).toHaveLength(8)
  })

  it('PAIRS_V2 has 9 pairs along orthogonal production-aesthetic axes', () => {
    expect(PAIRS_V2).toHaveLength(9)
    const axes = PAIRS_V2.map(p => `${p.left}/${p.right}`)
    expect(axes).toContain('warm/cold')
    expect(axes).toContain('dense/spare')
    expect(axes).toContain('sung/instrumental')
  })

  it('every pair has left, right, coordL, coordR with a/v/d numeric fields', () => {
    for (const pairs of [PAIRS_LEGACY, PAIRS_V2]) {
      for (const p of pairs) {
        expect(typeof p.left).toBe('string')
        expect(typeof p.right).toBe('string')
        expect(typeof p.coordL.a).toBe('number')
        expect(typeof p.coordL.v).toBe('number')
        expect(typeof p.coordL.d).toBe('number')
        expect(typeof p.coordR.a).toBe('number')
        expect(typeof p.coordR.v).toBe('number')
        expect(typeof p.coordR.d).toBe('number')
      }
    }
  })

  it('ACTIVE_PAIRS defaults to PAIRS_LEGACY (until v2 audio assets land)', () => {
    expect(ACTIVE_PAIRS).toBe(PAIRS_LEGACY)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/spectrumPairs.test.js`
Expected: FAIL — "Cannot find module '../spectrumPairs'"

- [ ] **Step 3: Implement `src/lib/spectrumPairs.js`**

Create `src/lib/spectrumPairs.js`:
```js
// Spectrum word-pair definitions.
// PAIRS_LEGACY: the 8 pairs Phase 1 ships with — the audio assets in
//   public/spectrum/{left,right}.mp3 already exist for each.
// PAIRS_V2: the 9 polar pairs along orthogonal production-aesthetic axes
//   recommended by the redesign memo (Phase 2 scope item 4).
//   Asset dependency: public/spectrum/v2/{left,right}.mp3 × 9 pairs = 18 files,
//   ~8s each. Set ACTIVE_PAIRS = PAIRS_V2 once they land.

export const PAIRS_LEGACY = [
  { left: 'shadow',  right: 'warmth',
    coordL: { a: 0.30, v: 0.10, d: 0.50 }, coordR: { a: 0.30, v: 0.85, d: 0.50 } },
  { left: 'pulse',   right: 'shimmer',
    coordL: { a: 0.55, v: 0.20, d: 0.35 }, coordR: { a: 0.55, v: 0.80, d: 0.35 } },
  { left: 'weight',  right: 'air',
    coordL: { a: 0.20, v: 0.15, d: 0.60 }, coordR: { a: 0.20, v: 0.70, d: 0.60 } },
  { left: 'ache',    right: 'bloom',
    coordL: { a: 0.25, v: 0.10, d: 0.75 }, coordR: { a: 0.25, v: 0.90, d: 0.75 } },
  { left: 'machine', right: 'earth',
    coordL: { a: 0.50, v: 0.20, d: 0.40 }, coordR: { a: 0.50, v: 0.65, d: 0.40 } },
  { left: 'tension', right: 'resolve',
    coordL: { a: 0.60, v: 0.05, d: 0.55 }, coordR: { a: 0.60, v: 0.85, d: 0.55 } },
  { left: 'fog',     right: 'glass',
    coordL: { a: 0.15, v: 0.20, d: 0.65 }, coordR: { a: 0.15, v: 0.75, d: 0.65 } },
  { left: 'gravity', right: 'drift',
    coordL: { a: 0.65, v: 0.30, d: 0.30 }, coordR: { a: 0.15, v: 0.60, d: 0.70 } },
]

export const PAIRS_V2 = [
  // Each axis is one orthogonal production-aesthetic dimension.
  // coordL and coordR encode the AVD position the chosen end implies.
  { left: 'warm',        right: 'cold',
    coordL: { a: 0.40, v: 0.85, d: 0.50 }, coordR: { a: 0.40, v: 0.15, d: 0.50 } },
  { left: 'dense',       right: 'spare',
    coordL: { a: 0.50, v: 0.50, d: 0.85 }, coordR: { a: 0.50, v: 0.50, d: 0.15 } },
  { left: 'sung',        right: 'instrumental',
    coordL: { a: 0.45, v: 0.65, d: 0.55 }, coordR: { a: 0.45, v: 0.50, d: 0.55 } },
  { left: 'analog',      right: 'digital',
    coordL: { a: 0.45, v: 0.65, d: 0.55 }, coordR: { a: 0.55, v: 0.40, d: 0.45 } },
  { left: 'major',       right: 'modal',
    coordL: { a: 0.50, v: 0.85, d: 0.50 }, coordR: { a: 0.50, v: 0.30, d: 0.55 } },
  { left: 'slow',        right: 'mid',
    coordL: { a: 0.20, v: 0.50, d: 0.55 }, coordR: { a: 0.55, v: 0.50, d: 0.50 } },
  { left: 'driving',     right: 'floating',
    coordL: { a: 0.80, v: 0.55, d: 0.45 }, coordR: { a: 0.20, v: 0.55, d: 0.65 } },
  { left: 'low',         right: 'high',
    coordL: { a: 0.50, v: 0.40, d: 0.65 }, coordR: { a: 0.50, v: 0.60, d: 0.40 } },
  { left: 'reverberant', right: 'dry',
    coordL: { a: 0.40, v: 0.55, d: 0.75 }, coordR: { a: 0.55, v: 0.50, d: 0.30 } },
]

// Active set used by Spectrum.score.jsx. Toggle to PAIRS_V2 when the v2 audio
// assets are landed under public/spectrum/v2/.
export const ACTIVE_PAIRS = PAIRS_LEGACY
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run src/lib/__tests__/spectrumPairs.test.js`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spectrumPairs.js src/lib/__tests__/spectrumPairs.test.js
git commit -m "feat(score-v2): extract spectrum pair definitions, add v2 polar axes"
```

---

## Task 6: Extend AVDEngine phaseData with gems + autobio fields

**Files:**
- Modify: `src/engine/avd.js`

- [ ] **Step 1: Read the current `phaseData` defaults**

Read `src/engine/avd.js` lines 8–13 (constructor) and lines 218–223 (`reset()`). Phase 1 added `hoveredButNotChosen: []`. We're now adding `gems` and `autobio` keys.

- [ ] **Step 2: Extend the constructor `phaseData` default**

In `src/engine/avd.js`, find this block in the constructor:
```js
this.phaseData = {
  spectrum: { pairs: [], hoveredButNotChosen: [] },
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
  gems: { excerpts: [] },
  moment: { totalTaps: 0, tapsDuringBuild: 0, preDropSilence: false, tapsDuringRelease: 0, peakTapRate: 0 },
  autobio: { songs: [], eraSummary: null },
}
```

- [ ] **Step 3: Mirror the change in `reset()`**

Find the same `phaseData` block inside the `reset()` method (around lines 219–224). Apply the identical edit there.

- [ ] **Step 4: Run all tests to confirm no regression**

Run: `npm test`
Expected: All previously-passing tests still pass (37+ from Phase 1, plus any new ones written above).

- [ ] **Step 5: Commit**

```bash
git add src/engine/avd.js
git commit -m "feat(score-v2): extend phaseData with gems + autobio fields"
```

---

## Task 7: Build the Gems phase component

**Files:**
- Create: `src/phases/Gems.score.jsx`

This phase replaces Textures at index 3. Mechanics: 3 sequential excerpts × 15s each, then a 6-tile multi-select fade. After the third excerpt completes, write `phaseData.gems = { excerpts: [...] }` and apply a small AVD nudge via `gemsExcerptsToAvdNudge`.

- [ ] **Step 1: Create the component**

Create `src/phases/Gems.score.jsx`:
```jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Score from '../score/Score'
import { COLORS, FONTS } from '../score/tokens'
import { GEMS_TAGS, gemsExcerptsToAvdNudge } from '../lib/gemsTags'

const EXCERPTS = [
  { id: 'sublimity',  path: '/gems/sublimity.mp3',  durationMs: 15000 },
  { id: 'tenderness', path: '/gems/tenderness.mp3', durationMs: 15000 },
  { id: 'tension',    path: '/gems/tension.mp3',    durationMs: 15000 },
]

const TILE_FADE_MS = 6000

export default function Gems({ onNext, avd }) {
  const [excerptIdx, setExcerptIdx] = useState(0)
  const [stage, setStage] = useState('listening') // listening | tiles | done
  const [selectedTiles, setSelectedTiles] = useState(new Set())
  const [tilesVisible, setTilesVisible] = useState(false)

  const audioRef = useRef(null)
  const stageStartRef = useRef(Date.now())
  const resultsRef = useRef([])
  const advancedRef = useRef(false)

  const playExcerpt = useCallback((idx) => {
    if (idx >= EXCERPTS.length) {
      finishPhase()
      return
    }
    setExcerptIdx(idx)
    setStage('listening')
    setSelectedTiles(new Set())
    setTilesVisible(false)
    stageStartRef.current = Date.now()

    // Start audio (fails silently if asset missing — placeholder paths)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    const audio = new Audio(EXCERPTS[idx].path)
    audio.volume = 0.7
    audioRef.current = audio
    audio.play().catch(() => { /* asset missing, continue */ })

    // After 15s, fade audio and show tiles
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setStage('tiles')
      setTilesVisible(true)
      stageStartRef.current = Date.now()

      // Tiles fade after 6s, then auto-advance
      setTimeout(() => {
        recordSelection(idx, Array.from(selectedTilesRef.current))
        playExcerpt(idx + 1)
      }, TILE_FADE_MS)
    }, EXCERPTS[idx].durationMs)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refs to avoid stale closures inside the timeout
  const selectedTilesRef = useRef(new Set())
  useEffect(() => { selectedTilesRef.current = selectedTiles }, [selectedTiles])

  const recordSelection = useCallback((idx, tiles) => {
    const reactionMs = Date.now() - stageStartRef.current
    resultsRef.current.push({
      id: EXCERPTS[idx].id,
      tilesSelected: tiles,
      reactionMs,
    })
  }, [])

  const finishPhase = useCallback(() => {
    if (advancedRef.current) return
    advancedRef.current = true
    setStage('done')

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    avd.setPhaseData('gems', { excerpts: resultsRef.current })

    // Apply AVD nudge from selected tiles
    const nudge = gemsExcerptsToAvdNudge(resultsRef.current)
    avd.updateArousal(nudge.a, 1.0)
    avd.updateValence(nudge.v, 1.0)
    avd.updateDepth(nudge.d, 1.0)

    setTimeout(() => onNext({ gems: resultsRef.current }), 800)
  }, [avd, onNext])

  useEffect(() => {
    playExcerpt(0)
    return () => {
      if (audioRef.current) audioRef.current.pause()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTile = useCallback((id) => {
    setSelectedTiles(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id) else next.add(id)
      return next
    })
  }, [])

  return (
    <Score variant="cream" pageTitle="iv. tell me what you heard" pageNumber={`${excerptIdx + 1} / ${EXCERPTS.length}`}>
      {/* Listening stage */}
      <AnimatePresence>
        {stage === 'listening' && (
          <motion.foreignObject
            x="0" y="280" width="100%" height="80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div xmlns="http://www.w3.org/1999/xhtml" style={{
              width: '100%',
              textAlign: 'center',
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 14,
              color: COLORS.inkCreamSecondary,
            }}>
              listening...
            </div>
          </motion.foreignObject>
        )}
      </AnimatePresence>

      {/* Tiles stage — rendered as foreignObject for React HTML inside SVG */}
      {stage === 'tiles' && tilesVisible && (
        <foreignObject x="0" y="200" width="100%" height="320">
          <div xmlns="http://www.w3.org/1999/xhtml" style={{
            width: '100%',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'center',
            padding: '0 24px',
          }}>
            {GEMS_TAGS.map(tag => (
              <motion.button
                key={tag.id}
                onClick={() => toggleTile(tag.id)}
                style={{
                  background: selectedTiles.has(tag.id) ? COLORS.scoreAmber : 'transparent',
                  border: `1px solid ${selectedTiles.has(tag.id) ? COLORS.scoreAmber : COLORS.inkCreamSecondary}`,
                  color: selectedTiles.has(tag.id) ? COLORS.paperCream : COLORS.inkCream,
                  padding: '10px 18px',
                  borderRadius: 999,
                  fontFamily: FONTS.serif,
                  fontStyle: 'italic',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                whileTap={{ scale: 0.95 }}
              >
                {tag.label}
              </motion.button>
            ))}
          </div>
        </foreignObject>
      )}
    </Score>
  )
}
```

- [ ] **Step 2: Lint check**

Run: `npm run lint -- src/phases/Gems.score.jsx`
Expected: no NEW errors. Pre-existing "unused motion import" warnings on other phase files are fine.

- [ ] **Step 3: Commit**

```bash
git add src/phases/Gems.score.jsx
git commit -m "feat(score-v2): add Gems phase — 3 excerpts × 6 emotion tiles"
```

---

## Task 8: Build the Autobio phase component

**Files:**
- Create: `src/phases/Autobio.score.jsx`

This phase runs between Moment and Reflection. Three sequential Rathbone "I am…" prompts, each with iTunes Search autocomplete + free-text fallback. After the third entry, write `phaseData.autobio = summarizeAutobio(songs)` and advance.

- [ ] **Step 1: Create the component**

Create `src/phases/Autobio.score.jsx`:
```jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { searchTracks } from '../lib/itunesSearch'
import { summarizeAutobio } from '../lib/autobio'

const PROMPTS = [
  { id: 'became_someone', text: 'A song from when you became someone.' },
  { id: 'one_person',     text: 'A song that belongs to one specific person.' },
  { id: 'first_yours',    text: 'The first song that felt like it was yours — not borrowed.' },
]

const SEARCH_DEBOUNCE_MS = 300

export default function Autobio({ onNext, avd }) {
  const [promptIdx, setPromptIdx] = useState(0)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const songsRef = useRef([])
  const debounceRef = useRef(null)
  const abortRef = useRef(null)

  // Debounced iTunes search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    if (!query.trim()) {
      setResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const tracks = await searchTracks(query, controller.signal)
        setResults(tracks.slice(0, 5))
      } catch (e) {
        if (e.name !== 'AbortError') setResults([])
      } finally {
        setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  const recordSong = useCallback((song) => {
    songsRef.current.push({
      ...song,
      prompt: PROMPTS[promptIdx].id,
    })
    setQuery('')
    setResults([])

    if (promptIdx + 1 >= PROMPTS.length) {
      // Summarize and advance
      const summary = summarizeAutobio(songsRef.current)
      avd.setPhaseData('autobio', summary)
      setTimeout(() => onNext({ autobio: summary }), 800)
    } else {
      setPromptIdx(promptIdx + 1)
    }
  }, [promptIdx, avd, onNext])

  const handleSelectResult = (track) => {
    recordSong({
      title: track.title,
      artist: track.artist,
      year: track.year,
    })
  }

  const handleSubmitFreeText = () => {
    const trimmed = query.trim()
    if (!trimmed) return
    recordSong({ title: trimmed, artist: '', year: null })
  }

  const currentPrompt = PROMPTS[promptIdx]

  return (
    <Paper variant="cream">
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 28px',
      }}>
        <motion.div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: COLORS.inkCreamSecondary,
            letterSpacing: '0.18em',
            marginBottom: 20,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 0.6 }}
        >
          v. three songs you carry · {promptIdx + 1} / {PROMPTS.length}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentPrompt.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.5 }}
            style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 19,
              color: COLORS.inkCream,
              lineHeight: 1.5,
              marginBottom: 24,
            }}
          >
            {currentPrompt.text}
          </motion.div>
        </AnimatePresence>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitFreeText() }}
          placeholder="type a song or artist..."
          autoFocus
          style={{
            width: '100%',
            padding: '12px 16px',
            border: `1px solid ${COLORS.inkCreamSecondary}`,
            background: 'transparent',
            color: COLORS.inkCream,
            fontFamily: FONTS.serif,
            fontSize: 16,
            outline: 'none',
            borderRadius: 4,
            marginBottom: 12,
          }}
        />

        {/* Autocomplete results */}
        <div style={{ minHeight: 240 }}>
          {searching && (
            <div style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 12,
              color: COLORS.inkCreamSecondary,
              padding: '8px 0',
            }}>
              searching...
            </div>
          )}
          {!searching && results.map((track) => (
            <button
              key={track.id}
              onClick={() => handleSelectResult(track)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${COLORS.inkCreamSecondary}33`,
                fontFamily: FONTS.serif,
                fontSize: 14,
                color: COLORS.inkCream,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontStyle: 'italic' }}>{track.title}</div>
              <div style={{ fontSize: 12, color: COLORS.inkCreamSecondary }}>
                {track.artist}{track.year ? ` · ${track.year}` : ''}
              </div>
            </button>
          ))}
          {!searching && query.trim() && results.length === 0 && (
            <button
              onClick={handleSubmitFreeText}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: 14,
                color: COLORS.scoreAmber,
                cursor: 'pointer',
              }}
            >
              keep "{query}" as your answer
            </button>
          )}
        </div>
      </div>
    </Paper>
  )
}
```

- [ ] **Step 2: Lint check**

Run: `npm run lint -- src/phases/Autobio.score.jsx`
Expected: no NEW errors.

- [ ] **Step 3: Commit**

```bash
git add src/phases/Autobio.score.jsx
git commit -m "feat(score-v2): add Autobio phase — 3 Rathbone prompts with iTunes autocomplete"
```

---

## Task 9: Wire Gems and Autobio into App.jsx PHASES

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Read the current PHASES array**

Read `src/App.jsx`. Phase 1 set PHASES to:
```js
const PHASES = ['entry', 'spectrum', 'depth', 'textures', 'moment', 'reflection', 'reveal', 'orchestra']
```

- [ ] **Step 2: Replace `'textures'` with `'gems'` and insert `'autobio'`**

Edit `src/App.jsx`. At the top of the file, replace the existing import:
```jsx
import Textures from './phases/Textures.score'
```
with:
```jsx
import Gems from './phases/Gems.score'
import Autobio from './phases/Autobio.score'
```

Replace the PHASES line with:
```js
const PHASES = ['entry', 'spectrum', 'depth', 'gems', 'moment', 'autobio', 'reflection', 'reveal', 'orchestra']
```

In the `phaseComponent` map, replace:
```jsx
textures: <Textures onNext={nextPhase} avd={avdEngine} inputMode={inputMode} />,
```
with:
```jsx
gems: <Gems onNext={nextPhase} avd={avdEngine} />,
```

And insert between `moment:` and `reflection:`:
```jsx
autobio: <Autobio onNext={nextPhase} avd={avdEngine} />,
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: no new errors related to App.jsx.

Run: `npm test`
Expected: all tests pass.

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(score-v2): swap textures→gems, insert autobio between moment and reflection"
```

---

## Task 10: Update buildMemoryCallback to prefer autobio songs

**Files:**
- Modify: `src/lib/forerLines.js`
- Modify: `src/lib/__tests__/forerLines.test.js`

- [ ] **Step 1: Add a regression test**

In `src/lib/__tests__/forerLines.test.js`, find the `describe('buildMemoryCallback', ...)` block. Add these tests inside it (after the existing tests, before the closing `})`):

```js
  it('prefers autobio songs over textures when present', () => {
    const phaseData = {
      spectrum: { pairs: [{ choice: 'right', label: 'warmth' }], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: ['strings'], rejected: [], neutral: [] },
      moment: { totalDownbeats: 30 },
      autobio: {
        songs: [
          { title: 'Karma Police', artist: 'Radiohead', year: 1997, prompt: 'became_someone' },
        ],
        eraSummary: { median: 1997, span: 0, clustered: false },
      },
    }
    const line = buildMemoryCallback(phaseData)
    expect(line).toContain('Karma Police')
    expect(line).toContain('1997')
  })

  it('falls back to textures when autobio.songs is empty', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: ['strings'], rejected: [], neutral: [] },
      moment: { totalDownbeats: 30 },
      autobio: { songs: [], eraSummary: null },
    }
    const line = buildMemoryCallback(phaseData)
    expect(line).toContain('strings')
  })

  it('handles autobio song without year', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalDownbeats: 0 },
      autobio: {
        songs: [{ title: 'Some Song', artist: '', year: null, prompt: 'first_yours' }],
        eraSummary: { median: null, span: 0, clustered: false },
      },
    }
    const line = buildMemoryCallback(phaseData)
    expect(line).toContain('Some Song')
    // No year should mean no year-specific phrasing crash
    expect(line).not.toContain('null')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/lib/__tests__/forerLines.test.js`
Expected: FAIL on the 3 new tests (they reference autobio behavior not yet implemented).

- [ ] **Step 3: Implement the autobio-first behavior**

Edit `src/lib/forerLines.js`. Replace the existing `buildMemoryCallback` function:
```js
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
```
with:
```js
export function buildMemoryCallback(phaseData) {
  const songs = phaseData.autobio?.songs || []
  if (songs.length > 0) {
    const first = songs[0]
    if (first.year) {
      return `when you said ${first.title} from ${first.year}, i knew`
    }
    return `when you said ${first.title}, i knew`
  }
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/lib/__tests__/forerLines.test.js`
Expected: all tests PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/forerLines.js src/lib/__tests__/forerLines.test.js
git commit -m "feat(score-v2): wire autobio songs into Mirror memory callback"
```

---

## Task 11: Update reflectionLines to add gems + autobio, drop textures

**Files:**
- Modify: `src/lib/reflectionLines.js`
- Modify: `src/lib/__tests__/reflectionLines.test.js`

- [ ] **Step 1: Update tests**

In `src/lib/__tests__/reflectionLines.test.js`, replace the test that asserts `lines.textures` with tests for `lines.gems` and `lines.autobio`. Find the existing test:

```js
  it('produces four lines: spectrum, depth, textures, moment', () => {
```

Replace its assertion block with this updated version (also rename the test):
```js
  it('produces five lines: spectrum, depth, gems, moment, autobio', () => {
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
      gems: { excerpts: [{ id: 'sublimity', tilesSelected: ['awed', 'peaceful'] }] },
      moment: { totalDownbeats: 30, avgGestureGain: 0.4, tactus: [] },
      autobio: {
        songs: [{ title: 'A', artist: 'X', year: 2003 }],
        eraSummary: { median: 2003, span: 0, clustered: false },
      },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.spectrum).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.depth).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.gems).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.moment).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.autobio).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
  })
```

Then ADD these new tests at the end of the existing `describe('buildReflectionLines', ...)` block (before its closing `})`):

```js
  it('gems line names the dominant tile', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: {
        excerpts: [
          { id: 'a', tilesSelected: ['nostalgic', 'tender'] },
          { id: 'b', tilesSelected: ['nostalgic'] },
          { id: 'c', tilesSelected: ['defiant'] },
        ],
      },
      moment: { totalDownbeats: 30 },
      autobio: { songs: [], eraSummary: null },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.gems.signal.toLowerCase()).toContain('nostalgic')
  })

  it('gems line falls back gracefully when no tiles selected', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: { excerpts: [] },
      moment: { totalDownbeats: 0 },
      autobio: { songs: [], eraSummary: null },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.gems.signal).toBeTruthy()
    expect(lines.gems.interpretation).toBeTruthy()
  })

  it('autobio line names a year when songs are present', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: { excerpts: [] },
      moment: { totalDownbeats: 30 },
      autobio: {
        songs: [
          { title: 'A', artist: 'X', year: 2001 },
          { title: 'B', artist: 'Y', year: 2003 },
          { title: 'C', artist: 'Z', year: 2005 },
        ],
        eraSummary: { median: 2003, span: 4, clustered: true },
      },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.autobio.signal).toContain('2003')
  })

  it('autobio line falls back gracefully when no songs', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: { excerpts: [] },
      moment: { totalDownbeats: 0 },
      autobio: { songs: [], eraSummary: null },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.autobio.signal).toBeTruthy()
  })
```

Also remove (or leave) the old "textures line lists preferred names" test — since `lines.textures` will no longer exist on the return object. **Remove it.**

- [ ] **Step 2: Update the existing "handles missing/zero data" test fixture**

Find the existing `it('handles missing/zero data gracefully', ...)` test. Update its `phaseData` fixture to include the new `gems` and `autobio` keys with empty defaults:
```js
const phaseData = {
  spectrum: { pairs: [], hoveredButNotChosen: [] },
  depth: { finalLayer: 1, maxLayer: 1 },
  textures: { preferred: [], rejected: [], neutral: [] },
  gems: { excerpts: [] },
  moment: { totalDownbeats: 0, avgGestureGain: 0, tactus: [] },
  autobio: { songs: [], eraSummary: null },
}
const lines = buildReflectionLines(baseAvd, phaseData)
expect(lines.spectrum.signal).toBeTruthy()
expect(lines.depth.signal).toBeTruthy()
expect(lines.gems.signal).toBeTruthy()
expect(lines.moment.signal).toBeTruthy()
expect(lines.autobio.signal).toBeTruthy()
```

(Drop the `expect(lines.textures.signal).toBeTruthy()` line.)

- [ ] **Step 3: Run tests to verify failures**

Run: `npm test -- --run src/lib/__tests__/reflectionLines.test.js`
Expected: FAIL — `lines.gems` and `lines.autobio` are undefined.

- [ ] **Step 4: Implement gems + autobio line generators**

Edit `src/lib/reflectionLines.js`. After the existing `import { computeBpm } from './moment.js'` line, add:
```js
import { dominantGemsTag } from './gemsTags.js'
import { buildEraLine } from './era.js'
```

After `buildMomentLine` (above `export function buildReflectionLines`), insert two new generators:
```js
function buildGemsLine(phaseData) {
  const dom = dominantGemsTag(phaseData.gems?.excerpts)
  if (!dom) {
    return {
      signal: 'no emotion tiles selected',
      interpretation: 'you held back. some things resist naming.',
    }
  }
  const interp = {
    nostalgic:   'you let nostalgia land — most people skip past it',
    awed:        'you stayed open to wonder — that\'s harder than it sounds',
    tender:      'tenderness reached you — you let it',
    melancholic: 'you let the sad ones in. you weren\'t looking away',
    defiant:     'you found something to push against',
    peaceful:    'you let the room be quiet',
  }[dom] || 'something landed'
  return {
    signal: `${dom} kept showing up`,
    interpretation: interp,
  }
}

function buildAutobioLine(phaseData) {
  const songs = phaseData.autobio?.songs || []
  if (songs.length === 0) {
    return {
      signal: 'no songs named',
      interpretation: 'sometimes the song comes later',
    }
  }
  const eraLine = buildEraLine(phaseData.autobio?.eraSummary)
  if (eraLine) {
    return {
      signal: eraLine,
      interpretation: 'a body remembers the music it grew up beside',
    }
  }
  const first = songs[0]
  return {
    signal: `you started with ${first.title}`,
    interpretation: 'the first song matters more than you think',
  }
}
```

Then update the main `buildReflectionLines` export to return `{ spectrum, depth, gems, moment, autobio }`:
```js
export function buildReflectionLines(avd, phaseData) {
  return {
    spectrum: buildSpectrumLine(phaseData),
    depth: buildDepthLine(phaseData),
    gems: buildGemsLine(phaseData),
    moment: buildMomentLine(phaseData),
    autobio: buildAutobioLine(phaseData),
  }
}
```

(The previous `buildTexturesLine` function can be deleted — it's no longer referenced.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run src/lib/__tests__/reflectionLines.test.js`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reflectionLines.js src/lib/__tests__/reflectionLines.test.js
git commit -m "feat(score-v2): replace textures line with gems + autobio in reflection"
```

---

## Task 12: Update Reflection.score.jsx to render 5 lines

**Files:**
- Modify: `src/phases/Reflection.score.jsx`

- [ ] **Step 1: Read the current component**

Read `src/phases/Reflection.score.jsx`. Phase 1 maps over `[built.spectrum, built.depth, built.textures, built.moment]` and uses `LINES_TOTAL = 4`.

- [ ] **Step 2: Update the lines array and constant**

Edit `src/phases/Reflection.score.jsx`:

Find:
```js
const LINES_TOTAL = 4
```
Replace with:
```js
const LINES_TOTAL = 5
```

Find:
```jsx
return [
  built.spectrum,
  built.depth,
  built.textures,
  built.moment,
]
```
Replace with:
```jsx
return [
  built.spectrum,
  built.depth,
  built.gems,
  built.moment,
  built.autobio,
]
```

- [ ] **Step 3: Verify**

Run: `npm run lint -- src/phases/Reflection.score.jsx`
Expected: no NEW errors.

Run: `npm test`
Expected: all tests pass.

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/phases/Reflection.score.jsx
git commit -m "feat(score-v2): Reflection now renders 5 lines (spectrum, depth, gems, moment, autobio)"
```

---

## Task 13: scoreArchetype variation selector — prefer autobio era

**Files:**
- Modify: `src/lib/scoreArchetype.js`
- Modify: `src/lib/__tests__/scoreArchetype.test.js`

- [ ] **Step 1: Add a regression test**

In `src/lib/__tests__/scoreArchetype.test.js`, find the existing `describe('scoreArchetype', ...)` block. Add this test after the existing tests (before the closing `})`):

```js
  it('prefers autobio era median over depth heuristic for variation pick', () => {
    // The Late-Night Architect has variations spanning eras 1975, 1985, 2015, 2022.
    // With autobio.eraSummary.median = 1985, the closest variation should be picked
    // over what the depth heuristic alone would suggest.
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 8, maxLayer: 8 },  // depth would normally push toward 2020s
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: { excerpts: [] },
      moment: { totalDownbeats: 30 },
      autobio: {
        songs: [
          { title: 'A', artist: 'X', year: 1985 },
          { title: 'B', artist: 'Y', year: 1986 },
          { title: 'C', artist: 'Z', year: 1984 },
        ],
        eraSummary: { median: 1985, span: 2, clustered: true },
      },
    }
    // Use a deterministic rand that never triggers ε-greedy (always returns >= 0.5).
    const result = scoreArchetype({ a: 0.3, v: 0.4, d: 0.85 }, phaseData, () => 0.99)
    expect(result.archetypeId).toBe('late-night-architect')
    expect(result.variationId).toBe('synth-melancholy-1980s')
  })
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --run src/lib/__tests__/scoreArchetype.test.js`
Expected: FAIL on the new test (variation pick uses depth heuristic only).

- [ ] **Step 3: Implement era-driven variation selection**

Edit `src/lib/scoreArchetype.js`. Find the `selectVariation` function:
```js
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
```

Replace with:
```js
function selectVariation(archetype, phaseData, rand = Math.random) {
  // ε-greedy: sometimes return a random variation for serendipity.
  if (rand() < EPSILON_VARIATION) {
    const idx = Math.floor(rand() * archetype.variations.length)
    return archetype.variations[idx]
  }

  // Prefer the autobio era median when present — the user's named songs are
  // a stronger era signal than the depth-density heuristic.
  const autobioMedian = phaseData.autobio?.eraSummary?.median
  if (typeof autobioMedian === 'number' && autobioMedian > 0) {
    const ranked = archetype.variations
      .map(v => ({ variation: v, score: -Math.abs(v.era - autobioMedian) }))
      .sort((a, b) => b.score - a.score)
    return ranked[0].variation
  }

  // Fall back to the depth-density heuristic from Phase 1.
  const depthNorm = Math.min(1, (phaseData.depth?.finalLayer || 1) / 8)
  const texCount = (phaseData.textures?.preferred || []).length

  const variationScores = archetype.variations.map(v => {
    const eraNorm = (v.era - 1960) / 70
    const eraFit = 1 - Math.abs(depthNorm - eraNorm)
    const textureFit = texCount / 8
    return { variation: v, score: eraFit * 0.7 + textureFit * 0.3 }
  })

  variationScores.sort((a, b) => b.score - a.score)
  return variationScores[0].variation
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/lib/__tests__/scoreArchetype.test.js`
Expected: all tests PASS (existing 8 + new 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoreArchetype.js src/lib/__tests__/scoreArchetype.test.js
git commit -m "feat(score-v2): variation selector prefers autobio era median over depth"
```

---

## Task 14: Spectrum imports ACTIVE_PAIRS from spectrumPairs.js

**Files:**
- Modify: `src/phases/Spectrum.score.jsx`

- [ ] **Step 1: Read the current PAIRS constant**

Read the top of `src/phases/Spectrum.score.jsx`. The PAIRS array is defined inline at lines ~10–27.

- [ ] **Step 2: Replace inline PAIRS with import**

Edit `src/phases/Spectrum.score.jsx`. After the existing imports at the top, add:
```jsx
import { ACTIVE_PAIRS } from '../lib/spectrumPairs'
```

Then delete the inline `const PAIRS = [...]` block (the entire 8-pair definition).

Find every reference to `PAIRS` in the file (e.g., `const pair = PAIRS[pairIdx]`, `PAIRS[pairIdx]`, `PAIRS.length`, `PAIRS_V2.length`, etc.) and rename them to `ACTIVE_PAIRS`. The simplest way is a global rename: `PAIRS` → `ACTIVE_PAIRS` across the file body.

- [ ] **Step 3: Verify**

Run: `npm run lint -- src/phases/Spectrum.score.jsx`
Expected: no new errors.

Run: `npm test`
Expected: all tests pass.

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/phases/Spectrum.score.jsx
git commit -m "feat(score-v2): Spectrum imports ACTIVE_PAIRS — ready for v2 audio swap"
```

---

## Task 15: Depth equivoque copy

**Files:**
- Modify: `src/phases/Depth.score.jsx`

- [ ] **Step 1: Update the instruction text**

Edit `src/phases/Depth.score.jsx`. Find this block (around line 199–202):
```jsx
{layers === 0 && (
  <motion.div
    style={{ ... }}
    ...
  >
    tap anywhere
  </motion.div>
)}
```

Change the inner text from `tap anywhere` to:
```jsx
hold this until the room has the right amount of you in it
```

- [ ] **Step 2: Verify**

Run: `npm run lint -- src/phases/Depth.score.jsx`
Expected: no new errors.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/phases/Depth.score.jsx
git commit -m "feat(score-v2): Depth equivoque framing — unfalsifiable agency copy"
```

---

## Task 16: Moment Hurley liking probe

**Files:**
- Modify: `src/phases/Moment.score.jsx`

After the build-and-drop completes (`finishPhase` runs), insert a 4-second probe asking "did that feel good?" before advancing. Capture the answer (or null on timeout) into `phaseData.moment.hedonic`.

- [ ] **Step 1: Add Hurley state and refactor finishPhase**

Edit `src/phases/Moment.score.jsx`. At the top of the component (near other `useState` lines around line 32–38), add:
```js
const [hurleyVisible, setHurleyVisible] = useState(false)
const hurleyTimeoutRef = useRef(null)
const hedonicRef = useRef(null)
```

Find the existing `finishPhase` callback (around lines 92–118). Replace it with:
```jsx
const completeAndAdvance = useCallback(() => {
  if (finishedRef.current) return
  finishedRef.current = true

  const avgGesture = sampleCount.current > 0 ? gestureSum.current / sampleCount.current : 0
  const dbCount = downbeatCount.current
  const downbeatBonus = dbCount > 5 ? 0.2 : dbCount * 0.04
  const A = clamp(avgGesture + downbeatBonus, 0, 1)

  avd.setArousal(A)
  avd.setPhaseData('moment', {
    totalDownbeats: dbCount,
    avgGestureGain: Math.round(avgGesture * 100) / 100,
    tactus: tactusPoints.current.slice(),
    hedonic: hedonicRef.current,
  })

  const musicPromise = Promise.resolve('/chamber/tracks/track-a.mp3')

  playVoice(VOICE_PATHS[3])
  setTimeout(() => {
    onNext({
      moment: { totalDownbeats: dbCount, avgGestureGain: avgGesture, hedonic: hedonicRef.current },
      musicPromise,
    })
  }, 1500)
}, [avd, onNext])

const handleHurleyAnswer = useCallback((liked) => {
  hedonicRef.current = liked
  clearTimeout(hurleyTimeoutRef.current)
  setHurleyVisible(false)
  completeAndAdvance()
}, [completeAndAdvance])

const finishPhase = useCallback(() => {
  setPhase('done')
  setHurleyVisible(true)
  // Auto-advance with hedonic = null after 4s
  hurleyTimeoutRef.current = setTimeout(() => {
    setHurleyVisible(false)
    completeAndAdvance()
  }, 4000)
}, [completeAndAdvance])
```

(The previous `finishPhase` body is replaced by `completeAndAdvance`. The new `finishPhase` only sets the Hurley UI; advance happens after answer or timeout.)

- [ ] **Step 2: Add the Hurley UI**

In the JSX return, add this block after the existing rendered content but before the closing `</Paper>` (or `</div>`). Find the spot just before `</Paper>` near the bottom and insert:

```jsx
{hurleyVisible && (
  <motion.div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: COLORS.paperDark,
      gap: 24,
    }}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.6 }}
  >
    <div style={{
      fontFamily: FONTS.serif,
      fontStyle: 'italic',
      fontSize: 22,
      color: COLORS.inkDark,
      textAlign: 'center',
      padding: '0 32px',
    }}>
      did that feel good?
    </div>
    <div style={{ display: 'flex', gap: 32 }}>
      <button
        onClick={() => handleHurleyAnswer(true)}
        style={{
          background: 'transparent',
          border: `1px solid ${COLORS.inkDarkSecondary}`,
          color: COLORS.inkDark,
          padding: '12px 32px',
          fontFamily: FONTS.serif,
          fontStyle: 'italic',
          fontSize: 16,
          cursor: 'pointer',
          borderRadius: 4,
        }}
      >
        yes
      </button>
      <button
        onClick={() => handleHurleyAnswer(false)}
        style={{
          background: 'transparent',
          border: `1px solid ${COLORS.inkDarkSecondary}`,
          color: COLORS.inkDarkSecondary,
          padding: '12px 32px',
          fontFamily: FONTS.serif,
          fontStyle: 'italic',
          fontSize: 16,
          cursor: 'pointer',
          borderRadius: 4,
        }}
      >
        no
      </button>
    </div>
  </motion.div>
)}
```

- [ ] **Step 3: Cleanup the unmount handler**

In the existing `useEffect` cleanup (the one that calls `engine.stop()`), add:
```js
clearTimeout(hurleyTimeoutRef.current)
```

- [ ] **Step 4: Verify**

Run: `npm run lint -- src/phases/Moment.score.jsx`
Expected: no new errors.

Run: `npm test`
Expected: all tests pass.

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/phases/Moment.score.jsx
git commit -m "feat(score-v2): Moment Hurley probe — captures hedonic yes/no after build"
```

---

## Task 17: Final integration verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass. Phase 2 added unit tests for era, autobio, itunesSearch, gemsTags, spectrumPairs (5 modules), plus regression tests for forerLines, reflectionLines, scoreArchetype. Expected count: 60+ tests across 9+ test files.

- [ ] **Step 2: Run a clean build**

Run: `npm run build`
Expected: succeeds, no errors.

- [ ] **Step 3: Manual walkthrough in dev server**

Run: `npm run dev`
Open `http://localhost:5173/` in a browser. Walk through the full flow.

| Check | Expected |
|---|---|
| PHASES order | entry → spectrum → depth → **gems** → moment → **autobio** → reflection → reveal → orchestra |
| Gems phase plays 3 excerpts | Each ~15s; tile fade follows. Audio may be silent if `public/gems/*.mp3` placeholders aren't filled — that's expected for code-only phase 2. |
| Gems tile selection | Tap multiple tiles per excerpt; selections highlight in amber; auto-advance after 6s. |
| Moment Hurley probe | After conducting build completes, "did that feel good?" appears for ~4s. Yes/no captured; auto-advance on timeout. |
| Autobio prompts | 3 sequential prompts. Type a song name → debounced (300ms) iTunes results appear. Tap a result → next prompt. Or hit Enter to submit free-text fallback. |
| Reflection screen | Renders 5 lines (spectrum, depth, gems, moment, autobio). The autobio line names a year if songs cluster, otherwise a fallback. |
| Mirror memory callback | Names one of the autobio songs ("when you said {title} from {year}, i knew") instead of the Phase 1 texture/spectrum fallback. |
| Variation pick | If autobio years are e.g. 1985-1987, the Mirror microgenre label should reference the 1980s variation of the chosen archetype. |

- [ ] **Step 4: Optional cleanup commit**

If any small inconsistencies are surfaced during the manual walkthrough, fix and commit:
```bash
git add -p
git commit -m "fix(score-v2): polish phase 2 gems/autobio integration"
```

If nothing to fix, skip.

---

## Self-review checklist

- [ ] **Spec coverage** (each Phase 2 scope item maps to a task):
  - Replace Textures with GEMS probe → Tasks 4, 7, 9 ✓
  - Add autobio module → Tasks 2, 3, 8, 9 ✓
  - Era contextualization → Tasks 1, 11 ✓
  - Spectrum 9 polar pairs → Tasks 5, 14 ✓
  - Hurley liking probe → Task 16 ✓
  - Equivoque framing → Task 15 (Depth); Task 16 includes the Hurley moment which is the equivoque move on Moment ✓
  - Wire autobio into Mirror memory callback → Task 10 ✓
  - Reflection 5-line render → Tasks 11, 12 ✓
  - Variation selector era preference → Task 13 ✓

- [ ] **No placeholders** — every code block above is shippable. Placeholder *audio paths* are documented in the asset table (`public/gems/*.mp3`, `public/spectrum/v2/*.mp3`) but the *code* does not contain TODOs.

- [ ] **Type/name consistency:**
  - `phaseData.gems.excerpts: [{ id, tilesSelected, reactionMs }]` — used in Gems.score.jsx (Task 7), gemsTags.js (Task 4), reflectionLines.js (Task 11). Consistent.
  - `phaseData.autobio = { songs: [{ title, artist, year, prompt }], eraSummary }` — used in Autobio.score.jsx (Task 8), autobio.js (Task 2), forerLines.js (Task 10), reflectionLines.js (Task 11), scoreArchetype.js (Task 13). Consistent.
  - `eraSummary = { median, span, clustered }` — defined in era.js (Task 1), used in autobio.js, scoreArchetype.js, reflectionLines.js. Consistent.
  - `Track = { title, artist, year, id, artworkUrl }` from itunesSearch — used in Autobio.score.jsx. Consistent.

- [ ] **Backward compatibility:** `phaseData.textures` retained in the AVDEngine default (Task 6) so `forerLines.buildMemoryCallback` can still fall back if autobio is empty. Mirror, Reflection, scoreArchetype all degrade gracefully when autobio.songs is empty.

---

## Out-of-scope notes (Phase 3 territory)

- **GEMS audio assets** — three 15s excerpts at `public/gems/sublimity.mp3`, `public/gems/tenderness.mp3`, `public/gems/tension.mp3`. Generate via ElevenLabs Music API in Phase 3.
- **Spectrum v2 audio assets** — 18 files at `public/spectrum/v2/*.mp3`. Once landed, flip `ACTIVE_PAIRS` in `src/lib/spectrumPairs.js` from `PAIRS_LEGACY` to `PAIRS_V2`.
- **ElevenLabs Admirer voice** — voice cues for Gems and Autobio phases (warm intro, prompt-by-prompt narration). Phase 3.
- **Composition plan derivation from variation tag + autobio era** — Phase 3 will route the Mirror's chosen variation + era median into ElevenLabs Music API to generate a track that matches.
- **Hedonic field consumption** — Phase 2 captures `phaseData.moment.hedonic` but doesn't yet feed it into Mirror's archetype scoring or Forer template selection. Phase 3 may use it to bias the archetype choice (e.g., if hedonic=false, lean toward Quiet Insurgent over Sky-Seeker).
- **Era-aware variation selector tuning** — Task 13 picks the variation closest in absolute years to the autobio median. If the user's autobio years span decades, a more sophisticated scorer might pick by mode rather than median. Phase 3.
