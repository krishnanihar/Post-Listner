# Desktop Journal — Slice 3: Close the Loop — Design Spec

*Status: design, agreed via brainstorm 2026-05-21. Branch: `musicking`. This spec
is built from `docs/desktop-journal-design.md` §12 slice 3 and supersedes that
doc's §6 capture sketch (see "Departure from the design doc" below).*

---

## 1. What this slice is

Slice 3 **closes the loop**: a real QR-paired rite produces a real journal
entry. Today the loop is fully open — the Admirer's `commitEntry` tool writes
`{summary, ts}` only to `localStorage` (`sessionStore.js`, the *agent's* memory
for the next conversation), the relay never carries an entry, and the journal's
glyph is a fake procedural squiggle. After this slice, conducting a song writes
a Supabase `entries` row — `{song, summary, glyph}` — with the glyph a real
recording of the conducting gesture, and the desktop lands on that new page.

Three things change together:

1. **Entry capture.** The phone distills the conducting gesture into a glyph,
   and at settle relays one `entry` message; the desktop writes the row.
2. **The glyph system.** The fake `seq`-seeded squiggle is replaced by a real
   recorded motion path, rendered in a stable per-account "hand."
3. **Desktop convergence.** `Desktop` becomes the desktop root; the live rite
   mirror and the entry write fold in; the journal opens on the new entry.

### Three decisions taken in the brainstorm

- **The glyph is a recorded motion path** — the literal line the hand drew,
  resampled — not a structured sigil or a synthesized signature.
- **The capture window is Orchestra only** — the conducting performance, the
  gesture made with intent. The Admirer phase is not recorded.
