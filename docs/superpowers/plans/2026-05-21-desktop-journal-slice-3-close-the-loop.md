# Desktop Journal — Slice 3: Close the Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A QR-paired rite writes a real Supabase journal entry at settle — the phone distills the conducting gesture into a recorded-path glyph and relays one `entry` message; the desktop becomes the root, mirrors the rite, writes the row, and lands on the new page.

**Architecture:** The phone accumulates `[roll, pitch, t]` during Orchestra, distills it (Ramer–Douglas–Peucker) at song end, and `App.jsx` relays `{type:'entry', song, summary, glyph}` at settle. `Desktop` becomes the desktop root: a new `useRiteSession` hook holds a relay-viewer connection, runs a `riteStage` state machine, writes the row via `entriesRepo.createEntry`, and reopens the `Journal` turned to the new entry. The journal's fake `seq`-seeded glyph is replaced by a renderer of the real recorded path, styled in a per-account "hand."

**Tech Stack:** React 19 + Vite 7, `@supabase/supabase-js` v2, Cloudflare Workers relay (WebSocket), `qrcode.react`, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-05-21-desktop-journal-slice-3-close-the-loop-design.md`

**Revised 2026-05-21** after an independent Codex review — hardened against: a stuck settle-loading state on write failure, duplicate entry writes, an RDP hard-cap dropping the path's last point, a too-weak `entry` guard, and the no-Supabase dev fallback opening no relay viewer. `riteStage` gained a `'settling'` value (the entry-write-in-flight window).

---

## No schema migration

The `entries` table (`id, user_id, created_at, song, summary, glyph jsonb, region`) and its `"insert own entries"` RLS policy already exist from Slice 2 (`supabase/schema.sql`). Slice 3 only inserts rows — no SQL change. End-to-end verification (Task 12) needs a phone + a signed-in desktop; every code task before it is independently verifiable via lint/build/tests.

## File Structure

**Create:**
- `src/lib/glyph.js` — pure glyph system: `simplifyPath` (RDP), `distillGlyph`, `deriveHand`, `GLYPH_VERSION`.
- `src/lib/__tests__/glyph.test.js` — unit tests for the above.
- `src/hooks/useRiteSession.js` — desktop relay-viewer + `riteStage` machine; writes the row.

**Modify:**
- `src/lib/relayProtocol.js` — `ENTRY` message type + `isEntryMessage` guard.
- `src/lib/__tests__/relayProtocol.test.js` — tests for the new type + guard.
- `src/lib/entriesRepo.js` — `createEntry(userId, {song, summary, glyph})`.
- `src/phases/Orchestra.jsx` — accumulate the conducting path; distill at song end.
- `src/phases/Admirer.jsx` — `onCommitEntry` forwards the summary.
- `src/App.jsx` — `glyphRef`; relay the `entry` message at settle.
- `src/journal/EntryPage.jsx` — render the real recorded glyph; fall back to the procedural squiggle.
- `src/journal/Journal.jsx` — `newEntryId` / `sessionId` / `handStyle` props; auto-open; "begin again" QR.
- `src/desktop/FirstTimer.jsx` — take `sessionId` as a prop.
- `src/desktop/Desktop.jsx` — become the root; integrate `useRiteSession`; live-mirror + settled states.
- `src/main.jsx` — desktop root → `Desktop`.
- `CLAUDE.md`, `docs/desktop-journal-design.md` — Slice 3 built.

**Delete:**
- `src/phases/Stage.jsx` — retired (`StageCosmos.jsx` is kept and reused).

**Unchanged (explicitly):** `supabase/schema.sql`, `src/phases/GlyphCanvas.jsx` (kept as documented decoration), `src/lib/sessionStore.js` (the localStorage entry is the agent's memory — a separate concern).

---

## Task 1: The glyph system — pure functions

**Files:**
- Create: `src/lib/glyph.js`
- Test: `src/lib/__tests__/glyph.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/glyph.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { GLYPH_VERSION, simplifyPath, distillGlyph, deriveHand } from '../glyph.js'

describe('simplifyPath (Ramer–Douglas–Peucker)', () => {
  it('keeps both endpoints', () => {
    const pts = [[0, 0, 0], [0.5, 0.01, 1], [1, 0, 2]]
    const out = simplifyPath(pts, 0.1)
    expect(out[0]).toEqual([0, 0, 0])
    expect(out[out.length - 1]).toEqual([1, 0, 2])
  })

  it('collapses a near-straight run to two points', () => {
    const pts = []
    for (let i = 0; i <= 20; i++) pts.push([i / 20, 0.0001 * i, i])
    expect(simplifyPath(pts, 0.05).length).toBe(2)
  })

  it('preserves a sharp corner', () => {
    const pts = [[0, 0, 0], [0.5, 0.5, 1], [1, 0, 2]]
    expect(simplifyPath(pts, 0.1).length).toBe(3)
  })
})

describe('distillGlyph', () => {
  it('returns an empty glyph for empty input', () => {
    expect(distillGlyph([])).toEqual({ v: GLYPH_VERSION, pts: [], dur: 0 })
  })

  it('handles a one-point buffer without throwing', () => {
    const g = distillGlyph([[0.2, 0.3, 0]])
    expect(g.v).toBe(GLYPH_VERSION)
    expect(g.pts.length).toBe(1)
  })

  it('respects the point budget on a large noisy buffer', () => {
    const raw = []
    for (let i = 0; i < 14000; i++) {
      raw.push([0.5 + 0.3 * Math.sin(i / 20), 0.5 + 0.3 * Math.cos(i / 13), i * 16])
    }
    const g = distillGlyph(raw, { budget: 600 })
    expect(g.pts.length).toBeLessThanOrEqual(600)
    expect(g.pts.length).toBeGreaterThan(2)
  })

  it('preserves both endpoints through pre-decimation + budget enforcement', () => {
    const raw = [[0.01, 0.02, 0]]
    for (let i = 1; i < 13999; i++) {
      raw.push([0.5 + 0.3 * Math.sin(i), 0.5 + 0.3 * Math.cos(i * 1.3), i * 16])
    }
    raw.push([0.99, 0.98, 13999 * 16])
    const g = distillGlyph(raw, { budget: 600 })
    expect(g.pts[0]).toEqual([0.01, 0.02, 0])
    expect(g.pts[g.pts.length - 1].slice(0, 2)).toEqual([0.99, 0.98])
  })

  it('keeps t monotonically non-decreasing', () => {
    const raw = []
    for (let i = 0; i < 2000; i++) raw.push([(i * 7) % 100 / 100, (i * 13) % 100 / 100, i * 16])
    const g = distillGlyph(raw)
    for (let i = 1; i < g.pts.length; i++) {
      expect(g.pts[i][2]).toBeGreaterThanOrEqual(g.pts[i - 1][2])
    }
  })

  it('sets dur to the last sample time and rounds coordinates', () => {
    const g = distillGlyph([[0.123456, 0.654321, 0], [0.7, 0.2, 1234.7]])
    expect(g.dur).toBe(1235)
    expect(g.pts[0][0]).toBe(0.123)
    expect(g.pts[0][1]).toBe(0.654)
  })
})

