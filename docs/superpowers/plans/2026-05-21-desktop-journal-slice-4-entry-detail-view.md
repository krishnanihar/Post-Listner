# Desktop Journal — Slice 4: The Entry Detail View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opening a journal entry replays its song from R2 and re-animates the recorded glyph in sync — the entry page becomes the living "room" the design doc §5 describes.

**Architecture:** A new `useEntryAudio` hook streams the entry's master MP3 and exposes playback progress through a ref. The glyph canvas — extracted from `EntryPage.jsx` into its own file — gains an animated mode that redraws the recorded path up to that progress each frame. The glyph mark itself is the play/pause control. The pure path-slicing (`revealGlyph`) lives in the existing `src/lib/glyph.js`.

**Tech Stack:** React 19 + Vite 7, `HTMLAudioElement` (plain — no WebAudio graph), Canvas 2D, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-05-21-desktop-journal-slice-4-entry-detail-view-design.md`

---

## Lint baseline

The project has ~133 pre-existing ESLint errors unrelated to this slice (strict `eslint-plugin-react-hooks` rules across the codebase). The acceptance criterion for every task is **"introduce no *new* ESLint error"** — compare a touched file against its pre-task state — not "`npm run lint` is clean." `npm run build` and `npm test` must pass cleanly.

## File Structure

**Create:**
- `src/lib/__tests__/glyph.test.js` — already exists; gains a `revealGlyph` `describe` block.
- `src/journal/useEntryAudio.js` — the audio hook: resolves the master URL, owns an `HTMLAudioElement`, exposes `{ available, playing, toggle, progressRef }`.
- `src/journal/Glyph.jsx` — the glyph canvas, extracted from `EntryPage.jsx`. Holds `mulberry32`, the canvas + fit + stroke helpers, and the `Glyph` component with its new animated mode.

**Modify:**
- `src/lib/glyph.js` — add the pure `revealGlyph(glyph, progress)`.
- `src/journal/EntryPage.jsx` — drop the glyph code (moved to `Glyph.jsx`); import `Glyph`; wire `useEntryAudio`; make the glyph the play/pause toggle.
- `CLAUDE.md`, `docs/desktop-journal-design.md` — mark Slice 4 built.

**Unchanged (explicitly):** `src/journal/Journal.jsx` (its page-turn navigation already serves §5's prev/next, and `EntryPage` unmount-on-navigate already stops playback), the `EntryPage` page layout.

---

## Task 1: `revealGlyph` — the pure path-slice

**Files:**
- Modify: `src/lib/glyph.js`
- Test: `src/lib/__tests__/glyph.test.js`

- [ ] **Step 1: Write the failing test**

In `src/lib/__tests__/glyph.test.js`, add `revealGlyph` to the import on line 2:

```js
import { GLYPH_VERSION, simplifyPath, distillGlyph, deriveHand, revealGlyph } from '../glyph.js'
```

Then append this `describe` block to the end of the file:

```js
describe('revealGlyph', () => {
  const glyph = { v: 1, pts: [[0, 0, 0], [0.2, 0.4, 100], [0.6, 0.5, 200], [1, 1, 400]], dur: 400 }

  it('returns an empty array for an empty glyph', () => {
    expect(revealGlyph({ v: 1, pts: [], dur: 0 }, 0.5)).toEqual([])
  })

  it('returns the single point for a one-point glyph', () => {
    expect(revealGlyph({ v: 1, pts: [[0.3, 0.7, 0]], dur: 0 }, 0.5)).toEqual([[0.3, 0.7]])
  })

  it('returns the first point only at progress 0', () => {
    expect(revealGlyph(glyph, 0)).toEqual([[0, 0]])
  })

  it('returns every point (as [x,y]) at progress 1', () => {
    expect(revealGlyph(glyph, 1)).toEqual([[0, 0], [0.2, 0.4], [0.6, 0.5], [1, 1]])
  })

  it('returns the whole-point prefix when nothing straddles the target time', () => {
    // progress 0.5 -> targetT 200 -> points at t=0,100,200 are whole; the
    // segment to t=400 straddles but the interpolation fraction is 0, so it
    // is not added (no duplicate point).
    expect(revealGlyph(glyph, 0.5)).toEqual([[0, 0], [0.2, 0.4], [0.6, 0.5]])
  })

  it('interpolates the segment straddling the target time', () => {
    // progress 0.75 -> targetT 300, between t=200 and t=400, fraction 0.5 ->
    // interpolated point is the midpoint of [0.6,0.5] and [1,1] = [0.8,0.75]
    expect(revealGlyph(glyph, 0.75)).toEqual([[0, 0], [0.2, 0.4], [0.6, 0.5], [0.8, 0.75]])
  })

  it('always returns a whole-point prefix of the full path', () => {
    for (const p of [0.1, 0.3, 0.6, 0.9]) {
      const out = revealGlyph(glyph, p)
      expect(out.length).toBeLessThanOrEqual(glyph.pts.length)
      // every point except possibly the last interpolated tail matches the path
      for (let i = 0; i < out.length - 1; i++) {
        expect(out[i]).toEqual([glyph.pts[i][0], glyph.pts[i][1]])
      }
    }
  })

  it('clamps progress below 0 and above 1', () => {
    expect(revealGlyph(glyph, -0.5)).toEqual([[0, 0]])
    expect(revealGlyph(glyph, 2)).toEqual([[0, 0], [0.2, 0.4], [0.6, 0.5], [1, 1]])
  })

  it('handles a missing or malformed glyph without throwing', () => {
    expect(() => revealGlyph(null, 0.5)).not.toThrow()
    expect(revealGlyph(null, 0.5)).toEqual([])
    expect(revealGlyph({ v: 1 }, 0.5)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/glyph.test.js`
Expected: FAIL — `revealGlyph` is not exported.

- [ ] **Step 3: Implement `revealGlyph`**

In `src/lib/glyph.js`, append this function to the end of the file:

```js
/**
 * revealGlyph — the points of a glyph that should be drawn at a given
 * playback progress (0..1). Used to re-animate the recorded path in sync
 * with the entry's song (spec §4.1). The per-point `t` sets the order and
 * relative pacing; `progress` is normalised onto the glyph's own `dur`.
 *
 * Returns [[x, y], ...] — every point whose t <= progress*dur, plus one
 * interpolated point on the segment straddling that time so the ink advances
 * smoothly. progress <= 0 -> the first point only; >= 1 -> the whole path.
 * A missing/short/malformed glyph is handled without throwing.
 */
export function revealGlyph(glyph, progress) {
  const pts = glyph && Array.isArray(glyph.pts) ? glyph.pts : []
  if (pts.length === 0) return []
  const xy = (p) => [p[0], p[1]]
  if (pts.length === 1) return [xy(pts[0])]
  if (progress <= 0) return [xy(pts[0])]
  if (progress >= 1) return pts.map(xy)

  const dur = glyph.dur > 0 ? glyph.dur : pts[pts.length - 1][2] || 1
  const targetT = progress * dur

  const out = [xy(pts[0])]
  for (let i = 1; i < pts.length; i++) {
    const t = pts[i][2]
    if (t <= targetT) {
      out.push(xy(pts[i]))
    } else {
      // interpolate the straddling segment; skip when the fraction is 0 so
      // the result never duplicates the previous whole point
      const prev = pts[i - 1]
      const span = t - prev[2]
      const f = span > 0 ? (targetT - prev[2]) / span : 0
      if (f > 0) {
        out.push([
          prev[0] + (pts[i][0] - prev[0]) * f,
          prev[1] + (pts[i][1] - prev[1]) * f,
        ])
      }
      break
    }
  }
  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/glyph.test.js`
Expected: PASS — all `describe` blocks green (the existing `simplifyPath`/`distillGlyph`/`deriveHand` blocks plus the new `revealGlyph` block).

- [ ] **Step 5: Commit**

```bash
git add src/lib/glyph.js src/lib/__tests__/glyph.test.js
git commit -m "feat(journal): add revealGlyph — progress-sliced glyph path"
```

---

## Task 2: `useEntryAudio` — the audio hook

**Files:**
- Create: `src/journal/useEntryAudio.js`

No unit test — the hook owns an `HTMLAudioElement` and a rAF loop, neither reliable in jsdom. Verification is lint + build; behaviour is covered by the manual end-to-end (Task 5).

- [ ] **Step 1: Write the hook**

Create `src/journal/useEntryAudio.js`:

```js
import { useCallback, useEffect, useRef, useState } from 'react'
import { getMasterUrl } from '../lib/stemsCatalog.js'

/**
 * useEntryAudio — streams and controls one entry's master MP3 for the
 * journal detail view (spec §3).
 *
 * `song` is the entry's "archetypeId/variationId" string. The hook resolves
 * the master URL, owns a plain HTMLAudioElement (no WebAudio graph — the
 * glyph is driven by playback position, not frequency), and exposes:
 *   available    — false when there is no song or the file fails to load
 *   playing      — boolean; drives the glyph's idle-vs-animated mode
 *   toggle()     — play if paused, pause if playing (call from a user tap)
 *   progressRef  — ref holding currentTime/duration (0..1), refreshed by a
 *                  rAF loop while playing, so the glyph reads smooth progress
 *                  without re-rendering the page
 */
export function useEntryAudio(song) {
  const [available, setAvailable] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const progressRef = useRef(0)

  // build / tear down the audio element when the song changes
  useEffect(() => {
    progressRef.current = 0
    setPlaying(false)
    setAvailable(false)

    if (!song || typeof song !== 'string' || !song.includes('/')) {
      audioRef.current = null
      return undefined
    }
    const [archetypeId, variationId] = song.split('/')
    const audio = new Audio(getMasterUrl(archetypeId, variationId))
    audio.preload = 'auto'
    audioRef.current = audio

    const onReady = () => setAvailable(true)
    const onError = () => setAvailable(false)
    const onEnded = () => {
      // pin progress to 1 so the idle repaint shows the complete mark, not
      // the ~99%-drawn path the rAF loop last sampled before the track ended
      progressRef.current = 1
      setPlaying(false)
    }
    audio.addEventListener('loadedmetadata', onReady)
    audio.addEventListener('error', onError)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', onReady)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('ended', onEnded)
      audio.src = ''
      audioRef.current = null
    }
  }, [song])

  // progress loop — runs only while playing, writes a ref (no re-render)
  useEffect(() => {
    if (!playing) return undefined
    let raf = 0
    const tick = () => {
      const audio = audioRef.current
      if (audio && audio.duration > 0) {
        progressRef.current = audio.currentTime / audio.duration
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      // a finished track restarts from the top
      if (audio.ended || (audio.duration > 0 && audio.currentTime >= audio.duration)) {
        audio.currentTime = 0
        progressRef.current = 0
      }
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      audio.pause()
      setPlaying(false)
    }
  }, [])

  return { available, playing, toggle, progressRef }
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npx eslint src/journal/useEntryAudio.js && npm run build`
Expected: no lint errors on the new file; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/journal/useEntryAudio.js
git commit -m "feat(journal): add useEntryAudio — master MP3 playback + progress"
```

---

## Task 3: Extract the glyph canvas into `Glyph.jsx` with an animated mode

**Files:**
- Create: `src/journal/Glyph.jsx`
- Modify: `src/journal/EntryPage.jsx`

This task moves the glyph rendering out of `EntryPage.jsx` into its own file and gives it the animated mode. After it, `EntryPage` renders the **static** glyph exactly as before (it passes `playing={false}`); Task 4 wires the audio that brings it to life.

- [ ] **Step 1: Create `Glyph.jsx`**

Create `src/journal/Glyph.jsx`:

```jsx
import { useEffect, useRef } from 'react'
import { revealGlyph } from '../lib/glyph.js'

/**
 * Glyph — the entry's hand-painted ink mark, for the journal detail view.
 *
 * Extracted from EntryPage. Two modes:
 *  - idle / paused / ended (playing=false): paints once. The complete mark
 *    when progress is 0 or >=1; the frozen partial when paused mid-song.
 *  - playing (playing=true): a rAF loop redraws the path up to progressRef's
 *    value each frame, so the ink advances in sync with the song.
 * Entries with no recorded glyph fall back to a procedural squiggle seeded
 * off the entry's chronological position; the fallback never animates.
 */

const W = 300
const H = 190
const PAD = 30

/** A small deterministic PRNG, seeded — shared with EntryPage's washBackground. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Size the canvas for the device pixel ratio, clear it, return a 2D ctx. */
function prepCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const ctx = canvas.getContext('2d')
  if (canvas.width !== W * dpr) canvas.width = W * dpr
  if (canvas.height !== H * dpr) canvas.height = H * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  return ctx
}

/**
 * The transform that fits a glyph's normalised 0..1 points into the padded
 * canvas box. Computed from the FULL path so a partially-revealed path is
 * drawn in its final position and grows in place rather than re-fitting.
 */
function glyphFitTransform(pts, pad) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const p of pts) {
    if (p[0] < minX) minX = p[0]
    if (p[0] > maxX) maxX = p[0]
    if (p[1] < minY) minY = p[1]
    if (p[1] > maxY) maxY = p[1]
  }
  const spanX = Math.max(maxX - minX, 0.001)
  const spanY = Math.max(maxY - minY, 0.001)
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY)
  return { scale, minX, minY, ox: (W - spanX * scale) / 2, oy: (H - spanY * scale) / 2 }
}

/** Map normalised points through a glyphFitTransform into canvas coordinates. */
function applyFit(pts, tf) {
  return pts.map((p) => [tf.ox + (p[0] - tf.minX) * tf.scale, tf.oy + (p[1] - tf.minY) * tf.scale])
}

/**
 * Lay a polyline down in three feathered passes (a wide pale bleed, a mid
 * body, a sharp core) so the edges feather like wet ink. Per-segment width
 * follows a taper envelope — thin at the ends, full in the middle — anchored
 * to `totalCount` (the FULL path length) so a partially-drawn glyph carries
 * the same stroke-weight profile it will have when complete.
 */
function strokeFeathered(ctx, xy, hand, totalCount) {
  const n = xy.length
  if (n < 2) return
  const total = totalCount || n
  const widthAt = (i) => {
    const u = total > 1 ? i / (total - 1) : 0.5
    const bell = Math.pow(Math.sin(Math.PI * u), hand.taper) // 0 at ends -> 1 mid
    return hand.minWidth + (hand.maxWidth - hand.minWidth) * bell
  }
  const passes = [
    { blur: 4, mul: 2.6, alpha: 0.10, light: hand.inkLight + 24 }, // wet bleed
    { blur: 0, mul: 1.5, alpha: 0.24, light: hand.inkLight + 10 }, // body
    { blur: 0, mul: 1.0, alpha: 0.62, light: hand.inkLight },      // core
  ]
  for (const p of passes) {
    ctx.filter = p.blur ? `blur(${p.blur}px)` : 'none'
    ctx.strokeStyle = `hsla(${hand.inkHue}, ${hand.inkSat}%, ${p.light}%, ${p.alpha})`
    for (let i = 1; i < n; i++) {
      ctx.beginPath()
      ctx.lineWidth = widthAt(i) * p.mul
      ctx.moveTo(xy[i - 1][0], xy[i - 1][1])
      ctx.lineTo(xy[i][0], xy[i][1])
      ctx.stroke()
    }
  }
  ctx.filter = 'none'
}

/** The procedural squiggle — the fallback mark for entries with no glyph. */
function drawProcedural(ctx, seed) {
  const rand = mulberry32((seed + 1) * 2654435761)
  ctx.translate(W / 2, H / 2)

  // soft pigment blooms behind the mark
  ctx.filter = 'blur(20px)'
  for (let i = 0; i < 3; i++) {
    const warm = rand() < 0.78
    ctx.fillStyle = warm
      ? `rgba(158, 104, 48, ${(0.11 + rand() * 0.08).toFixed(2)})`
      : `rgba(140, 96, 96, ${(0.07 + rand() * 0.05).toFixed(2)})`
    ctx.beginPath()
    ctx.arc((rand() - 0.5) * 120, (rand() - 0.5) * 70, 38 + rand() * 36, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.filter = 'none'

  // build the squiggle path once, then render it in feathered passes
  const pts = []
  let x = (rand() - 0.5) * 40
  let y = (rand() - 0.5) * 26
  const steps = 5 + Math.floor(rand() * 4)
  pts.push({ x, y })
  for (let i = 0; i < steps; i++) {
    const nx = (rand() - 0.5) * 190
    const ny = (rand() - 0.5) * 118
    const mx = (x + nx) / 2 + (rand() - 0.5) * 110
    const my = (y + ny) / 2 + (rand() - 0.5) * 110
    const w = 1.7 + rand() * 5.4
    pts.push({ x: nx, y: ny, mx, my, w })
    x = nx
    y = ny
  }

  const passes = [
    { blur: 4, mul: 2.7, alpha: 0.1, col: '74, 52, 28' }, // wet bleed
    { blur: 0, mul: 1.5, alpha: 0.24, col: '52, 38, 22' }, // body
    { blur: 0, mul: 1.0, alpha: 0.6, col: '32, 24, 16' }, // core
  ]
  for (const p of passes) {
    ctx.filter = p.blur ? `blur(${p.blur}px)` : 'none'
    ctx.strokeStyle = `rgba(${p.col}, ${p.alpha})`
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      ctx.beginPath()
      ctx.lineWidth = b.w * p.mul
      ctx.moveTo(a.x, a.y)
      ctx.quadraticCurveTo(b.mx, b.my, b.x, b.y)
      ctx.stroke()
    }
  }
  ctx.filter = 'none'

  // a few ink spatter flecks
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(40, 30, 18, ${(0.12 + rand() * 0.3).toFixed(2)})`
    ctx.beginPath()
    ctx.arc((rand() - 0.5) * 230, (rand() - 0.5) * 150, 0.6 + rand() * 2.1, 0, Math.PI * 2)
    ctx.fill()
  }
}

export default function Glyph({ glyph, seed, hand, playing, progressRef }) {
  const ref = useRef(null)
  const real = !!(glyph && Array.isArray(glyph.pts) && glyph.pts.length >= 2)

  // static paint — the complete mark (idle / ended), the frozen partial
  // (paused mid-song), or the procedural fallback. Skipped while playing —
  // the animation effect owns the canvas then.
  useEffect(() => {
    if (playing && real) return
    const ctx = prepCanvas(ref.current)
    if (!real) {
      drawProcedural(ctx, seed)
      return
    }
    const p = progressRef ? progressRef.current : 1
    const tf = glyphFitTransform(glyph.pts, PAD)
    const pts = p > 0 && p < 1 ? revealGlyph(glyph, p) : glyph.pts
    if (pts.length >= 2) strokeFeathered(ctx, applyFit(pts, tf), hand, glyph.pts.length)
  }, [glyph, seed, hand, playing, real, progressRef])

  // animated paint — redraw the path up to progress every frame while playing
  useEffect(() => {
    if (!playing || !real) return undefined
    const tf = glyphFitTransform(glyph.pts, PAD)
    let raf = 0
    const draw = () => {
      const ctx = prepCanvas(ref.current)
      const pts = revealGlyph(glyph, progressRef.current)
      if (pts.length >= 2) strokeFeathered(ctx, applyFit(pts, tf), hand, glyph.pts.length)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [playing, real, glyph, hand, progressRef])

  return <canvas ref={ref} style={{ width: W, height: H }} />
}
```

- [ ] **Step 2: Rewire `EntryPage.jsx` to import from `Glyph.jsx`**

In `src/journal/EntryPage.jsx`:

1. Change the React import line `import { useEffect, useMemo, useRef } from 'react'` to:

```js
import { useMemo } from 'react'
```

2. Immediately after the `deriveHand` import, add:

```js
import Glyph, { mulberry32 } from './Glyph.jsx'
```

3. Delete the local `mulberry32` function definition (it now comes from the import).

4. Delete the local `fitGlyphPoints` function, the local `strokeFeathered` function, and the entire local `Glyph` component (its `/** ... */` doc-comment through its closing `}` and `return <canvas ... />`). These all now live in `Glyph.jsx`.

Keep: the `PAPER`/`INK` consts, `ROMAN`/`roman`, `washBackground` (it uses the imported `mulberry32`), `Rule`, and the `EntryPage` component.

5. In the `EntryPage` component's JSX, the `<Glyph .../>` usage currently reads `<Glyph glyph={entry.glyph} seed={entry.seq} hand={hand} />`. Change it to pass the new (still-static) props:

```jsx
        <Glyph glyph={entry.glyph} seed={entry.seq} hand={hand} playing={false} />
```

(With `playing={false}` and no `progressRef`, `Glyph` paints the complete static mark — identical to the pre-task behaviour. Task 4 supplies the real `playing`/`progressRef`.)

- [ ] **Step 3: Verify lint, build, and tests**

Run: `npx eslint src/journal/Glyph.jsx src/journal/EntryPage.jsx && npm run build && npm test`
Expected: no new lint errors; build succeeds; all tests pass (the suite is unchanged by this task — it is a pure refactor plus the unused animated mode).

- [ ] **Step 4: Verify the static render is unchanged in the browser**

Run `npm run dev`, open the desktop root, page to an entry.
Expected: the entry's glyph renders exactly as before this task — a real recorded glyph as the feathered ink path, a mock entry as the procedural squiggle. Nothing animates yet.

- [ ] **Step 5: Commit**

```bash
git add src/journal/Glyph.jsx src/journal/EntryPage.jsx
git commit -m "refactor(journal): extract Glyph to its own file; add animated mode"
```

---

## Task 4: Wire the audio into `EntryPage` — the glyph as play/pause

**Files:**
- Modify: `src/journal/EntryPage.jsx`

- [ ] **Step 1: Import the audio hook**

In `src/journal/EntryPage.jsx`, after the `import Glyph, { mulberry32 } from './Glyph.jsx'` line, add:

```js
import { useEntryAudio } from './useEntryAudio.js'
```

- [ ] **Step 2: Call the hook**

In the `EntryPage` component body, immediately after the existing `const wash = useMemo(...)` line, add:

```js
  const { available, playing, toggle, progressRef } = useEntryAudio(entry ? entry.song : null)
```

(`entry` may be null — the existing `if (!entry) return null` guard sits just below; calling the hook with `null` before it is correct and keeps hook order unconditional.)

- [ ] **Step 3: Make the glyph the play/pause control**

In `EntryPage`'s JSX, the glyph currently renders as a bare `<Glyph .../>` between the `<Rule />` and the summary `<div>`. Replace that single `<Glyph .../>` line with this wrapped, tappable version:

```jsx
        <div
          onClick={available ? toggle : undefined}
          style={{
            position: 'relative',
            display: 'inline-block',
            cursor: available ? 'pointer' : 'default',
          }}
        >
          <Glyph
            glyph={entry.glyph}
            seed={entry.seq}
            hand={hand}
            playing={playing}
            progressRef={progressRef}
          />
          {available && !playing && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  font: '300 22px Palatino, Georgia, serif',
                  color: 'rgba(28,24,20,0.28)',
                  letterSpacing: '0.1em',
                }}
              >
                ▶
              </span>
            </div>
          )}
        </div>
```

This makes the glyph mark itself the play/pause toggle (only when `available`), with a faint ▶ shown while idle/paused. A mock entry (`available` false) has no tap target and no hint — the static mark, exactly as today.

- [ ] **Step 4: Verify lint + build**

Run: `npx eslint src/journal/EntryPage.jsx && npm run build`
Expected: no new lint errors; build succeeds.

- [ ] **Step 5: Verify end-to-end in the browser (requires a real entry)**

This needs a signed-in journal with an entry whose `song` resolves to a master that exists on R2 (and a `glyph`). If none exists, hand-insert one via the Supabase SQL editor (an `archetypeId/variationId` from `src/lib/archetypes.js`, e.g. `hearth-keeper/acoustic-soft-2000s`, plus a `glyph` jsonb). Then run `npm run dev`, open the journal to that entry, and verify:

1. The static mark shows with a faint ▶ centred on it.
2. Tap the glyph → the master plays and the ink begins drawing in sync.
3. Tap again → audio pauses, the ink freezes at its current progress, the ▶ returns.
4. Tap again → audio resumes from where it paused, the ink continues.
5. Let it run to the end → audio stops, the ink is complete, the ▶ returns.
6. Turn the page (earlier/later) mid-playback → playback stops.
7. Open a mock/dev-seeded entry (no `song`) → the static procedural mark, no ▶, no audio on click.

- [ ] **Step 6: Commit**

```bash
git add src/journal/EntryPage.jsx
git commit -m "feat(journal): the entry's glyph replays its song + re-animates"
```

---

## Task 5: Docs — mark Slice 4 built

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/desktop-journal-design.md`

- [ ] **Step 1: Update the Desktop journal section in CLAUDE.md**

In `CLAUDE.md`, find the `### Desktop journal` section. Two changes:

(a) The slice-status sentence currently reads "Slices 1–3 are built; Slice 4 is next." (or "Slices 1–3 built"). Change it to "Slices 1–4 are built; Slice 5 is next."

(b) Replace the final sentence/paragraph describing Slice 4 as next — the phrase of the form `**Slice 4 (next) — the entry detail view:** music replay from R2 + glyph re-animation …` — with:

```markdown
**Slice 4 — the entry detail view (built).** Opening a journal entry makes its
page a living "room": `useEntryAudio` (`src/journal/useEntryAudio.js`) streams
the entry's master MP3 from R2, and the glyph re-animates — `revealGlyph`
(`src/lib/glyph.js`) slices the recorded path to the song's playback position,
which the extracted `Glyph` component (`src/journal/Glyph.jsx`) redraws each
frame. The glyph mark itself is the play/pause control. Mock entries (no
`song`/`glyph`) stay a static procedural mark. **Slice 5 (next) — the sky:**
the Mapbox collective globe + the "rise to the field" transition.
```

- [ ] **Step 2: Mark Slice 4 built in the design doc**

In `docs/desktop-journal-design.md`, in **§12 (Build sequence)**, find the line `4. **The entry detail view.** …` and change its bold lead-in so it begins with `4. **The entry detail view. (Built 2026-05-21.)** ` (insert ` (Built 2026-05-21.)` inside or right after the bold span).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/desktop-journal-design.md
git commit -m "docs: mark desktop journal Slice 4 (entry detail view) built"
```

---

## Self-Review

**Spec coverage** (`2026-05-21-desktop-journal-slice-4-entry-detail-view-design.md`):

- §3 `useEntryAudio` (resolve master URL, plain `HTMLAudioElement`, `{available, playing, toggle, progressRef}`, rAF progress, `song`-keyed lifecycle) — Task 2. ✓
- §4.1 `revealGlyph` (pure progress-slice, interpolated tail, clamps, malformed-safe) — Task 1. ✓
- §4.2 The animated `Glyph` (idle vs playing, its own rAF loop, `revealGlyph` + fit, the taper anchored to the full path length) — Task 3. ✓
- §5 The tap affordance (the glyph mark is the play/pause toggle, faint ▶ idle hint, no affordance when unavailable) — Task 4. ✓
- §6 File map (`useEntryAudio.js` + `Glyph.jsx` created; `glyph.js`, `EntryPage.jsx` modified; `Journal.jsx` + layout unchanged) — Tasks 1–4. ✓
- §7 Testing (`revealGlyph` unit tests; manual E2E) — Task 1 + Task 4 Step 5. ✓
- §2 Mock-entry degradation (no `song` → `available` false → static mark, no affordance) — Task 2 (`song` guard) + Task 4 Step 3 (`available` gating). ✓

**Out of scope, correctly absent:** the 4-stem spatial graph, re-conduct-from-gesture, a separate route, a scrubber, layout changes — none have tasks.

**Placeholder scan:** every code step carries complete code; no `TBD`/`TODO`/"handle edge cases"/"similar to Task N".

**Type consistency:** `revealGlyph(glyph, progress)` returns `[[x,y],…]` (Task 1) — consumed by `Glyph`'s two effects via `applyFit` (Task 3), which reads `p[0]`/`p[1]` (works for the 2-tuples `revealGlyph` returns and the 3-tuple `glyph.pts`). `useEntryAudio` returns `{available, playing, toggle, progressRef}` (Task 2) — destructured with matching names in `EntryPage` (Task 4) and `playing`/`progressRef` passed to `Glyph`, whose props are `{glyph, seed, hand, playing, progressRef}` (Task 3). `Glyph.jsx` exports `Glyph` (default) + `mulberry32` (named) — `EntryPage` imports both (Task 3 Step 2). `strokeFeathered(ctx, xy, hand, totalCount)` — both call sites in `Glyph` pass `glyph.pts.length` as `totalCount` (Task 3). `getMasterUrl(archetypeId, variationId)` — call site in `useEntryAudio` matches the existing `stemsCatalog` export.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-21-desktop-journal-slice-4-entry-detail-view.md`.**
