# Desktop Journal — Slice 5: The Sky — Design Spec

*Status: design, agreed via brainstorm 2026-05-21. Branch: `musicking`. Builds
directly on Slices 1–4 of the desktop journal. This doc is the spec the slice
is built from; the implementation plan follows.*

---

## 1. What this slice is

Slice 5 is the **collective "sky"** (design doc §7) — the desktop journal's
third surface, alongside the landing and the book. Where the book is the
intimate, single-person past tense, the sky is the field: a slowly turning
dark globe with warm glyph-lights scattered across it, on which the user finds
**their own cluster of lights among many others**.

It delivers four things:

- **A Mapbox GL globe** with a fully custom, code-defined dark style — faint
  ink landmasses over a void ocean, no roads/labels/POIs/borders. "Earth at
  night."
- **The "rise to the field" transition** — one continuous gesture from a book
  page up into the sky (design doc §7), reusing the journal's existing cloud
  veil and rAF transition orchestrator.
- **The user's own glyphs placed geographically** — real entries are placed on
  the globe at a coarsened location, glowing warm in the user's "hand" hue.
- **A mock collective field** — a cool, faint wash of ~500 mock lights so the
  sky reads as inhabited.

### What it is *not*

The §12 build sequence puts "the self-among-others view (§7)" — real
anonymized glyphs from all accounts, and the explicit *mine / the field /
both* toggle — in **Slice 6**. Slice 5 stops at: the globe, the transition,
the user's own real glyphs, and a *mock* collective wash rendered distinctly
enough that you can find yourself. No toggle, no click interactions.

### Decisions taken in the brainstorm

- **Mapbox, with graceful degradation.** Built on Mapbox GL JS (design doc §7).
  It needs a free account and a public access token (`VITE_MAPBOX_TOKEN`).
  When the token is absent the sky is simply not offered — the "rise" affordance
  is hidden and the build never breaks, mirroring how the journal already
  degrades without Supabase.
- **Vercel geo headers for location.** The user's location comes from Vercel's
  `x-vercel-ip-*` request headers via a new `api/geo` endpoint — no permission
  prompt, no third-party service, coarse by construction. This makes real
  entries place on the map starting now.
- **A code-defined style.** The custom dark style lives in the repo as a plain
  Mapbox style object — no Mapbox Studio artifact to maintain or drift. Matches
  the project's "config all in code" ethos.
- **Sky as a Journal-owned surface.** `CollectiveSky` is its own component but
  mounted *inside* `Journal.jsx` and driven by the journal's existing rAF
  transition orchestrator + `CloudCanvas` veil. The "rise" is literally one
  rAF loop — the only way it stays one continuous gesture.

---

## 2. Scope

### In scope

- A new `CollectiveSky` component owning a Mapbox GL globe.
- A code-defined Mapbox style (`skyStyle.js`).
- The `rise` / `descend` transitions, added to `Journal.jsx`'s orchestrator.
- Location plumbing: an `api/geo` endpoint, a pure `geo.js` helper module, and
  the `region` write path through `useRiteSession` → `entriesRepo`.
- The user's own entries placed as warm lights; a mock collective wash.
- Pure, unit-tested modules: `geo.js`, `skyPresets.js`, `mockCollective.js`.

### Out of scope — deliberate boundaries

- **The real collective.** Slice 6. The collective wash here is mock data.
- **The *mine / the field / both* toggle.** Slice 6 — both layers render
  distinctly in Slice 5, but with no toggle UI.
- **Click interactions** — clicking a light, flying back down into an entry.
  Other people are "atmosphere, never affordances" (§7); the user's own marks
  are isolable by *sight*, not by click. Slice 6 may revisit.
- **Backfilling region onto pre-Slice-5 entries.** Real entries written before
  this slice have `region: null` and are simply **not placed** on the sky
  (they still live in the book). The sky shows what has a location. Accepted in
  the brainstorm.
- **A schema migration.** The `entries.region` column already exists
  (`supabase/schema.sql`, added "slice 5/6"). Slice 5 only starts *writing* it.