- **The phone distills and sends a complete entry** — rather than the desktop
  accumulating the live gesture stream (see §7, "Departure from the design
  doc").

---

## 2. Scope

### In scope

- A QR-paired rite writes a Supabase `entries` row at settle: `{song, summary,
  glyph}`.
- The glyph system rebuilt: capture (phone), distill (phone), the hand
  (desktop, render-time), render (desktop).
- `Desktop` becomes the desktop root (`main.jsx` swap); `Stage` is retired;
  the live mirror and entry write fold into `Desktop`; the journal lands
  turned to the new entry.

### Out of scope — deliberate boundaries

- **Glyph re-animation + music replay** → Slice 4 (the entry detail view).
  Slice 3 renders the glyph **statically**. The per-point timing stored in the
  glyph makes Slice 4 re-animation a pure replay.
- **Solo phone rite with no paired desktop** → deferred (design doc §13,
  "mobile sign-in"). With no desktop connected, the `entry` relay message goes
  nowhere and no row is written. The `localStorage` entry in `sessionStore.js`
  still happens — it is the agent's conversational memory, a separate concern,
  and is left untouched.
- **The collective `region` column** → Slice 5/6. Stays `null`.
- **A save-confirmation back to the phone** — the relay has no
  viewer→conductor channel ([SessionRoom.js](../../../relay/src/SessionRoom.js):
  *"v1 has no viewer→conductor traffic"*). The `entry` send is fire-and-forget
  with a bounded retry while the socket reconnects.

---

## 3. The glyph system (the rethink)

Today the glyph is **three disconnected things**: `GlyphCanvas.jsx` (a
decorative phone trail, never saved), `EntryPage.Glyph` (a fake procedural
squiggle seeded off `entry.seq`), and the design doc §6/§8 aspiration (a
recorded gesture + a per-user hand). Slice 3 replaces all three with one
coherent model in four stages.

### 3.1 Capture — phone, Orchestra only

`src/phases/Orchestra.jsx`'s rAF loop already computes the conducting gesture
every frame. It additionally appends a sample `[roll, pitch, t]` to a local
buffer:

- `roll` → `x`, `pitch` → `y`, each the calibrated `pan` / `filterNorm` value
  normalized `0..1` — the **same mapping `GlyphCanvas` already uses**, and the
  same calibrated frame the engine conducts in (Orchestra auto-calibrates the
  baseline on Throne entry, so the path sits in a stable frame).
- `t` is milliseconds since capture start.

The buffer is a plain array held in an Orchestra ref. At a typical 4-minute
song / ~60 fps this is ~14k samples — never stored raw; it is distilled below.

### 3.2 Distill — phone, at song end

When the song ends (Orchestra already detects this for its end-fade), the raw
buffer is reduced by **`distillGlyph(rawPts)`**:

- **Ramer–Douglas–Peucker** polyline simplification — keeps points where the
  path deviates (corners, excursions), drops redundant near-straight runs.
  Epsilon is tuned to a point budget of **≤ ~600 points**; a still session
  yields fewer, a busy one is capped at the budget.
- Endpoints are always preserved; per-point timing is carried through; `x`/`y`
  are rounded to 3 decimals.

Result — the stored `glyph`:

```js
{
  v: 1,                       // GLYPH_VERSION — format version
  pts: [[x, y, t], ...],      // ≤ ~600 samples; x,y in 0..1; t in ms
  dur: 243100                 // total capture duration, ms
}
```

As JSON this is ~10–15 KB — comfortable for a `jsonb` column. `distillGlyph`
is a pure, unit-tested function.

### 3.3 The hand — desktop, render-time

Design doc §8's two-tier model: each session's glyph is unique (the recorded
path), but one person's glyphs share a **hand**. The hand is **not stored** on
the entry — it is derived at render time from the account identity, so it is
automatically constant across all of one user's entries:

**`deriveHand(seed) → handStyle`** — hashes a seed (the account `user_id`
uuid) via the existing `textHash.js` FNV-1a, then maps the hash into a stable
style:

- ink hue band (within the warm sienna/umber range)
- stroke-weight envelope (min/max line width)
- taper character (how sharply strokes thin at their ends)
- curvature temperament (how much the rendered stroke smooths the polyline)

That shared hand is what later makes a person's cluster legible in the Slice 6
collective sky.

### 3.4 Render — desktop

`src/journal/EntryPage.jsx`'s `Glyph` component is rewritten:

- Given `entry.glyph` (a real `{v,pts,dur}` path) **and** a `handStyle`, it
  strokes the **real polyline** using the feathered multi-pass ink it already
  does (a wide pale bleed, a mid body, a sharp core) — but tracing the recorded
  path instead of a random walk.
- When `entry.glyph` is `null` (the bundled mock entries, the dev
  `seedSampleEntries` rows), it falls back to today's procedural squiggle so
  those pages still look right.
- Render is **static** in Slice 3. The stored `pts` timing makes Slice 4
  re-animation a replay of the same data.

### 3.5 The Admirer-phase `GlyphCanvas`

Because the capture window is Orchestra only, `GlyphCanvas.jsx` (the calm
peripheral ink trail shown during the Admirer phase) is **no longer the saved
glyph**. It is **kept as decoration** — the same ink language, read as the hand
limbering before the take — and documented as such in `CLAUDE.md`. It is not
wired to anything persisted.

---

## 4. The relay & entry write

### 4.1 The `entry` message

A new conductor→viewer message type. The Cloudflare Durable Object forwards
**any** conductor message to viewers untouched
([SessionRoom.js](../../../relay/src/SessionRoom.js) `webSocketMessage` →
`_broadcast`) — it is type-agnostic, so **no worker change is needed.**

`src/lib/relayProtocol.js` gains only:

- `MSG_TYPES.ENTRY = 'entry'`
- `isEntryMessage(m)` — guard: `type === 'entry'` and `glyph` is an object.

Message shape:

```js
{
  type: 'entry',
  song:    '<archetypeId>/<variationId>',  // resolvable via stemsCatalog
  summary: '<the Admirer commitEntry sentence>',
  glyph:   { v, pts, dur }                 // §3.2
}
```

### 4.2 Phone send path

- **`Admirer.jsx`** — `onCommitEntry(entry)` reads `entry.summary` (the tool
  already passes `{summary, ts}`) and forwards `summary` through `onNext` into
  `App.jsx`'s `sessionData`.
- **`Orchestra.jsx`** — accumulates the capture buffer in its rAF loop;
  `distillGlyph` at song end; passes the resulting `glyph` forward through the
  phase-transition data payload (the same mechanism `stemsBundle` already
  rides).
- **`App.jsx`** — already owns `relayRef` and sends `phase` / `session:end`.
  It collects `summary` (from `sessionData`), `song` (from `stemsBundleRef` —
  `archetypeId` + `variationId`), and `glyph` (from Orchestra). When the phase
  enters `settle`, it assembles `{type:'entry', song, summary, glyph}` and
  sends it via `relayRef`, with a **bounded retry**: re-attempt every ~500 ms
  for up to ~5 s, gated on `relayRef.current.isConnected()`. The Settle phase
  lasts 6–14 s, so there is ample room. If the socket never opens, the send is
  abandoned silently (no row — consistent with §2's solo-rite boundary).

### 4.3 Desktop receive + write

`src/lib/entriesRepo.js` gains:

```js
export async function createEntry(userId, { song, summary, glyph }) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('entries')
    .insert({ user_id: userId, song, summary, glyph })
    .select()
    .single()
  if (error) { console.error('[entriesRepo] create failed:', error.message); return null }
  return data
}
```

The `entries` table already has every column (`song`, `summary`, `glyph
jsonb`) and the `"insert own entries"` RLS policy from Slice 2 —
**no schema migration is required.**

On receiving an `entry` message the desktop calls `createEntry`, refetches the
user's entries, and flags the new row so the journal opens turned to it (§5.3).

---

## 5. The desktop convergence

### 5.1 Routing

`src/main.jsx`: the desktop-without-`?s=` branch routes to **`Desktop`**
(previously `Stage`). `src/phases/Stage.jsx` is **retired and deleted** — only
`main.jsx` imports it. `src/phases/StageCosmos.jsx` is **kept** and reused as
the live rite mirror.

### 5.2 `useRiteSession` — the desktop relay-viewer hook

A new hook, `src/hooks/useRiteSession.js`, owns the relay-viewer side of the
desktop (the behaviour previously embedded in `Stage`):

- Opens one `RelayClient` viewer on a generated session ID — **one ID per
  desktop page load** (`useMemo`), used by both the `FirstTimer` QR and the
  returning `Journal`'s "begin again" QR. The same ID can host successive
  rites; the DO handles conductor replacement.
- Handles incoming messages:
  - `phase` → drives `riteStage`
  - `audio` / `gesture` → feeds the cosmos mirror
  - `entry` → `createEntry` + refetch + set `newEntryId`
  - `session:end` / `conductor:lost` → resolves the rite
- Exposes `{ sessionId, riteStage, latestFreq, newEntryId }`.

`riteStage` state machine:

```
idle ──phase(pre-orchestra)──▶ rite ──phase(orchestra)──▶ orchestra
  ▲                                                          │
  │                                                       entry msg
  └────────────── (dwell, next rite) ◀── settled ◀──────────┘
```

### 5.3 `Desktop` render states

`Desktop` integrates `useRiteSession` and resolves to:

| Condition | Renders |
|---|---|
| signed out | `SignIn` |
| signed in, 0 entries, `riteStage === 'idle'` | `FirstTimer` (QR) |
| signed in, ≥1 entry, `riteStage === 'idle'` | `Journal` + "begin again" QR |
| `riteStage` is `rite` or `orchestra` | the live mirror (`StageCosmos`) |
| `riteStage === 'settled'` | `Journal`, opened turned to `newEntryId` |

The live mirror shows for both first-timer and returning users (design doc §3:
"the desktop is the live mirror during the rite").

### 5.4 Landing on the new page

After the write, the refetched `entries[0]` is the new row (entries are
newest-first). `Desktop` passes `newEntryId` to `Journal`, which opens the book
**turned to that entry** rather than the landing screen. For a first-timer this
is entry #1, rendered large and ceremonial (design doc §3).

`Journal` gains one prop, `newEntryId` — when set, the open transition lands on
that entry's index instead of the default first index.

### 5.5 Dev fallback

`Desktop` as the root with no Supabase configured still renders the mock
journal (Slice 2 behaviour). Relay/pairing still function (the relay is
Supabase-independent); `createEntry` no-ops via its `if (!supabase)` guard.

---

## 6. File-level change map

### Create

- `src/lib/glyph.js` — pure glyph system: `distillGlyph(rawPts) → {v,pts,dur}`
  (RDP + budget + rounding), `deriveHand(seed) → handStyle`, `GLYPH_VERSION`.
- `src/lib/__tests__/glyph.test.js` — unit tests (§8).
- `src/hooks/useRiteSession.js` — desktop relay-viewer + `riteStage` machine.

### Modify

- `src/lib/relayProtocol.js` — `ENTRY` type + `isEntryMessage` guard.
- `src/lib/entriesRepo.js` — `createEntry(userId, {song, summary, glyph})`.
- `src/phases/Orchestra.jsx` — accumulate `[roll,pitch,t]`; `distillGlyph` at
  song end; pass `glyph` through the phase transition.
- `src/phases/Admirer.jsx` — `onCommitEntry(entry)` forwards `entry.summary`.
- `src/App.jsx` — collect `summary`/`song`/`glyph`; on phase→`settle` send the
  `entry` message with bounded retry.
- `src/desktop/Desktop.jsx` — become the root; integrate `useRiteSession`; add
  the live-mirror and settled→journal-at-new-entry states.
- `src/journal/Journal.jsx` — accept a `newEntryId` prop; open turned to it.
- `src/journal/EntryPage.jsx` — rewrite `Glyph` to stroke the real path with
  `handStyle`; fall back to the procedural squiggle when `entry.glyph` is null.
- `src/main.jsx` — desktop root → `Desktop`.
- `CLAUDE.md` — Slice 3 built; the `entry` relay type; the glyph system; the
  `GlyphCanvas` decoration note; `Stage` retired.
- `docs/desktop-journal-design.md` — mark Slice 3 built; record the §6
  departure (§7 below).

### Delete

- `src/phases/Stage.jsx` — retired (`StageCosmos.jsx` kept).

### Kept unchanged

- `src/phases/GlyphCanvas.jsx` — kept as documented decoration.
- `src/lib/sessionStore.js` — the `localStorage` entry write stays; it is the
  agent's conversational memory, unrelated to the journal row.
- `supabase/schema.sql` — no migration; all columns already exist.

---

## 7. Departure from the design doc

`docs/desktop-journal-design.md` §6 assumed the **desktop** accumulates the
live gesture stream and records the glyph "for free." Slice 3 instead has the
**phone** distill the glyph and send a complete `entry`. Rationale:

- A glyph is a ~4-minute recording. Desktop-accumulation exposes it to 4
  minutes of relay loss/jitter and a volatile viewer buffer wiped by any
  reload. Phone-distillation exposes only **one** message at settle to the
  network — retryable, at a calm moment.
- The relayed `gesture` stream is lossy-by-design (real-time viz); the phone's
  local signal is authoritative and already 1€-filtered.
- It keeps the desktop viewer thin and matches the doc's own §1 framing — "the
  phone *makes* entries; the desktop is where the record *lives*."

The wire cost and relay architecture are unchanged either way; only the
distillation site moves. `docs/desktop-journal-design.md` §6 is updated to
record this.

---

## 8. Testing

### Unit (vitest, `src/lib/__tests__/`)

- **`glyph.test.js`**
  - `distillGlyph` — output point count is within the budget; first and last
    points are preserved; `t` is monotonically non-decreasing; empty and tiny
    (1–2 point) inputs are handled without throwing; a near-straight input
    collapses to ~2 points; `dur` equals the last sample's `t`.
  - `deriveHand` — deterministic for a given seed; distinct seeds yield
    distinct styles; every `handStyle` field is present and within range.
- **`relayProtocol`** — `isEntryMessage` accepts a well-formed `entry` and
  rejects messages missing `type` or `glyph`.

`createEntry` is Supabase IO (no client in jsdom) — not unit-tested; exercised
in manual verification.

### Manual end-to-end

1. Desktop root (no `?s=`) → `Desktop` → sign in → `FirstTimer` with QR.
2. Phone scans → rite runs → during Orchestra the desktop shows the live
   `StageCosmos` mirror.
3. Settle → the phone sends `entry` → the desktop writes the row → the journal
   opens on entry #1, rendered large, with the **real** glyph (an ink trace of
   the conducting, not the fallback squiggle).
4. Returning flow: `Journal` → "begin again" QR → rite → the journal lands on
   the new newest page.
5. Dev fallback: no Supabase env → the mock journal still renders; mock
   entries show the fallback squiggle.

---

## 9. Risks & open tuning

- **RDP epsilon** needs tuning to hit the ≤600-point budget across both still
  and busy sessions — start with an epsilon sweep / a hard cap fallback.
- **The `entry` send** depends on the relay socket being open within the
  6–14 s settle window; the bounded retry covers a reconnect, but a desktop
  offline for the whole window loses the row (accepted — §2 solo-rite
  boundary).
- **Capture frame stability** — the captured `x`/`y` must use the same
  calibrated `pan` / `filterNorm` values the engine conducts with, so the
  glyph path sits in the same frame the user felt.
