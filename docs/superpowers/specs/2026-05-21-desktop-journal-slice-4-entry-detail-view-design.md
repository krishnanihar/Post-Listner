# Desktop Journal — Slice 4: The Entry Detail View — Design Spec

*Status: design, agreed via brainstorm 2026-05-21. Branch: `musicking`. Builds
directly on Slice 3 ("close the loop"). This doc is the spec the slice is built
from; the implementation plan follows.*

---

## 1. What this slice is

Slice 4 turns `EntryPage` — the page the journal already lands on — into the
living "room" the design doc §5 describes. Slices 1–3 built a *static* entry
page: a watercolour wash, the recorded glyph drawn complete, the date, the
one-line summary. Slice 4 adds the two things §5 promises but Slice 3 left
inert:

- **Music replay** — the entry's master MP3, streamed from R2, played on a tap.
- **Glyph re-animation** — the recorded ink path re-draws over time, synced to
  the song's playback position.

The result: "re-hear your first entry and hear who you were" (spec 5.6) made
literal — you tap the mark, the song returns, and the gesture re-performs.

### Two decisions taken in the brainstorm

- **The living page.** There is no separate "room" screen or route. `EntryPage`
  itself becomes the room — it gains a play affordance, the audio, and the
  animated glyph. The page you turn to *is* the detail view.
- **Synced to the song.** The audio element is the only clock. The glyph's
  re-animation progress is the audio's playback position; the recorded
  per-point timing sets the *order and relative pacing* of points, normalised
  onto the song's length. The mark and the song finish together; pausing or
  scrubbing the audio pauses the ink with it.

---

## 2. Scope

### In scope

- A new audio hook, `useEntryAudio`, that streams and controls one master MP3.
- The glyph canvas gaining an animated mode driven by playback progress.
- The play/pause affordance: the glyph mark itself is the trigger.
- A pure `revealGlyph` helper for the path-slicing, with unit tests.
- Extracting the glyph canvas from `EntryPage.jsx` into its own file (the code
  has grown and this slice grows it further — see §6).

### Out of scope — deliberate boundaries

- **The 4-stem spatial graph and re-conduct-from-gesture.** Slice 4 plays the
  single master, plain. The stems were the Orchestra's *conducting instrument*;
  replaying them without conducting is pointless, and design doc §13 explicitly
  defers re-running the gesture through the engine.
- **A separate route / "room" screen.** The page is the room (the brainstorm's
  "living page" decision).
- **A scrubber or transport chrome.** Design doc §5 says "no chrome." Play/pause
  is the only control; the drawn-in ink *is* the progress indicator.
- **The page layout.** Slice 1–3's `EntryPage` layout (wash, roman numeral,
  date, rule, glyph, summary, ornament) stands — date and summary already read
  as §5 wants. Slice 4 changes behaviour, not layout.
- **The collective / sky** — Slices 5–6.

### Mock + dev-seeded entries

Mock entries and dev-seeded rows have `song: null` and `glyph: null`. They stay
exactly as today — a static procedural mark, silent, **no play affordance**.
The room only comes alive for real recorded entries (those carrying both a
`song` and a `glyph`).

---

## 3. The audio — `useEntryAudio`

A new hook, `src/journal/useEntryAudio.js`.