---

## 3. The location plumbing

### 3.1 `api/geo.js`

A new Vercel serverless route, following the existing `api/` pattern (mounted
in dev by the Vite middleware in `vite.config.js`, auto-deployed by Vercel).

- **Reads** Vercel's geolocation request headers — `x-vercel-ip-latitude` and
  `x-vercel-ip-longitude` (string-valued, IP-derived, city-level coarse).
- **Coarsens server-side.** Raw coordinates are passed through
  `coarsenLocation` (§3.2) *before* the response is built — so even
  IP-precision coordinates never reach the client. Privacy by construction.
- **Returns** `{ region }` — `region` is the coarsened cell-centre string, or
  `null` when the headers are absent (local dev) or unparseable.
- No auth, no body — a plain `GET`. Errors degrade to `{ region: null }`
  rather than a non-200; the caller treats geo as best-effort (§3.4).

### 3.2 `src/lib/geo.js` — pure geo helpers

A new pure-function module, unit-tested. Knows nothing of entries, the map, or
the network.

- `coarsenLocation(lat, lng) → "lat,lng"` — snaps a coordinate to a **1° grid**
  (≈ 100 km cells) by rounding to the nearest integer degree, and returns the
  cell-centre as a `"lat,lng"` string (the value stored in `entries.region`).
  Returns `null` for non-finite input.
- `regionToLatLng(region) → { lat, lng } | null` — parses a stored region
  string back to a coordinate; `null` for missing/malformed input.
- `jitterInCell(region, seed) → { lat, lng } | null` — deterministic
  per-entry jitter of up to **±0.5°** around the cell centre, seeded by `seed`
  (via the existing `mulberry32` PRNG, `src/lib/mulberry32.js`). The offset
  stays inside the 1° cell, so it de-stacks co-located entries visually
  **without** narrowing the coarsening — no privacy regression.

### 3.3 `region` through the data layer

- `supabase/schema.sql` — **unchanged**; `region text` already exists.
- `entriesRepo.createEntry(userId, { song, summary, glyph, region })` — accepts
  and inserts `region`.
- `entriesRepo.fetchEntries` — adds `region` to its `select`.
- `entriesRepo.seedSampleEntries` — writes each mock entry's `region` (§6.2) so
  a seeded account also has a populated sky.
- `entryFormat.normalizeEntries` — carries `region` through onto the journal
  entry object.

### 3.4 Capturing region at settle

`useRiteSession` writes the entry when the phone relays it at settle (the
`createEntry` call, currently `useRiteSession.js:85`). Slice 5 inserts one
best-effort step before it:

- Lazily `fetch('/api/geo')` **once per session**, cached in a ref.
- Pass the resolved `region` into `createEntry(uid, { song, summary, glyph,
  region })`.
- **Best-effort.** A failed or slow geo fetch resolves to `region: null`; the
  entry still writes. The loop is never blocked or failed by geolocation.

The location of record is the **desktop's** — the desktop is "home" (design doc
§2); the phone is a baton that inherits identity. `useRiteSession` runs on the
desktop, so the geo fetch is correctly the desktop's.

---

## 4. The collective sky

### 4.1 `src/journal/CollectiveSky.jsx`

A new component, lazy-loaded (`React.lazy` / dynamic `import()`) so the
journal's initial load does not pay for `mapbox-gl` until the first rise.

**Props:** `{ entries, hand, phase }`.

- `entries` — the journal's normalised entries; `CollectiveSky` derives its
  own `selfPoints` from them (§5.1).
- `hand` — the per-account hand (`deriveHand`, already computed in `Desktop`
  and passed to `Journal`); its hue tints the user's own lights (§8 continuity).
- `phase` — `'hidden' | 'rising' | 'open'`, driven by `Journal` (§5.2).

**The map.** It owns one `mapboxgl.Map`:

- `projection: 'globe'`, the code-defined `style` (§4.2), `accessToken` from
  `import.meta.env.VITE_MAPBOX_TOKEN`.