describe('deriveHand', () => {
  it('is deterministic for a given seed', () => {
    expect(deriveHand('user-abc')).toEqual(deriveHand('user-abc'))
  })

  it('produces distinct styles for distinct seeds', () => {
    expect(deriveHand('user-abc')).not.toEqual(deriveHand('user-xyz'))
  })

  it('returns every style field within range', () => {
    const h = deriveHand('any-seed')
    expect(h.inkHue).toBeGreaterThanOrEqual(18)
    expect(h.inkHue).toBeLessThanOrEqual(38)
    expect(h.minWidth).toBeGreaterThan(0)
    expect(h.maxWidth).toBeGreaterThan(h.minWidth)
    expect(h.taper).toBeGreaterThan(0)
    expect(typeof h.inkSat).toBe('number')
    expect(typeof h.inkLight).toBe('number')
  })

  it('handles a null seed without throwing', () => {
    expect(() => deriveHand(null)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/glyph.test.js`
Expected: FAIL — `Failed to resolve import "../glyph.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/glyph.js`:

```js
import { hashText } from './textHash.js'

/**
 * glyph — the journal's glyph system (design doc §8 / spec §3).
 *
 * Two pure concerns:
 *  - distillGlyph: the phone reduces a raw ~14k-sample conducting path into a
 *    small, shape- and tempo-faithful polyline that fits a jsonb column.
 *  - deriveHand: the desktop derives a stable per-account render style (the
 *    "hand") so all of one user's glyphs read as one person's handwriting.
 *
 * A stored glyph is { v, pts: [[x, y, t], ...], dur } — x,y normalised 0..1,
 * t in ms since capture start, dur the total capture length in ms.
 */

export const GLYPH_VERSION = 1

const DEFAULT_BUDGET = 600 // max points in a distilled glyph
const MAX_PRE = 2400 // uniform pre-decimation cap — bounds RDP recursion depth

/** Perpendicular distance from point p to the line a→b (x,y only). */
function perpDistance(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/**
 * Ramer–Douglas–Peucker polyline simplification. Keeps points where the path
 * deviates more than `epsilon`; drops redundant near-straight runs. Endpoints
 * are always preserved. Each point is [x, y, t]; only x,y drive the distance.
 */
export function simplifyPath(points, epsilon) {
  if (points.length <= 2) return points.slice()
  let maxDist = 0
  let idx = 0
  const end = points.length - 1
  for (let i = 1; i < end; i++) {
    const d = perpDistance(points[i], points[0], points[end])
    if (d > maxDist) {
      maxDist = d
      idx = i
    }
  }
  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, idx + 1), epsilon)
    const right = simplifyPath(points.slice(idx), epsilon)
    return left.slice(0, -1).concat(right)
  }
  return [points[0], points[end]]
}

/**
 * Distil a raw conducting buffer into a stored glyph. Uniformly pre-decimates
 * huge buffers (bounding RDP recursion), then RDP-simplifies with an epsilon
 * swept upward until the result is within `budget`. A hard slice cap is the
 * final safety net. Coordinates round to 3 decimals, t to whole ms.
 */
export function distillGlyph(rawPts, opts = {}) {
  const budget = opts.budget || DEFAULT_BUDGET
  const round3 = (n) => Math.round(n * 1000) / 1000
  const pack = (pts) => pts.map((p) => [round3(p[0]), round3(p[1]), Math.round(p[2])])

  if (!Array.isArray(rawPts) || rawPts.length === 0) {
    return { v: GLYPH_VERSION, pts: [], dur: 0 }
  }
  const dur = Math.max(0, Math.round(rawPts[rawPts.length - 1][2] || 0))
  if (rawPts.length <= 2) {
    return { v: GLYPH_VERSION, pts: pack(rawPts), dur }
  }

  // 1. uniform pre-decimation — bounds RDP recursion on huge buffers
  let work = rawPts
  if (rawPts.length > MAX_PRE) {
    const step = rawPts.length / MAX_PRE
    work = []
    for (let i = 0; i < MAX_PRE; i++) work.push(rawPts[Math.floor(i * step)])
    work.push(rawPts[rawPts.length - 1])
  }

  // 2. RDP — sweep epsilon upward until within budget
  let epsilon = 0.004
  let simplified = simplifyPath(work, epsilon)
  let guard = 0
  while (simplified.length > budget && guard < 24) {
    epsilon *= 1.6
    simplified = simplifyPath(work, epsilon)
    guard += 1
  }

  // 3. hard cap — safety net if the sweep never converged. The strided slice
  // can miss the true last point, so force both endpoints back in afterwards
  // (the spec requires endpoints always survive).
  if (simplified.length > budget) {
    const step = simplified.length / budget
    const capped = []
    for (let i = 0; i < budget; i++) capped.push(simplified[Math.floor(i * step)])
    capped[0] = simplified[0]
    capped[capped.length - 1] = simplified[simplified.length - 1]
    simplified = capped
  }

  return { v: GLYPH_VERSION, pts: pack(simplified), dur }
}

/**
 * Derive the per-account "hand" — a stable render style for one user's
 * glyphs. The account id is hashed (FNV-1a, via textHash) and independent
 * fields are carved from the 32-bit result. Constant for a given seed, so
 * every entry a user makes is drawn in the same hand.
 */
export function deriveHand(seed) {
  const h = parseInt(hashText(String(seed ?? '')), 16) >>> 0
  // f(shift, bits) → a 0..1 fraction from `bits` bits at `shift`
  const f = (shift, bits) => {
    const mask = (1 << bits) - 1
    return ((h >>> shift) & mask) / mask
  }
  const weightT = f(8, 6)
  return {
    inkHue: Math.round(18 + f(0, 8) * 20), // 18..38° — warm sienna/umber band
    inkSat: 46,
    inkLight: 16,
    minWidth: 0.8 + weightT * 0.7, // 0.8..1.5
    maxWidth: 3.4 + weightT * 3.0, // 3.4..6.4
    taper: 0.35 + f(14, 6) * 0.5, // 0.35..0.85 — how concentrated the fat middle is
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/glyph.test.js`
Expected: PASS — all `describe` blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/glyph.js src/lib/__tests__/glyph.test.js
git commit -m "feat(journal): add the glyph system — distill + derive-hand"
```

---

## Task 2: Relay protocol — the `entry` message type

**Files:**
- Modify: `src/lib/relayProtocol.js`
- Test: `src/lib/__tests__/relayProtocol.test.js`

- [ ] **Step 1: Add the failing test**

In `src/lib/__tests__/relayProtocol.test.js`, update the import line to add `isEntryMessage`:

```js
import {
  MSG_TYPES, ROLES, encodeMessage, decodeMessage, isGestureMessage, isEntryMessage,
} from '../relayProtocol.js'
```

Then add this to the `relayProtocol — constants` `describe` block, after the `'exports the four conductor→viewer message types'` test:

```js
  it('exports the entry message type', () => {
    expect(MSG_TYPES.ENTRY).toBe('entry')
  })
```

And add this to the `relayProtocol — type guards` `describe` block, after the `isGestureMessage` tests:

```js
  it('isEntryMessage accepts a well-formed entry', () => {
    expect(isEntryMessage({
      type: 'entry',
      song: 'hearth-keeper/acoustic-soft-2000s',
      summary: 'a quiet line',
      glyph: { v: 1, pts: [[0, 0, 0]], dur: 0 },
    })).toBe(true)
  })

  it('isEntryMessage rejects a missing or malformed glyph', () => {
    expect(isEntryMessage({ type: 'entry', song: 'x', summary: 'y' })).toBe(false)
    expect(isEntryMessage({ type: 'entry', glyph: {} })).toBe(false)
    expect(isEntryMessage({ type: 'entry', glyph: { v: 1, dur: 0 } })).toBe(false)
    expect(isEntryMessage({ type: 'phase', phase: 'orchestra' })).toBe(false)
    expect(isEntryMessage(null)).toBe(false)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/relayProtocol.test.js`
Expected: FAIL — `isEntryMessage` is not exported / `MSG_TYPES.ENTRY` is undefined.

- [ ] **Step 3: Implement the new type + guard**

In `src/lib/relayProtocol.js`, add `ENTRY` to the `MSG_TYPES` object:

```js
export const MSG_TYPES = {
  GESTURE:     'gesture',
  PHASE:       'phase',
  AUDIO:       'audio',
  SESSION_END: 'session:end',
  ENTRY:       'entry',
}
```

Then add the guard after `isSessionEndMessage`:

```js
// 'entry' — sent by the conductor at settle. Carries the finished journal
// entry {song, summary, glyph}; the desktop viewer writes the Supabase row.
// This is the relay→Supabase boundary, so the guard also checks the glyph's
// shape (pts must be an array) before the desktop persists or renders it.
export function isEntryMessage(m) {
  return (
    !!m &&
    m.type === MSG_TYPES.ENTRY &&
    !!m.glyph &&
    typeof m.glyph === 'object' &&
    Array.isArray(m.glyph.pts)
  )
}
```

Also extend the file's header comment — in the "Conductor → viewer message types" list, add after the `'session:end'` entry:

```js
//   'entry'       — Sent by the conductor at settle. The finished journal
//                   entry { song, summary, glyph }; the desktop viewer
//                   writes it to Supabase. See useRiteSession.js.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/relayProtocol.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relayProtocol.js src/lib/__tests__/relayProtocol.test.js
git commit -m "feat(relay): add the entry message type + guard"
```

---

## Task 3: `entriesRepo.createEntry`

**Files:**
- Modify: `src/lib/entriesRepo.js`

- [ ] **Step 1: Add the function**

In `src/lib/entriesRepo.js`, add after `fetchEntries` (before `seedSampleEntries`):

```js
/**
 * Write one journal entry for a user. Called by useRiteSession when the phone
 * relays its entry at settle. Returns the inserted row, or null on failure /
 * no client (the no-backend dev fallback). RLS ("insert own entries") plus
 * the explicit user_id ensures a user only ever writes their own rows.
 */
export async function createEntry(userId, { song, summary, glyph }) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('entries')
    .insert({ user_id: userId, song, summary, glyph })
    .select()
    .single()
  if (error) {
    console.error('[entriesRepo] create failed:', error.message)
    return null
  }
  return data
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npx eslint src/lib/entriesRepo.js && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/entriesRepo.js
git commit -m "feat(journal): add entriesRepo.createEntry"
```

---

## Task 4: Orchestra — accumulate + distill the glyph

**Files:**
- Modify: `src/phases/Orchestra.jsx`

The Orchestra's rAF loop already reads the conducting gesture every frame. We additionally append `[pan, filterNorm, t]` to a buffer, and at song end distil it into the shared `glyphRef` (a prop App wires in Task 6 — until then it is `undefined` and the write is skipped, so the build stays green).

- [ ] **Step 1: Import `distillGlyph`**

In `src/phases/Orchestra.jsx`, add after the `scoreArchetype` import (line 15):

```js
import { distillGlyph } from '../lib/glyph.js'
```

- [ ] **Step 2: Accept the `glyphRef` prop**

Change the component signature (line 17):

```js
export default function Orchestra({ avd, revealAudioRef, goToPhase, getAudioCtx, relayRef, glyphRef }) {
```

- [ ] **Step 3: Add the accumulation buffer ref**

In the block of `useRef` declarations (after `const wakeLockRef = useRef(null)`, line 30), add:

```js
  // Slice 3 — raw conducting path [[pan, filterNorm, t], ...] accumulated
  // during the experience phase, distilled into the journal glyph at song end.
  const glyphBufRef = useRef([])
```

- [ ] **Step 4: Accumulate each frame**

In the `tick` function, inside the `if (conducting) {` block, find:

```js
      if (conducting) {
        const gesture = conducting.getData()
        engine.applyConducting(gesture)
```

Add the capture line immediately after `engine.applyConducting(gesture)`:

```js
      if (conducting) {
        const gesture = conducting.getData()
        engine.applyConducting(gesture)
        // Slice 3 — record the conducting path for the journal glyph.
        // roll→x (pan), pitch→y (filterNorm), both calibrated 0..1; t is ms
        // since the experience-phase rAF loop started.
        glyphBufRef.current.push([
          gesture.pan,
          gesture.filterNorm,
          timestamp - startRef.current,
        ])
```

- [ ] **Step 5: Distil at song end**

In the `tick` function, find the song-completion block:

```js
      // Transition to closing card after the song completes
      if (t >= songDuration) {
        engine.stopAll()
```

Insert the distillation immediately after `engine.stopAll()`:

```js
      // Transition to closing card after the song completes
      if (t >= songDuration) {
        engine.stopAll()
        // Slice 3 — distil the recorded conducting path into the glyph and
        // hand it to App (via the shared ref) for the entry relayed at settle.
        if (glyphRef) glyphRef.current = distillGlyph(glyphBufRef.current)
```

- [ ] **Step 6: Verify lint + build**

Run: `npx eslint src/phases/Orchestra.jsx && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/phases/Orchestra.jsx
git commit -m "feat(orchestra): record + distil the conducting glyph"
```

---

## Task 5: Admirer — forward the summary

**Files:**
- Modify: `src/phases/Admirer.jsx`

The `commitEntry` client tool already passes `{summary, ts}` to `onCommitEntry`. We forward `summary` through `onNext` so it reaches `App.jsx`'s `sessionData`.

- [ ] **Step 1: Forward the summary**

In `src/phases/Admirer.jsx`, find `onCommitEntry`:

```js
  // When the agent finalizes, hand off to orchestra.
  const onCommitEntry = useCallback(() => {
    clearFragmentPlayback()
    resolveRating('none')
    setFragmentPlaying(false)
    setTimeout(() => {
      onNext({ stemsBundle: stemsBundleRef.current })
    }, 600)
  }, [onNext, clearFragmentPlayback, resolveRating])
```

Replace it with:

```js
  // When the agent finalizes, hand off to orchestra.
  const onCommitEntry = useCallback((entry) => {
    clearFragmentPlayback()
    resolveRating('none')
    setFragmentPlaying(false)
    setTimeout(() => {
      // Slice 3 — carry the Admirer's one-line summary forward so App can
      // relay it in the entry message at settle.
      onNext({ stemsBundle: stemsBundleRef.current, summary: entry?.summary })
    }, 600)
  }, [onNext, clearFragmentPlayback, resolveRating])
```

- [ ] **Step 2: Verify lint + build**

Run: `npx eslint src/phases/Admirer.jsx && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/phases/Admirer.jsx
git commit -m "feat(admirer): forward the commitEntry summary to App"
```

---

## Task 6: App — relay the `entry` message at settle

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add the `glyphRef`**

In `src/App.jsx`, find:

```js
  const stemsBundleRef = useRef(null)
  const revealAudioRef = useRef(null)
```

Replace with:

```js
  const stemsBundleRef = useRef(null)
  const revealAudioRef = useRef(null)
  // Slice 3 — Orchestra distils the conducting glyph into this ref at song
  // end; App reads it when relaying the entry message at settle.
  const glyphRef = useRef(null)
```

- [ ] **Step 2: Pass `glyphRef` to Orchestra**

Find the `phaseComponent` map and change the `orchestra` line:

```js
    orchestra: <Orchestra avd={avdEngine} revealAudioRef={revealAudioRef} goToPhase={goToPhase} getAudioCtx={getAudioCtx} relayRef={relayRef} glyphRef={glyphRef} />,
```

- [ ] **Step 3: Add the settle-send effect**

In `src/App.jsx`, add this effect immediately after the `resetLiveSession` effect (the one that ends `}, [phase])` near line 86):

```js
  // Slice 3 — close the loop. On entering settle, relay the finished entry
  // (song + summary + glyph) to the paired desktop, which writes the journal
  // row. Fire-and-forget with a bounded retry while the relay reconnects;
  // a solo rite (no relayRef, or no glyph) simply writes nothing.
  useEffect(() => {
    if (phase !== 'settle') return
    const relay = relayRef.current
    const glyph = glyphRef.current
    if (!relay || !glyph) return
    const bundle = stemsBundleRef.current
    const msg = {
      type: 'entry',
      song: bundle ? `${bundle.archetypeId}/${bundle.variationId}` : null,
      summary: sessionData.summary || '',
      glyph,
    }
    if (relay.send(msg)) return
    let tries = 0
    const iv = setInterval(() => {
      tries += 1
      if (relay.send(msg) || tries >= 10) clearInterval(iv)
    }, 500)
    return () => clearInterval(iv)
  }, [phase, sessionData.summary])
```

- [ ] **Step 4: Verify lint + build**

Run: `npx eslint src/App.jsx && npm run build`
Expected: no lint errors (in particular no `react-hooks/exhaustive-deps`); build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): relay the journal entry to the desktop at settle"
```

---

## Task 7: `useRiteSession` hook

**Files:**
- Create: `src/hooks/useRiteSession.js`

The desktop's relay-viewer side: one viewer connection, the `riteStage` state machine, and the entry write. Mirrors the relay logic previously embedded in `Stage.jsx`.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useRiteSession.js`:

```js
import { useEffect, useMemo, useRef, useState } from 'react'
import RelayClient from '../lib/relayClient.js'
import { generateSessionId } from '../lib/sessionId.js'
import { isEntryMessage } from '../lib/relayProtocol.js'
import { createEntry } from '../lib/entriesRepo.js'

/**
 * useRiteSession — the desktop's relay-viewer side (spec §5.2).
 *
 * Opens one viewer connection on a generated session id (one per page load —
 * the QR shown by FirstTimer and the Journal both encode it). Runs the
 * riteStage machine and, when the phone relays its entry at settle, writes
 * the Supabase row and calls onEntryWritten so the caller can refetch.
 *
 *   riteStage: 'idle' | 'rite' | 'orchestra' | 'settling' | 'settled'
 *
 * 'settling' covers the brief window between the entry message and the row
 * write resolving; 'settled' means the row is written and newEntryId is set.
 *
 * The viewer connects regardless of auth state — the relay is Supabase-
 * independent, so the no-backend dev fallback still mirrors a rite. Only the
 * DB write is gated on userId.
 */
export function useRiteSession({ userId, onEntryWritten }) {
  const sessionId = useMemo(() => generateSessionId(), [])
  const [riteStage, setRiteStage] = useState('idle')
  const [latestFreq, setLatestFreq] = useState(null)
  const [newEntryId, setNewEntryId] = useState(null)

  // latest values for the message callback (which closes over first render)
  const userIdRef = useRef(userId)
  userIdRef.current = userId
  const onWrittenRef = useRef(onEntryWritten)
  onWrittenRef.current = onEntryWritten
  const conductorPhaseRef = useRef(null)
  // exactly one entry is written per rite — re-armed when the next rite
  // begins (phase:admirer). Guards against a duplicated 'entry' message.
  const entryHandledRef = useRef(false)

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_RELAY_URL || 'wss://localhost:8443'
    const client = new RelayClient({
      baseUrl,
      sessionId,
      role: 'viewer',
      onMessage: (msg) => {
        if (!msg || typeof msg !== 'object') return

        if (msg.type === 'phase') {
          conductorPhaseRef.current = msg.phase
          // a new rite is beginning — re-arm the entry-write guard
          if (msg.phase === 'admirer') entryHandledRef.current = false
          setRiteStage((s) => {
            if (msg.phase === 'orchestra') return 'orchestra'
            if (msg.phase === 'admirer') return 'rite'
            // a trailing 'entry' phase after settle is the phone returning
            // home — keep 'settling'/'settled' so the new page stays; the
            // initial pairing 'entry' (stage 'idle') stays idle until the
            // rite begins
            if (msg.phase === 'entry') {
              return s === 'settled' || s === 'settling' ? s : 'idle'
            }
            return s // 'settle' — driven by the entry message, not the phase
          })
          return
        }

        if (msg.type === 'audio' && Array.isArray(msg.freq)) {
          setLatestFreq(msg.freq)
          return
        }

        if (isEntryMessage(msg)) {
          if (entryHandledRef.current) return // dedupe — already handled this rite
          entryHandledRef.current = true
          setRiteStage('settling')
          const uid = userIdRef.current
          if (!uid) {
            // no account to write to (the no-backend dev fallback) — recover
            setRiteStage('idle')
            return
          }
          createEntry(uid, { song: msg.song, summary: msg.summary, glyph: msg.glyph })
            .then((row) => {
              if (row) {
                setNewEntryId(String(row.id))
                setRiteStage('settled')
                onWrittenRef.current?.()
              } else {
                // write failed — recover instead of stranding the desktop on
                // the settled loading card
                entryHandledRef.current = false
                setRiteStage('idle')
              }
            })
          return
        }

        if (msg.type === 'session:end' || msg.type === 'conductor:lost') {
          setRiteStage((s) => (s === 'settled' || s === 'settling' ? s : 'idle'))
          conductorPhaseRef.current = null
          return
        }

        if (msg.type === 'conductor:resumed') {
          setRiteStage((s) => {
            if (s === 'settled' || s === 'settling') return s
            return conductorPhaseRef.current === 'orchestra' ? 'orchestra' : 'rite'
          })
        }
      },
    })
    client.start()
    return () => client.stop()
  }, [sessionId])

  return { sessionId, riteStage, latestFreq, newEntryId }
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npx eslint src/hooks/useRiteSession.js && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRiteSession.js
git commit -m "feat(desktop): add useRiteSession — relay viewer + entry write"
```

---

## Task 8: EntryPage — render the real recorded glyph

**Files:**
- Modify: `src/journal/EntryPage.jsx`

`EntryPage`'s `Glyph` currently always draws a procedural squiggle seeded off `entry.seq`. We make it render the *real* recorded path (`entry.glyph`) in the per-account hand when one exists, and keep the procedural squiggle only as the fallback for entries with no glyph (mock + dev-seeded rows).

- [ ] **Step 1: Import `deriveHand`**

In `src/journal/EntryPage.jsx`, add at the top, after the React import:

```js
import { deriveHand } from '../lib/glyph.js'
```

- [ ] **Step 2: Add the real-glyph render helpers**

In `src/journal/EntryPage.jsx`, add these two functions immediately before the `Glyph` function definition:

```js
/**
 * Map a glyph's normalised 0..1 points into a padded canvas box, fitting the
 * path's bounding box so the recorded mark fills the frame.
 */
function fitGlyphPoints(pts, W, H, pad) {
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
  const ox = (W - spanX * scale) / 2
  const oy = (H - spanY * scale) / 2
  return pts.map((p) => [ox + (p[0] - minX) * scale, oy + (p[1] - minY) * scale])
}

/**
 * Lay a polyline down in three feathered passes (a wide pale bleed, a mid
 * body, a sharp core) so the edges feather like wet ink. Per-segment width
 * follows a taper envelope — thin at the ends, full in the middle. Colour and
 * weight come from the per-account `hand`.
 */
function strokeFeathered(ctx, xy, hand) {
  const n = xy.length
  if (n < 2) return
  const widthAt = (i) => {
    const u = i / (n - 1)
    const bell = Math.pow(Math.sin(Math.PI * u), hand.taper) // 0 at ends → 1 mid
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
```

- [ ] **Step 3: Rewrite the `Glyph` component**

In `src/journal/EntryPage.jsx`, replace the entire `Glyph` function (the block beginning `/**\n * Glyph — a hand-painted ink sigil...` and `function Glyph({ seed }) {` through its closing `}` and `return <canvas ... />`) with:

```js
/**
 * Glyph — the entry's hand-painted ink mark.
 *
 * When the entry carries a real recorded conducting path (entry.glyph), it is
 * stroked in the per-account hand — the literal gesture the session left.
 * Entries with no glyph (mock + dev-seeded rows) fall back to the original
 * procedural squiggle seeded off the entry's chronological position.
 */
function Glyph({ glyph, seed, hand }) {
  const ref = useRef(null)
  useEffect(() => {
    const W = 300
    const H = 190
    const c = ref.current
    const ctx = c.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = W * dpr
    c.height = H * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // the real recorded path, drawn in the account's hand
    if (glyph && Array.isArray(glyph.pts) && glyph.pts.length >= 2) {
      strokeFeathered(ctx, fitGlyphPoints(glyph.pts, W, H, 30), hand)
      return
    }

    // fallback — the procedural squiggle (mock + dev-seeded entries)
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
  }, [glyph, seed, hand])
  return <canvas ref={ref} style={{ width: 300, height: 190 }} />
}
```

- [ ] **Step 4: Thread `handStyle` through `EntryPage`**

In `src/journal/EntryPage.jsx`, change the `EntryPage` signature:

```js
export default function EntryPage({ entry, handStyle }) {
```

Immediately inside the function, before the `wash` memo, derive a guaranteed hand:

```js
export default function EntryPage({ entry, handStyle }) {
  const hand = handStyle || deriveHand('default')
  const wash = useMemo(() => (entry ? washBackground(entry.seq) : ''), [entry])
```

Then change the `<Glyph .../>` usage:

```js
        <Glyph glyph={entry.glyph} seed={entry.seq} hand={hand} />
```

- [ ] **Step 5: Verify lint + build**

Run: `npx eslint src/journal/EntryPage.jsx && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/journal/EntryPage.jsx
git commit -m "feat(journal): render the real recorded glyph in EntryPage"
```

---

## Task 9: Journal — newEntryId, the begin-again QR, handStyle

**Files:**
- Modify: `src/journal/Journal.jsx`

`Journal` becomes able to open turned to a specific entry (the just-written one), shows a "begin again" QR, and passes the hand down to `EntryPage`.

- [ ] **Step 1: Import the QR component**

In `src/journal/Journal.jsx`, add after the existing imports (after the `chapters` import):

```js
import { QRCodeSVG } from 'qrcode.react'
```

- [ ] **Step 2: Accept the new props**

Change the `Journal` signature:

```js
export default function Journal({ entries, onSignOut, newEntryId, sessionId, handStyle }) {
```

- [ ] **Step 3: Add the `targetIndex` memo**

Immediately after the `span` memo (the block ending `}, [entries])`), add:

```js
  // the entry to open on — the just-written entry after a rite settles,
  // otherwise the oldest entry (the last array index, since entries are
  // newest-first), matching the manual "open the journal" default
  const targetIndex = useMemo(() => {
    if (newEntryId) {
      const i = entries.findIndex((e) => e.id === newEntryId)
      if (i >= 0) return i
    }
    return entries.length - 1
  }, [entries, newEntryId])
```

- [ ] **Step 4: Open on `targetIndex`**

Replace the `open` callback:

```js
  const open = useCallback(() => {
    if (transRef.current) return
    setBusy(true)
    transRef.current = {
      kind: 'open',
      start: performance.now(),
      firstIndex: targetIndex,
    }
  }, [targetIndex])
```

- [ ] **Step 5: Auto-open after a rite settles**

Immediately after the `jumpTo` callback (the block ending `[index, maxIndex],\n  )`), add:

```js
  // after a rite settles the journal opens itself, turned to the new entry —
  // the desktop "lands on" the page rather than showing the landing screen
  useEffect(() => {
    if (newEntryId && view === 'landing' && !transRef.current) open()
  }, [newEntryId, view, open])
```

- [ ] **Step 6: Pass the hand to `EntryPage`**

Change the entry-page render line:

```js
      {pageVisible && <EntryPage entry={entries[index]} handStyle={handStyle} />}
```

- [ ] **Step 7: Add the begin-again QR**

Immediately after the `onSignOut` button block (the `{onSignOut && ( ... )}` block), add:

```js
      {sessionId && (
        <div
          style={{
            position: 'absolute',
            bottom: 22,
            left: 24,
            zIndex: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <div
            style={{
              padding: 7,
              background: '#fff',
              borderRadius: 3,
              border: '1px solid rgba(28,24,20,0.12)',
            }}
          >
            <QRCodeSVG
              value={`${window.location.origin}/?s=${sessionId}`}
              size={78}
              fgColor="#1C1814"
              bgColor="#fff"
              level="M"
            />
          </div>
          <div
            style={{
              font: '300 9px ui-monospace, SFMono-Regular, monospace',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: view === 'landing' ? 'rgba(231,222,198,0.5)' : 'rgba(28,24,20,0.45)',
            }}
          >
            begin again
          </div>
        </div>
      )}
```

- [ ] **Step 8: Verify lint + build**

Run: `npx eslint src/journal/Journal.jsx && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/journal/Journal.jsx
git commit -m "feat(journal): open on the new entry; begin-again QR; thread the hand"
```

---

## Task 10: Desktop — the root, the live mirror, the settled state

**Files:**
- Modify: `src/desktop/FirstTimer.jsx`
- Modify: `src/desktop/Desktop.jsx`

- [ ] **Step 1: FirstTimer takes `sessionId` as a prop**

`Desktop` now owns the session id (via `useRiteSession`) so the QR matches the relay viewer connection. In `src/desktop/FirstTimer.jsx`, change the imports — replace:

```js
import { useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { generateSessionId } from '../lib/sessionId'
```

with:

```js
import { QRCodeSVG } from 'qrcode.react'
```

Then change the component signature and the `joinUrl` derivation — replace:

```js
export default function FirstTimer({ onSignOut, onSeed }) {
  const sessionId = useMemo(() => generateSessionId(), [])
  const joinUrl = `${window.location.origin}/?s=${sessionId}`
  const isDev = import.meta.env.DEV
```

with:

```js
export default function FirstTimer({ onSignOut, onSeed, sessionId }) {
  const joinUrl = `${window.location.origin}/?s=${sessionId}`
  const isDev = import.meta.env.DEV
```

- [ ] **Step 2: Rewrite `Desktop`**

Replace the entire contents of `src/desktop/Desktop.jsx` with:

```jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useRiteSession } from '../hooks/useRiteSession'
import { fetchEntries, seedSampleEntries } from '../lib/entriesRepo'
import { loadMockEntries } from '../lib/entryFormat'
import { deriveHand } from '../lib/glyph'
import Journal from '../journal/Journal'
import StageCosmos from '../phases/StageCosmos'
import SignIn from './SignIn'
import FirstTimer from './FirstTimer'

/**
 * Desktop — the desktop root (design doc §2; spec §5).
 *
 * Auth-gates between SignIn, FirstTimer (signed in, zero entries) and the
 * Journal. While a paired phone runs a rite the desktop is the live mirror;
 * when the phone relays its entry at settle, useRiteSession writes the row
 * and the Journal reopens turned to the new page. With no Supabase configured
 * it falls through to a no-auth journal on mock data.
 */

const PAPER = '#F2EBD8'

function DesktopLoading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: PAPER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: 'italic 18px Palatino, Georgia, serif',
        color: 'rgba(28,24,20,0.4)',
      }}
    >
      a moment…
    </div>
  )
}

/**
 * RiteMirror — what the desktop shows while a paired phone runs the rite.
 * Pre-Orchestra: a calm "in the rite" card. Orchestra: the cosmos canvas
 * driven by the phone's relayed gesture + audio.
 */
function RiteMirror({ stage, sessionId, latestFreq }) {
  if (stage === 'orchestra') {
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <StageCosmos sessionId={sessionId} latestFreq={latestFreq} />
      </div>
    )
  }
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: PAPER,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>{`@keyframes ritepulse{0%,100%{opacity:.3}50%{opacity:.85}}`}</style>
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#1C1814',
          marginBottom: 24,
          animation: 'ritepulse 4s ease-in-out infinite',
        }}
      />
      <div
        style={{
          font: 'italic 22px Palatino, Georgia, serif',
          color: '#1C1814',
          opacity: 0.7,
        }}
      >
        your conductor is in the rite
      </div>
    </div>
  )
}

export default function Desktop() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  const [loaded, setLoaded] = useState({ uid: null, entries: null })
  // true while the post-settle refetch is in flight — holds the loading card
  // so the pre-rite view never flashes between settle and the new page
  const [awaitingSettle, setAwaitingSettle] = useState(false)

  // refetch for the current user — used after seeding and after a rite
  // settles; called from callbacks, never synchronously in render
  const load = useCallback(async (uid) => {
    setLoaded({ uid, entries: await fetchEntries(uid) })
  }, [])

  // the relay viewer + rite state machine. Writes the journal row when the
  // phone relays its entry at settle, then refetches via onEntryWritten.
  const { sessionId, riteStage, latestFreq, newEntryId } = useRiteSession({
    userId: user?.id ?? null,
    onEntryWritten: async () => {
      if (!user) return
      setAwaitingSettle(true)
      await load(user.id)
      setAwaitingSettle(false)
    },
  })

  // the per-account "hand" — a stable glyph render style across all of one
  // user's entries (design doc §8)
  const handStyle = useMemo(() => deriveHand(user?.id || 'mock'), [user])

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    let active = true
    fetchEntries(user.id).then((e) => {
      if (active) setLoaded({ uid: user.id, entries: e })
    })
    return () => {
      active = false
    }
  }, [user])

  // no backend configured — browse the journal on mock data, no auth
  if (!isSupabaseConfigured) {
    return <Journal entries={loadMockEntries()} handStyle={handStyle} sessionId={sessionId} />
  }
  if (loading) return <DesktopLoading />
  if (!user) return <SignIn onSignIn={signInWithGoogle} />

  // a paired phone is mid-rite — the desktop is the live mirror
  if (riteStage === 'rite' || riteStage === 'orchestra') {
    return <RiteMirror stage={riteStage} sessionId={sessionId} latestFreq={latestFreq} />
  }

  // the entry is being written ('settling') or the post-write refetch is in
  // flight ('awaitingSettle') — hold the loading card so the pre-rite view
  // never flashes. On a write failure useRiteSession reverts to 'idle' and we
  // fall through; on a refetch that returns nothing we land on FirstTimer —
  // either way the desktop recovers and never spins forever.
  if (riteStage === 'settling' || awaitingSettle) {
    return <DesktopLoading />
  }

  // entries are ready only once they have been loaded for the current user
  const entries = loaded.uid === user.id ? loaded.entries : null
  if (entries === null) return <DesktopLoading />
  if (entries.length === 0) {
    return (
      <FirstTimer
        sessionId={sessionId}
        onSignOut={signOut}
        onSeed={async () => {
          await seedSampleEntries(user.id)
          await load(user.id)
        }}
      />
    )
  }
  return (
    <Journal
      entries={entries}
      onSignOut={signOut}
      sessionId={sessionId}
      handStyle={handStyle}
      newEntryId={riteStage === 'settled' ? newEntryId : null}
    />
  )
}
```

Note: all hooks (`useAuth`, `useState`, `useCallback`, `useRiteSession`, `useMemo`, `useEffect`) run unconditionally before any `return` — the early returns are render branches, not conditional hooks.

- [ ] **Step 3: Verify lint + build**

Run: `npx eslint src/desktop/Desktop.jsx src/desktop/FirstTimer.jsx && npm run build`
Expected: no lint errors (in particular no `react-hooks/rules-of-hooks`); build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/desktop/Desktop.jsx src/desktop/FirstTimer.jsx
git commit -m "feat(desktop): Desktop hosts the live mirror + writes entries at settle"
```

---

## Task 11: Route the desktop root to Desktop; retire Stage

**Files:**
- Modify: `src/main.jsx`
- Delete: `src/phases/Stage.jsx`

- [ ] **Step 1: Confirm nothing else imports Stage**

Run: `grep -rn "phases/Stage\.jsx" src/`
Expected: exactly one match — `src/main.jsx`. (The pattern's `\.jsx` excludes `StageCosmos.jsx`, which is a different file and is kept and still imported by `Desktop.jsx`.)

- [ ] **Step 2: Update `main.jsx`**

In `src/main.jsx`, remove the `Stage` import line:

```js
import Stage from './phases/Stage.jsx'
```

In the `pickRoot` comment block, change the line:

```js
//   2. Desktop with no ?s= param → Stage (QR pairing screen)
```

to:

```js
//   2. Desktop with no ?s= param → Desktop (auth-gated journal + live mirror)
```

Change the routing line:

```js
  if (isDesktop && !hasSession) return Stage
```

to:

```js
  if (isDesktop && !hasSession) return Desktop
```

(`Desktop` is already imported.)

- [ ] **Step 3: Delete `Stage.jsx`**

Run: `git rm src/phases/Stage.jsx`

- [ ] **Step 4: Verify lint, build, and tests**

Run: `npm run lint && npm run build && npm test`
Expected: lint clean, build succeeds, all tests pass (the existing suite + the new `glyph` and `relayProtocol` cases).

- [ ] **Step 5: Verify the dev fallback in the browser**

Run `npm run dev`, open the desktop root `/` (no `?s=`) in a desktop-width window.
Expected: with no Supabase env set, the journal renders on mock data — the landing screen, "open the journal", page-through with the procedural-squiggle glyphs, the begin-again QR bottom-left. With Supabase env set: the `SignIn` screen.

- [ ] **Step 6: Commit**

```bash
git add src/main.jsx
git commit -m "feat(desktop): route the desktop root to Desktop; retire Stage"
```

---

## Task 12: Docs + end-to-end verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/desktop-journal-design.md`

- [ ] **Step 1: Update the relay protocol message list in CLAUDE.md**

In `CLAUDE.md`, in the `### QR-paired desktop canvas` section, find the WS-protocol line:

```
- **WS protocol**: see `src/lib/relayProtocol.js`. 4 conductor→viewer message types: `gesture`, `phase`, `audio`, `session:end`. Relay-generated: `conductor:lost`, `conductor:resumed`.
```

Replace it with:

```
- **WS protocol**: see `src/lib/relayProtocol.js`. 5 conductor→viewer message types: `gesture`, `phase`, `audio`, `session:end`, `entry` (the finished journal entry, relayed at settle). Relay-generated: `conductor:lost`, `conductor:resumed`.
```

- [ ] **Step 2: Update the desktop-journal section in CLAUDE.md**

In `CLAUDE.md`, find the `### Desktop journal (/journal)` section and replace its **Slice status line and the "Slice 3 (next)" paragraph** so it reads as built. Specifically, change the opening sentence's slice status from "Slices 1–2 are built; Slice 3 is next." to "Slices 1–3 are built; Slice 4 is next." and replace the final `**Slice 3 (next) — "close the loop":** …` paragraph with:

```markdown
**Slice 3 — "close the loop" (built).** A QR-paired rite writes a real
`entries` row at settle. The phone records the Orchestra conducting gesture,
`distillGlyph` (`src/lib/glyph.js`) reduces it to a small recorded-path glyph,
and `App.jsx` relays one `entry` message. `Desktop` is now the desktop root:
`useRiteSession` (`src/hooks/useRiteSession.js`) holds the relay viewer, runs
the rite state machine, writes the row via `entriesRepo.createEntry`, and the
`Journal` reopens turned to the new page. `EntryPage` renders the real glyph in
a per-account "hand" (`deriveHand`); entries with no glyph keep the procedural
fallback. `Stage` is retired (`StageCosmos` reused as the live mirror). The
Admirer-phase `GlyphCanvas` is kept as pure decoration. **Slice 4 (next) — the
entry detail view:** music replay from R2 + glyph re-animation (the stored
per-point timing makes this a replay).
```

Also, in the same section, find the routing sentence describing `Stage` as the desktop root and update it — replace any phrase of the form "the original `Stage` root + phone-rite/QR-pairing flow are unchanged" with:

```markdown
The desktop root is now `Desktop` itself; `main.jsx` routes desktop-without-`?s=`
straight to it. The phone-rite/QR-pairing relay flow is unchanged.
```

- [ ] **Step 3: Note the capture-architecture departure in the design doc**

In `docs/desktop-journal-design.md`, at the end of **§6 (The entry data model)**, append:

```markdown

> **Slice 3 update.** The glyph is *not* accumulated by the desktop from the
> live gesture stream (the original sketch above). Instead the phone records
> the Orchestra conducting path, distils it (`distillGlyph`), and relays the
> finished `{song, summary, glyph}` in one `entry` message at settle; the
> desktop writes the row. This survives 4 minutes of relay loss as a single
> retryable send rather than 14k streamed frames. See the Slice 3 spec §7.
```

And in **§12 (Build sequence)**, mark slice 3 done — change the `3. **Close the loop — entry capture.** …` line to begin with `3. **Close the loop — entry capture. (Built 2026-05-21.)** `.

- [ ] **Step 4: Commit the docs**

```bash
git add CLAUDE.md docs/desktop-journal-design.md
git commit -m "docs: mark desktop journal Slice 3 (close the loop) built"
```

- [ ] **Step 5: End-to-end verification (requires a phone + a signed-in desktop)**

With Supabase configured (`.env.local` has `VITE_SUPABASE_*`) and the relay reachable (`VITE_RELAY_URL`, or the `wss://localhost:8443` dev relay via `npm run relay`):

1. Open the desktop root `/` → **SignIn** → continue with Google → **FirstTimer** with the QR.
2. Scan the QR with a phone → the phone runs the rite. As the phone reaches the Admirer phase the desktop switches to the **"your conductor is in the rite"** card; at Orchestra it becomes the **cosmos mirror**.
3. Let the song finish → the phone reaches settle → the desktop shows a brief loading card, then the **Journal opens turned to entry #1**, rendered large, showing the **real recorded glyph** (an ink trace of the conducting — not the procedural squiggle).
4. Reload `/` → still signed in → the Journal (returning), the new entry present, the **begin-again QR** bottom-left.
5. Scan the begin-again QR → run a second rite → the journal lands on the new newest page.
6. In Supabase **Table Editor → entries**, confirm each rite added a row with non-null `song`, `summary`, and a `glyph` jsonb `{v,pts,dur}`.

Expected: each step behaves as described; the browser console shows no errors.

---

## Self-Review

**Spec coverage** (`2026-05-21-desktop-journal-slice-3-close-the-loop-design.md`):

- §3.1 Capture (Orchestra, roll/pitch/t) — Task 4 (steps 3–4). ✓
- §3.2 Distil (RDP, budget, rounding, `{v,pts,dur}`) — Task 1 (`distillGlyph`) + Task 4 step 5. ✓
- §3.3 The hand (`deriveHand`, FNV-1a, render-time) — Task 1 (`deriveHand`) + Task 10 (`Desktop` derives it). ✓
- §3.4 Render (real polyline, hand, null fallback) — Task 8. ✓
- §3.5 `GlyphCanvas` kept as decoration — unchanged; documented in Task 12 step 2. ✓
- §4.1 `entry` message + `isEntryMessage` — Task 2. ✓
- §4.2 Phone send (Admirer→summary, Orchestra→glyph, App sends with bounded retry) — Tasks 5, 4, 6. ✓
- §4.3 Desktop write (`createEntry`, no migration) — Task 3 + Task 7. ✓
- §5.1 Routing (`Desktop` root, `Stage` deleted, `StageCosmos` kept) — Task 11. ✓
- §5.2 `useRiteSession` (viewer, `riteStage` machine) — Task 7. ✓
- §5.3 Desktop render states — Task 10 (`Desktop` + `RiteMirror`). ✓
- §5.4 Landing on the new page (`newEntryId`, auto-open) — Task 9 (steps 3–5) + Task 10 (settled branch). ✓
- §5.5 Dev fallback — Task 10 (`!isSupabaseConfigured` branch). ✓
- §8 Testing — Task 1 (`glyph.test.js`), Task 2 (`relayProtocol.test.js`), Task 12 step 5 (manual E2E). ✓

**Out of scope, correctly absent:** glyph re-animation / music replay (Slice 4), solo-rite journal rows, the `region` column, a save-confirmation ack — none have tasks.

**Placeholder scan:** every code step carries complete code; no `TBD`/`TODO`/"handle edge cases"/"similar to Task N". The one not-implemented value — a `song`/`glyph` of `null` on dev-seeded rows — is pre-existing Slice 2 behaviour, untouched here.

**Type consistency:** the glyph object `{ v, pts, dur }` is produced by `distillGlyph` (Task 1), written by Orchestra into `glyphRef` (Task 4), relayed by App (Task 6), guarded by `isEntryMessage` (Task 2), persisted by `createEntry` (Task 3), and consumed by `EntryPage`'s `Glyph` as `glyph.pts` (Task 8) — consistent throughout. The hand object `{ inkHue, inkSat, inkLight, minWidth, maxWidth, taper }` is produced by `deriveHand` (Task 1) and every field is read by `strokeFeathered` (Task 8). `useRiteSession` returns `{ sessionId, riteStage, latestFreq, newEntryId }` (Task 7) — destructured with matching names in `Desktop` (Task 10). `Desktop` passes `entries`/`onSignOut`/`newEntryId`/`sessionId`/`handStyle` to `Journal` (Task 10), all read by `Journal`'s signature (Task 9); `sessionId` to `FirstTimer` (Task 10), read by its signature (Task 10 step 1). `createEntry(userId, {song, summary, glyph})` — call site in `useRiteSession` (Task 7) matches the definition (Task 3).

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-21-desktop-journal-slice-3-close-the-loop.md`.**