**Input.** `useEntryAudio(song)` — `song` is the entry's `"archetypeId/variationId"`
string (Slice 3's format). The hook splits it on `/` and resolves the master
URL via `stemsCatalog.getMasterUrl(archetypeId, variationId)` →
`{VITE_MASTERS_BASE_URL}/{archetypeId}_{variationId}.mp3`.

**The element.** It owns a plain `HTMLAudioElement` (`new Audio(url)`). **No
WebAudio graph** — the glyph is driven by playback *position*, not frequency,
so no `AudioContext` / `AnalyserNode` is created. `crossOrigin` is unnecessary
for plain `<audio>` playback and is omitted.

**Returned shape.** `{ available, playing, toggle, progressRef }`:

- `available` — `false` when `song` is null/malformed, or the element fires an
  `error` event (the file 404s or the network fails). When `false`, `EntryPage`
  shows the static mark with no play affordance.
- `playing` — boolean React state; flips on play/pause/end. Drives the glyph's
  idle-vs-animated mode and the affordance hint.
- `toggle()` — if paused, `audio.play()`; if playing, `audio.pause()`. Always
  called from the user's tap, so browser autoplay policy is satisfied by that
  gesture. On the first `toggle()` after the song has ended, playback restarts
  from 0.
- `progressRef` — a `useRef` holding `currentTime / duration` (0–1). A rAF loop,
  running only while `playing`, refreshes it each frame. It is a **ref, not
  state**, so the glyph can read smooth per-frame progress without re-rendering
  `EntryPage` 60 fps. `0` until `duration` is known (`loadedmetadata`).

**Lifecycle.** The hook keys on `song`. On `song` change or unmount it pauses
the element, clears its `src`, and cancels the rAF loop. Because `EntryPage`
unmounts whenever the journal navigates (every page-turn flips `pageVisible`
off then on), turning the page stops playback for free; the hook's own cleanup
is the belt-and-braces guarantee.

---

## 4. The glyph re-animation

### 4.1 `revealGlyph` — the pure path-slice

Added to `src/lib/glyph.js` (the existing pure glyph-system module):

```
revealGlyph(glyph, progress) → [[x, y], ...]
```

Given a glyph `{v, pts:[[x,y,t],...], dur}` and a `progress` in 0–1, it returns
the list of `[x, y]` points that should be drawn at that progress:

- the target time is `progressMs = progress × glyph.dur`;
- all points whose `t ≤ progressMs` are included whole;
- the segment straddling `progressMs` gets a final **interpolated** point — the
  fractional position between `pts[i]` and `pts[i+1]` — so the ink advances
  smoothly rather than snapping point-to-point;
- `progress ≤ 0` → the first point only (or empty for an empty glyph);
  `progress ≥ 1` → the full path.

Pure and deterministic — unit-tested. It does not know about the canvas, the
`hand`, or the audio.

### 4.2 The `Glyph` canvas

The `Glyph` component (extracted to `src/journal/Glyph.jsx` — see §6) gains a
playing mode. Its props become `{ glyph, seed, hand, playing, progressRef }`.

- **Idle** (`playing` false) — draws the complete mark once, exactly as Slice 3
  does: `strokeFeathered(fitGlyphPoints(glyph.pts, …), hand)` for a real glyph,
  or the procedural squiggle fallback when there is no glyph.
- **Playing** (`playing` true) — runs its own rAF draw loop. Each frame it
  reads `progressRef.current`, calls `revealGlyph(glyph, progress)`, maps the
  revealed normalised points through `fitGlyphPoints`, and `strokeFeathered`s
  them. The ink grows with the song; a pause freezes it (the loop keeps running
  but `progress` stops advancing); song-end leaves it complete.
- The rAF loop is the `Glyph`'s own — `EntryPage` is not re-rendered per frame.
- The procedural-fallback glyph (mock entries) has no `pts`/timing and is never
  animated; with no `song` it never enters the playing mode anyway.

**Taper-anchor fix.** `strokeFeathered`'s per-segment width envelope currently
uses `i / (n - 1)` over the array it is handed. For a partially-revealed path
that array is shorter, so the "fat middle" would drift as the ink grows.
`strokeFeathered` is adjusted to take the **full** path length as the taper
reference (e.g. an explicit `totalCount` argument), so a half-drawn glyph
carries the same stroke-weight profile it will have when complete.

---

## 5. The affordance — tap the glyph

Design doc §5: audio is "central, not a buried control," and "no chrome." So
the play/pause trigger is **the glyph mark itself**, not a separate button:

- The glyph region is the click/tap target. Tapping it replays the session —
  music starts and the ink redraws; tapping again pauses both.
- **Idle** carries a faint, low-chrome hint that the mark is alive — a quiet ▶
  glance and/or a `cursor: pointer`. The hint disappears while playing.
- When `useEntryAudio` reports `available: false` (mock entry, or a master that
  failed to load), there is no tap target and no hint — the mark is static.
- Navigation (the journal's existing earlier/later turn, the chapter rail)
  needs no change: turning the page unmounts `EntryPage`, which stops playback.
  §5's "prev/next to drift to neighbouring sessions" is the journal's existing
  page-turn — Slice 4 adds nothing there.

---

## 6. File-level change map

### Create

- `src/journal/useEntryAudio.js` — the audio hook (§3).
- `src/journal/Glyph.jsx` — the glyph canvas, **extracted from `EntryPage.jsx`**.
  The glyph code (`fitGlyphPoints`, `strokeFeathered`, the `Glyph` component) is
  already ~145 of `EntryPage.jsx`'s ~330 lines, and Slice 4 grows it with the
  animated draw loop. Extracting it keeps both files focused — a targeted
  improvement of code this slice is directly modifying, not unrelated
  refactoring. The component gains the `playing` / `progressRef` mode (§4.2).

### Modify

- `src/lib/glyph.js` — add the pure `revealGlyph(glyph, progress)` (§4.1);
  anchor `strokeFeathered`'s taper envelope to the full path length (§4.2).
- `src/lib/__tests__/glyph.test.js` — add `revealGlyph` cases.
- `src/journal/EntryPage.jsx` — import `Glyph` from the new file; call
  `useEntryAudio(entry.song)`; make the glyph region the play/pause toggle and
  carry the idle hint; pass `playing` / `progressRef` to `Glyph`. The
  `fitGlyphPoints` / `strokeFeathered` / `Glyph` definitions move out to
  `Glyph.jsx`; `mulberry32` / `washBackground` / `Rule` / the `EntryPage` body
  stay.

### Unchanged (explicitly)

- `src/journal/Journal.jsx` — no change; its page-turn navigation already
  serves §5's prev/next, and `EntryPage` unmount-on-navigate already stops
  playback.
- The `EntryPage` page layout — wash, roman numeral, date, rule, summary,
  ornament all stand.

---

## 7. Testing

### Unit (vitest, `src/lib/__tests__/glyph.test.js`)

- **`revealGlyph`** — `progress ≤ 0` returns the first point only (and an empty
  glyph returns `[]` without throwing); `progress ≥ 1` returns all points;
  a mid `progress` returns the correct whole-point prefix plus one interpolated
  tail point that lies on the straddling segment; the revealed points are a
  prefix of the full path (monotonic — never reorders); a 1- or 2-point glyph
  is handled without throwing.

`useEntryAudio` and `EntryPage` are IO/UI and are not unit-tested (no audio
element or R2 in jsdom) — they are covered by manual verification.

### Manual end-to-end

Hand-insert an `entries` row with a real `song` (an `archetypeId/variationId`
whose master exists on R2) and a real `glyph` jsonb, then open the journal to
it:

1. The page shows the static mark with the faint "alive" hint.
2. Tap the mark → the master plays and the ink begins drawing in sync.
3. Mid-song the ink is partially drawn, advancing with playback.
4. Tap again → audio pauses, the ink freezes.
5. Let it run to the end → the song stops, the ink is complete.
6. Turn the page (earlier/later) mid-playback → playback stops.
7. Open a mock/dev-seeded entry (no `song`) → static mark, no hint, no audio.

---

## 8. Risks

- The entry's `song` must resolve to a master that actually exists on R2. The
  24 masters are uploaded (CLAUDE.md), so a real entry resolves to a real file;
  a missing or failed file degrades cleanly to `available: false` (static mark,
  no play affordance) rather than erroring.
- The glyph's recorded `dur` and the master's duration are close but not
  identical, and the glyph's `t=0` is not exactly the song's `t=0` (capture
  began after the Orchestra briefing). Syncing the glyph to the audio timeline
  (the brainstorm decision) absorbs this — the glyph's pacing is normalised
  onto the song length, so the two always finish together. Exact gesture-timing
  fidelity is explicitly deferred (design doc §13).