- `setFog(...)` for the atmospheric halo at the globe's edge.
- A hard **`maxZoom` floor** (≈ 4.5) so no single light is ever resolvable as
  an individual — the privacy zoom floor (§7). A `minZoom` keeps the whole
  globe in frame.
- Drag-to-rotate is allowed (looking around the globe is not a social
  affordance); scroll-zoom is constrained by the min/max floor.
- **Slow auto-rotation** when idle — a small per-frame longitude increment;
  paused on user drag, resumed after ~3 s idle. Off during `rising` and during
  the reveal ease (§5.2).

**Token absent.** If `VITE_MAPBOX_TOKEN` is unset, `CollectiveSky` renders a
quiet dark fallback panel instead of constructing a map — a belt-and-braces
guard; `Journal` also hides the rise affordance entirely (§5.3), so in practice
the component is never mounted without a token.

### 4.2 `src/journal/skyStyle.js` — the code-defined style

A pure Mapbox GL **style spec v8 object** (plus the `setFog` arguments).

- A `background` layer — the void ocean, near-black.
- A single faint **land fill** sourced from Mapbox's public
  `country-boundaries-v1` vector tileset (source-layer `country_boundaries`),
  drawn as a low-opacity ink fill with **no outline** — so the union of country
  polygons reads as continents and no borders are visible.
- Nothing else — no roads, labels, POIs, water layers, or symbols.

Keeping it a plain object in the repo means the style is versioned with the
code and cannot drift from a Studio account artifact.

### 4.3 `src/lib/skyPresets.js` — the rise camera

A small pure module, mirroring the shape of `roomPresets.js` — the design doc
(§7, §9) frames the whole journal→collective transition as the project's own
`INTIMATE ↔ EXPANDED` interpolation.

- `INTIMATE` — the zoomed-in camera preset: the user's own cluster, close.
- `EXPANDED` — the globe-overview preset: the whole turning sphere.
- It reuses `easeExpansion` (the canonical smoothstep) from `roomPresets.js` —
  the one expansion curve the design doc §9 names for the whole desktop.

