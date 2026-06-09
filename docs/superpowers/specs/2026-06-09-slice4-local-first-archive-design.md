# Slice 4 — Local-First IndexedDB Archive (Design Spec)

**Date:** 2026-06-09 · **Author:** Knih + Claude · **Status:** Approved basis (coexist), pre-plan.
**Program context:** Fourth slice of the `new-research` spec integration (memory `project_spec_integration`). Slices 1–3 built the signed AVD vector, made the Admirer write it, and made the song follow it. **Slice 4 makes the phone's session record local-first** — a rich, device-resident archive (with the AVD trajectory) that Slice 5's longitudinal mechanics will read.

## 1. Decision basis (locked)

**Coexist, not replace (decision ②a).** The phone/Admirer session state moves from `localStorage` to **IndexedDB**; the **desktop journal stays on Supabase** (accounts, the `entries` table, the collective sky — all untouched). The two surfaces are already separate: cloud = the accounted desktop journal; local = the phone's own session memory. Slice 4 *adds* the local-first spine without removing anything. The relay → desktop → Supabase entry path at settle is unchanged.

This accepts the one place the spec's "nothing leaves the device" can't be absolute: the collective sky inherently needs a shared backend. Local-first governs the *personal record*; the cloud journal remains an opt-in accounted surface.

## 2. Goal

Persist each session as a rich `SessionRecord` in IndexedDB (Ship-Blockers §3, `idb` library), capture the AVD trajectory over the session, migrate the synchronous `sessionStore` reads onto a hydrate-once in-memory cache, and add JSON export + one-button erasure + `navigator.storage.persist()`. No new account, no telemetry, nothing new leaving the device.

## 3. The SessionRecord (`sessionRecord.js`, pure)

```js
{
  schemaVersion: 1,
  id: string,              // `${startedAt}-${rand}` (app code may use Date.now)
  startedAt: number,       // ms epoch
  endedAt: number,         // ms epoch
  finalVector: { a, v, d },// the AVD vector at commit (signed)
  avdTrajectory: [{ t, a, v, d }],  // t = ms since startedAt, sampled ~1 Hz
  landing: { archetypeId, variationId } | null, // the matched song (Slice 3)
  summary: string,         // the agent's commitEntry summary
}
```

`sessionRecord.js` exports:
- `SCHEMA_VERSION = 1`, `makeSessionId(startedAt, rand)`.
- `buildSessionRecord({ startedAt, endedAt, finalVector, avdTrajectory, landing, summary })` → a validated, fully-shaped record (clamps/normalizes; fills defaults).
- Pure **derivations over a records array** (so the old localStorage-derived helpers become functions of the archive): `recencySummaryFrom(records, now)`, `yearTierFrom(records, now)`, `isFirstSessionFrom(records)`. These replace the bodies of `sessionStore`'s current `getRecencySummary`/`getYearTier`/`getIsFirstSession`, which keep their signatures but read the hydrated cache.

Global accumulations that aren't per-session — the **lexicon** map, the **restricted** list, the typed **name** — stay as a small `meta` record (mirrors today's behavior; the dynamic-variables path reads accumulated lexicon).

## 4. The archive layer (`archive.js`, IndexedDB via `idb`)

One database `postlistener` with two object stores:
- `sessions` (keyPath `id`) — the SessionRecords.
- `meta` (keyPath `key`) — `{ key: 'lexicon', value }`, `{ key: 'restricted', value }`, `{ key: 'name', value }`.

API (all async):
- `openArchive()` — opens/creates with an `upgrade` migration keyed on DB version (future schema bumps land here).
- `getAllSessions()` / `putSession(record)`.
- `getMeta(key)` / `putMeta(key, value)`.
- `exportJson()` → `{ schemaVersion, exportedAt, sessions, meta }` string for download.
- `eraseAll()` — `deleteDatabase('postlistener')` + resolve.

Dependencies to add: **`idb`** (runtime), **`fake-indexeddb`** (dev, for Vitest — jsdom has no IndexedDB; tests import `fake-indexeddb/auto`).

## 5. The hydrate cache — migrating `sessionStore` (the fiddly part)

`sessionStore.js` keeps its **synchronous public API** (every consumer — `admirerTools.js`, `Admirer.jsx`, `useAdmirerAgent.js` — is unchanged). Internally it swaps localStorage for an in-memory cache backed by the archive:

- `hydrateSessionStore()` (async, **called once at app start** — `main.jsx`/`App.jsx`, before the Admirer phase): `openArchive()` → load all sessions + meta into the module cache. **One-time legacy migration:** if IndexedDB is empty but the old `localStorage` keys exist, import them into the archive and the cache, then mark migrated.
- Sync reads (`getEntries`, `getLexicon`, `getRestricted`, `getUserName`, `getRecencySummary`, `getYearTier`, `getIsFirstSession`, `buildDynamicVariables`) hit the cache.
- Sync writes (`appendEntry`, `addLexicon`, `addRestricted`, `setUserName`) update the cache **synchronously** and enqueue an async archive write (fire-and-forget, errors logged). So the hot conversational path never awaits IndexedDB.
- Until hydration resolves the cache is empty (first-session behavior) — safe, because hydration is kicked off at app mount and the Admirer phase is several user interactions later.

Back-compat: `getEntries()` returns records that still carry `{ summary, ts }` (we keep `ts = startedAt`) plus the richer fields, so existing readers (recency, dynamic vars) keep working.

## 6. AVD trajectory capture (`avdRecorder.js`)

A small recorder around `avdStore`:
- `startRecording()` — stamps `startedAt`, begins sampling `getAvd()` at ~1 Hz (`setInterval(1000)`), pushing `{ t, a, v, d }`.
- `stopRecording()` — clears the interval, returns `{ startedAt, endedAt, trajectory, finalVector }` (finalVector = last `getAvd()`).
- Reset-safe; idempotent stop.

Pure sampling/shaping helpers are unit-tested; the interval lifecycle is thin glue.

## 7. Host wiring (`Admirer.jsx`, app start)

- **App start:** `hydrateSessionStore()` kicked off (await before first `buildDynamicVariables`, or fire at mount given the phase gap).
- **Admirer mount:** `avdRecorder.startRecording()` (alongside the existing `resetAvd()`).
- **`onStartGeneration(bundle)`:** stash `landing = { archetypeId, variationId }` in a ref.
- **`onCommitEntry(entry)`:** `stopRecording()` → `buildSessionRecord({...})` → `appendEntry(record)` (which now persists to IndexedDB via the cache). The lightweight relay `entry` to the desktop is unchanged.

## 8. Export + erasure (`navigator.storage.persist()`)

- `requestPersistence()` — call `navigator.storage.persist()` once after hydration (best-effort; logs the grant). Guards eviction of the archive.
- `exportArchive()` — `archive.exportJson()` → trigger a JSON file download (a small DOM helper). Surfaced wherever a settings/affordance lives (or a dev route for now; a user-facing control can come later — note it).
- `eraseArchive()` — confirm → `archive.eraseAll()` + clear the cache + clear legacy localStorage keys.

UI surface for export/erase is **minimal/dev-route for this slice** (the GDPR/DPDP "thin notice" + polished controls are a later UX pass); the *capability* must exist and be tested.

## 9. Testing

- `sessionRecord.js`, the derivations, `avdRecorder` sampling — pure Vitest unit tests.
- `archive.js` — Vitest with `fake-indexeddb/auto`: put/get sessions + meta, export shape, erase, upgrade/migration.
- `sessionStore` hydrate + sync-read/async-write + one-time legacy migration — Vitest with `fake-indexeddb/auto` + the jsdom `localStorage`.
- Gate: `npm test` (no regressions; existing `sessionStore.test.js` adapts to the cache model), `npm run build`, no new lint errors.

## 10. Scope

**In:** IndexedDB archive, SessionRecord + AVD trajectory, hydrate-cache migration of `sessionStore`, one-time localStorage import, export + erasure + `storage.persist()`.

**Out / deferred:**
- Supabase / desktop journal / collective sky / relay — **untouched**.
- Polished user-facing export/erasure UX + the DPDP/GDPR consent notice copy — later UX pass (capability ships now, behind a dev affordance).
- Slice 5's longitudinal *features* (Bilderatlas milestones, the longitudinal view) — they consume this archive but are their own slice.
- Continuous cross-device sync of the local archive — not a goal (local-first; the cloud journal is the cross-device surface).