`CollectiveSky` performs the reveal as a single Mapbox `easeTo` from
`INTIMATE.zoom` to `EXPANDED.zoom` with `easeExpansion` as the `easing`
callback — so Mapbox does the per-frame interpolation internally (unlike
`roomPresets`' `roomAt`, which the audio engine samples every frame). The
module therefore exports the two endpoints and the easing, not a sampler.

---

## 5. The rise transition

### 5.1 Placing the user's own glyphs

`CollectiveSky` derives `selfPoints` from `entries` in a `useMemo`, using the
`geo.js` primitives: for each entry that has a `region`, `regionToLatLng` gives
the cell centre and `jitterInCell(region, entry.id)` gives its de-stacked
position. Entries with `region: null` are skipped. The result is
`[{ id, lat, lng }, ...]`.

The **cluster centroid** (mean of `selfPoints`) is the centre `INTIMATE` zooms
to. If `selfPoints` is empty (a user with no placed entries), `INTIMATE` falls
back to the `EXPANDED` overview — the rise still resolves onto the globe, just
without a personal cluster to land on.

### 5.2 The choreography

`Journal.jsx` gains a `view: 'sky'` state and two transition kinds in its
existing rAF orchestrator, alongside `open` / `turn` / `jump`. Both the book's
R3F `Canvas` and `CollectiveSky` stay mounted once created (two WebGL
surfaces — explicitly accepted, design doc §10) and are crossfaded by opacity.

**`rise` (page → sky)** — reuses the `CloudCanvas` veil:

1. The veil pulses up to fully cover. Behind it: the book `Canvas` opacity
   fades 1 → 0, `EntryPage` is hidden, `CollectiveSky` mounts (first rise
   only) and fades 0 → 1. The map sits held at `INTIMATE` zoom, centred on the
   cluster centroid (`phase: 'rising'`).
2. The veil pulses back down, clearing onto the user's **own warm cluster,
   close up**.
3. With the veil clear and `view === 'sky'`, `Journal` sets `phase: 'open'`.
   `CollectiveSky` runs the one-shot slow `easeTo` out to `EXPANDED` (≈ 7 s) —
   *the zoom-out is the meaning; you watch yourself become one light among
   many* (§7). Auto-rotation begins once the ease completes.

**`descend` (sky → page)** — a pure cloud crossfade, like the existing `jump`:
the veil covers, the book `Canvas` opacity returns to 1 and `EntryPage`
re-shows, `CollectiveSky` fades to 0 (stays mounted, `phase: 'hidden'`), the
veil clears on the page.

The book-`Canvas` and sky-`CollectiveSky` wrapper opacities are driven by a
ref read in the orchestrator's `loop()` and applied to the DOM nodes — the
same pattern `CloudCanvas` already uses for `veilRef`.

### 5.3 The affordances

- **Rise** — a quiet "rise to the field" affordance on the `page` view, in the
  cream-paper register (italic serif, restrained), near the existing
  earlier/later nav. Hidden entirely when `VITE_MAPBOX_TOKEN` is unset.
- **Descend** — a sparse "return to the book" affordance on the sky, dark-
  surface styled; the dark sky uses text very sparingly (§9).
- The landing screen is unchanged — the rise originates from a book page, where
  "your own cluster" is a meaningful thing to rise *from*. (Offering it from
  the landing is a possible later addition, not in this slice.)

---

## 6. The mock collective

### 6.1 `src/lib/mockCollective.js`

A new pure module. `MOCK_COLLECTIVE` is a stable array of ~500 `{ lat, lng }`
points, computed once at module load from a fixed seed: ~35 hard-coded
world-metro coordinates, each spawning a deterministic-jittered cluster of a
handful of points (via `mulberry32`). Real geography does the emergent-pattern
work for free (§7) — lights cluster where people live. Deterministic, so the
field is identical across renders and reloads.

`CollectiveSky` renders `MOCK_COLLECTIVE` as the cool, faint wash and
`selfPoints` as the warm, hand-hued lights — two GeoJSON sources. The
collective is a `heatmap` layer: a soft density haze rather than discrete
dots, so the field reads as "other people are atmosphere" and population
clustering does the work. Its `heatmap-color` ramp is deliberately monochrome
and dim — a deep ink-blue that never climbs toward white — so it never looks
like a data-viz hotspot map and always sits below the warm self-lights in
luminance. The self lights stay discrete `circle` layers (a blurred halo
under a bright core) so the user can still pick themselves out. No glyph paths
are drawn — at the sky's zoom floor a light is a light.

### 6.2 Mock entries get a region

So the no-backend dev fallback (`loadMockEntries`, used when Supabase is
unconfigured) and a freshly seeded account both show a populated *self* layer:

- Each entry in `mockEntries.js` gains a `region` — a deterministic spread
  across two or three cities, so the mock "hand" reads as a small constellation.
- `entryFormat.normalizeEntries` carries `region` through (§3.3).

---

## 7. File-level change map

### Create

- `api/geo.js` — the Vercel geo endpoint (§3.1).
- `src/lib/geo.js` — pure geo helpers (§3.2).
- `src/lib/skyPresets.js` — the rise camera presets (§4.3).
- `src/lib/mockCollective.js` — the mock collective field (§6.1).
- `src/journal/CollectiveSky.jsx` — the Mapbox globe component (§4.1).
- `src/journal/skyStyle.js` — the code-defined Mapbox style (§4.2).
- Tests: `src/lib/__tests__/geo.test.js`, `skyPresets.test.js`,
  `mockCollective.test.js`.

### Modify

- `src/journal/Journal.jsx` — `view: 'sky'`; `rise` / `descend` transition
  kinds; mount lazy `CollectiveSky`; the book-`Canvas` / sky opacity crossfade;
  the rise + descend affordances (§5).
- `src/hooks/useRiteSession.js` — best-effort `/api/geo` fetch; pass `region`
  into `createEntry` (§3.4).
- `src/lib/entriesRepo.js` — `createEntry` writes `region`; `fetchEntries`
  selects it; `seedSampleEntries` writes mock regions (§3.3, §6.2).
- `src/lib/entryFormat.js` — `normalizeEntries` carries `region` (§3.3).
- `src/journal/mockEntries.js` — each entry gains a `region` (§6.2).
- `package.json` — add the `mapbox-gl` dependency.
- `CLAUDE.md` — `VITE_MAPBOX_TOKEN` in the env table; `api/geo.js`; the desktop
  journal section (Slice 5 built); the test count.

### Unchanged (explicitly)

- `supabase/schema.sql` — `entries.region` already exists; no migration.
- `EntryPage.jsx`, `Glyph.jsx`, `useEntryAudio.js`, the book GLB and its
  page-turn choreography — Slice 5 adds a surface, it does not touch the book.

---

## 8. Testing

### Unit (vitest)

- **`geo.js`** — `coarsenLocation` snaps to the 1° grid and returns the
  cell-centre string; rejects non-finite input. `regionToLatLng` round-trips a
  coarsened string and returns `null` for malformed input. `jitterInCell` is
  deterministic for a given `(region, seed)`, and every jittered point lies
  inside the 1° cell.
- **`skyPresets.js`** — `INTIMATE` is a closer zoom than `EXPANDED`; the reused
  `easeExpansion` is 0 at 0, 1 at 1, and monotonic.
- **`mockCollective.js`** — `MOCK_COLLECTIVE` is deterministic (stable across
  imports), has a count in the expected range, and every point has a valid
  `lat ∈ [-90, 90]` / `lng ∈ [-180, 180]`.

`api/geo.js`, `CollectiveSky.jsx`, and the `Journal` transition are IO / WebGL
and are not unit-tested (`mapbox-gl` does not run in jsdom) — they are covered
by manual verification.

### Manual end-to-end

1. With a `VITE_MAPBOX_TOKEN` set, open the journal to a page → the "rise to
   the field" affordance is present.
2. Trigger it → the cloud veil covers, the book recedes, the veil clears onto
   the user's own warm cluster, then the slow zoom-out reveals the field.
3. The user's own lights glow warm in their hand hue; the mock collective is a
   cooler, fainter wash; the globe turns slowly and rotates on drag.
4. The zoom floor holds — no single light becomes individually resolvable.
5. Descend → the veil crossfades back onto the book page.
6. Run a real QR-paired rite → at settle the new entry is written *with* a
   `region`; rising afterwards shows it placed on the globe.
7. With `VITE_MAPBOX_TOKEN` unset → the rise affordance is absent; the journal
   and book are otherwise unchanged; the build and the test suite still pass.
8. The no-backend dev fallback (`/journal`, no Supabase) → the sky still shows
   a self cluster from the mock entries' regions.

---

## 9. Risks

- **The land tileset.** The custom style depends on Mapbox's
  `country-boundaries-v1` tileset and its `country_boundaries` source-layer
  name. If the identifiers are wrong the land fill silently renders nothing —
  the sky degrades to a void ocean (still dark, still usable). Verify the
  source/source-layer against current Mapbox docs at build time.
- **Two WebGL contexts.** The R3F book and the Mapbox globe are alive
  simultaneously once the sky has been opened. Explicitly accepted (design doc
  §10); browsers permit far more than two. `CollectiveSky` is lazy-loaded so
  the cost is deferred to the first rise.
- **Vercel geo in dev.** `x-vercel-ip-*` headers exist only on Vercel; local
  dev gets `region: null`. Expected — the no-backend and dev paths rely on the
  mock entries' regions (§6.2) for a populated sky.
- **Public token exposure.** `VITE_MAPBOX_TOKEN` is a `pk.` public token,
  designed to be client-visible; it should be URL-restricted in the Mapbox
  account. Noted, not a code concern.
- **Region-less entries.** Entries written before this slice have no `region`
  and never appear on the sky. Accepted in the brainstorm — the sky shows what
  has a location; the book still holds every entry.
