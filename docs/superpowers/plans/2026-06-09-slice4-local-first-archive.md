# Slice 4 — Local-First IndexedDB Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the phone's session record local-first — a rich `SessionRecord` (with the AVD trajectory) persisted in IndexedDB, with `sessionStore` re-backed by a hydrate-once in-memory cache (synchronous API preserved), plus JSON export + one-button erasure. Supabase / desktop journal / relay are untouched.

**Architecture:** `idb`-backed `archive.js` (sessions + meta stores) ← pure `sessionRecord.js` (schema + derivations) and `avdRecorder.js` (1 Hz trajectory). `sessionStore.js` keeps its sync façade over an in-memory cache hydrated from the archive at app start, write-through to IndexedDB (fire-and-forget, degrades gracefully without IndexedDB), one-time localStorage import.

**Design spec:** `docs/superpowers/specs/2026-06-09-slice4-local-first-archive-design.md`.

**Key risk + mitigation:** re-backing `sessionStore` (a hot-path module). Mitigated by keeping identical sync signatures, an empty-cache-before-hydration default (= first-session, safe), and graceful no-IndexedDB degradation so existing `sessionStore.test.js` passes unchanged.

---

## File Structure
- **Create** `src/lib/sessionRecord.js` (+ test) — schema, builder, derivations.
- **Create** `src/lib/archive.js` (+ test, `fake-indexeddb`) — IndexedDB layer.
- **Create** `src/lib/avdRecorder.js` (+ test) — AVD trajectory recorder.
- **Rewrite internals of** `src/lib/sessionStore.js` (+ new hydrate/migration test) — cache + write-through; API unchanged.
- **Modify** `src/lib/admirerTools.js` — `commitEntry` no longer appends (host does).
- **Modify** `src/phases/Admirer.jsx` — recorder start/stop, build + persist record at commit, landing stash.
- **Modify** `src/App.jsx` — hydrate at mount + request persistence + dev export/erase handles.
- **Add deps:** `idb` (runtime), `fake-indexeddb` (dev).

---

## Task A: Add dependencies

- [ ] **Step 1:** `npm install idb` and `npm install -D fake-indexeddb`.
- [ ] **Step 2:** Confirm versions landed — `grep -E '"idb"|"fake-indexeddb"' package.json` shows both.
- [ ] **Step 3:** `npm run build` → succeeds (no usage yet; just deps).
- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add idb + fake-indexeddb for local-first archive"
```

---

## Task B: `sessionRecord.js` — schema + derivations

**Files:** Create `src/lib/sessionRecord.js`, `src/lib/__tests__/sessionRecord.test.js`.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/sessionRecord.test.js
import { describe, it, expect } from 'vitest'
import {
  SCHEMA_VERSION,
  makeSessionId,
  buildSessionRecord,
  isFirstSessionFrom,
  recencySummaryFrom,
  yearTierFrom,
} from '../sessionRecord.js'

const DAY = 86400000

describe('sessionRecord — buildSessionRecord', () => {
  it('shapes a full record with schemaVersion and defaults', () => {
    const r = buildSessionRecord({
      startedAt: 1000, endedAt: 5000,
      finalVector: { a: 0.5, v: -0.2, d: 0.1 },
      avdTrajectory: [{ t: 0, a: 0, v: 0, d: 0 }, { t: 1000, a: 0.5, v: -0.2, d: 0.1 }],
      landing: { archetypeId: 'sky-seeker', variationId: 'x' },
      summary: 'a bright one', rand: 0.5,
    })
    expect(r.schemaVersion).toBe(SCHEMA_VERSION)
    expect(typeof r.id).toBe('string')
    expect(r.startedAt).toBe(1000)
    expect(r.endedAt).toBe(5000)
    expect(r.finalVector).toEqual({ a: 0.5, v: -0.2, d: 0.1 })
    expect(r.avdTrajectory).toHaveLength(2)
    expect(r.landing).toEqual({ archetypeId: 'sky-seeker', variationId: 'x' })
    expect(r.summary).toBe('a bright one')
  })
  it('clamps the final vector and tolerates missing fields', () => {
    const r = buildSessionRecord({ startedAt: 0, finalVector: { a: 9, v: -9, d: NaN } })
    expect(r.finalVector).toEqual({ a: 1, v: -1, d: 0 })
    expect(r.endedAt).toBe(0)        // defaults to startedAt
    expect(r.avdTrajectory).toEqual([])
    expect(r.landing).toBeNull()
    expect(r.summary).toBe('')
  })
  it('makeSessionId is stable for the same inputs', () => {
    expect(makeSessionId(1000, 0.5)).toBe(makeSessionId(1000, 0.5))
  })
})

describe('sessionRecord — derivations', () => {
  const rec = (startedAt) => ({ schemaVersion: 1, id: String(startedAt), startedAt, endedAt: startedAt, finalVector: { a: 0, v: 0, d: 0 }, avdTrajectory: [], landing: null, summary: '' })

  it('isFirstSessionFrom', () => {
    expect(isFirstSessionFrom([])).toBe(true)
    expect(isFirstSessionFrom([rec(0)])).toBe(false)
  })
  it('recencySummaryFrom buckets by age of the last record', () => {
    expect(recencySummaryFrom([], 0)).toBe('first time')
    expect(recencySummaryFrom([rec(0)], 17 * DAY)).toBe('a few weeks')
    expect(recencySummaryFrom([rec(0)], 0.5 * DAY)).toBe('today')
  })
  it('yearTierFrom is 3 only at >=24 records AND >=180 days since first', () => {
    const many = Array.from({ length: 24 }, () => rec(0))
    expect(yearTierFrom(many, 180 * DAY)).toBe(3)
    expect(yearTierFrom(many, 100 * DAY)).toBe(1)
    expect(yearTierFrom(Array.from({ length: 23 }, () => rec(0)), 200 * DAY)).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/sessionRecord.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js
// src/lib/sessionRecord.js
// The local-first session record (Ship-Blockers §3) + pure derivations over a
// records array. archive.js persists these; sessionStore.js reads them from a
// hydrated cache. No DOM, no storage here.

export const SCHEMA_VERSION = 1

export function makeSessionId(startedAt, rand = 0) {
  const r = Math.floor((Number.isFinite(rand) ? rand : 0) * 1e9).toString(36)
  return `${startedAt}-${r}`
}

function clampUnit(x) {
  return Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0))
}
function vec(v) {
  return { a: clampUnit(v?.a), v: clampUnit(v?.v), d: clampUnit(v?.d) }
}

export function buildSessionRecord({
  id, startedAt, endedAt, finalVector, avdTrajectory, landing, summary, rand,
} = {}) {
  const start = Number.isFinite(startedAt) ? startedAt : 0
  return {
    schemaVersion: SCHEMA_VERSION,
    id: id || makeSessionId(start, rand ?? 0),
    startedAt: start,
    endedAt: Number.isFinite(endedAt) ? endedAt : start,
    finalVector: vec(finalVector),
    avdTrajectory: Array.isArray(avdTrajectory)
      ? avdTrajectory.map((p) => ({ t: p.t | 0, a: clampUnit(p.a), v: clampUnit(p.v), d: clampUnit(p.d) }))
      : [],
    landing: landing && landing.archetypeId
      ? { archetypeId: landing.archetypeId, variationId: landing.variationId }
      : null,
    summary: typeof summary === 'string' ? summary : '',
  }
}

export function isFirstSessionFrom(records) {
  return (records?.length || 0) === 0
}

export function recencySummaryFrom(records, now = 0) {
  if (!records || records.length === 0) return 'first time'
  const last = records[records.length - 1]
  const ageDays = (now - (last.startedAt || 0)) / 86400000
  if (ageDays < 1) return 'today'
  if (ageDays < 2) return 'yesterday'
  if (ageDays < 7) return 'a few days'
  if (ageDays < 21) return 'a few weeks'
  if (ageDays < 70) return 'a couple months'
  return 'a long time'
}

export function yearTierFrom(records, now = 0) {
  if (!records || records.length < 24) return 1
  const first = records[0]?.startedAt || 0
  const daysSinceFirst = (now - first) / 86400000
  return daysSinceFirst >= 180 ? 3 : 1
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lib/__tests__/sessionRecord.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sessionRecord.js src/lib/__tests__/sessionRecord.test.js
git commit -m "feat(archive): SessionRecord schema + derivations"
```

---

## Task C: `archive.js` — IndexedDB layer

**Files:** Create `src/lib/archive.js`, `src/lib/__tests__/archive.test.js`.

- [ ] **Step 1: Write the failing test** (imports the IndexedDB polyfill first)

```js
// src/lib/__tests__/archive.test.js
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  openArchive, getAllSessions, putSession, getMeta, putMeta, exportJson, eraseAll,
} from '../archive.js'

const rec = (id, startedAt) => ({ schemaVersion: 1, id, startedAt, endedAt: startedAt, finalVector: { a: 0, v: 0, d: 0 }, avdTrajectory: [], landing: null, summary: id })

describe('archive', () => {
  beforeEach(async () => { await eraseAll() })

  it('puts and gets sessions, sorted by startedAt', async () => {
    await putSession(rec('b', 200))
    await putSession(rec('a', 100))
    const all = await getAllSessions()
    expect(all.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('puts and gets meta values', async () => {
    expect(await getMeta('lexicon')).toBeUndefined()
    await putMeta('lexicon', { qawwali: 'tapes' })
    expect(await getMeta('lexicon')).toEqual({ qawwali: 'tapes' })
  })

  it('exportJson returns sessions + meta as a JSON string', async () => {
    await putSession(rec('a', 100))
    await putMeta('restricted', ['hymns'])
    const json = JSON.parse(await exportJson(1234))
    expect(json.schemaVersion).toBe(1)
    expect(json.exportedAt).toBe(1234)
    expect(json.sessions.map((r) => r.id)).toEqual(['a'])
    expect(json.meta.restricted).toEqual(['hymns'])
  })

  it('eraseAll wipes everything', async () => {
    await putSession(rec('a', 100))
    await eraseAll()
    expect(await getAllSessions()).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/archive.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js
// src/lib/archive.js
// Local-first archive: IndexedDB via idb. Two stores — `sessions` (rich
// SessionRecords) and `meta` (global lexicon / restricted / name). All async.
// Slice 4 of the spec-integration program. The desktop journal's Supabase
// backing is separate and untouched.

import { openDB, deleteDB } from 'idb'

const DB_NAME = 'postlistener'
const DB_VERSION = 1
const SESSIONS = 'sessions'
const META = 'meta'

let dbPromise = null

export function openArchive() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SESSIONS)) db.createObjectStore(SESSIONS, { keyPath: 'id' })
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

export async function getAllSessions() {
  const db = await openArchive()
  const all = await db.getAll(SESSIONS)
  return all.sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))
}

export async function putSession(record) {
  const db = await openArchive()
  await db.put(SESSIONS, record)
}

export async function getMeta(key) {
  const db = await openArchive()
  const row = await db.get(META, key)
  return row ? row.value : undefined
}

export async function putMeta(key, value) {
  const db = await openArchive()
  await db.put(META, { key, value })
}

export async function exportJson(now = Date.now()) {
  const sessions = await getAllSessions()
  const meta = {}
  for (const key of ['lexicon', 'restricted', 'name']) {
    const v = await getMeta(key)
    if (v !== undefined) meta[key] = v
  }
  return JSON.stringify({ schemaVersion: DB_VERSION, exportedAt: now, sessions, meta })
}

export async function eraseAll() {
  if (dbPromise) {
    try { (await dbPromise).close() } catch { /* already closed */ }
    dbPromise = null
  }
  await deleteDB(DB_NAME)
}

// Best-effort opt-out of storage eviction (Ship-Blockers §3). Returns the
// grant boolean, false if unsupported.
export async function requestPersistence() {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist()
    }
  } catch { /* ignore */ }
  return false
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lib/__tests__/archive.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/archive.js src/lib/__tests__/archive.test.js
git commit -m "feat(archive): IndexedDB layer (sessions + meta, export, erase)"
```

---

## Task D: `avdRecorder.js` — AVD trajectory

**Files:** Create `src/lib/avdRecorder.js`, `src/lib/__tests__/avdRecorder.test.js`.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/avdRecorder.test.js
import { describe, it, expect } from 'vitest'
import { createAvdRecorder } from '../avdRecorder.js'

describe('avdRecorder', () => {
  it('records a trajectory with start, manual samples, and a final point', () => {
    let cur = { a: 0, v: 0, d: 0 }
    const r = createAvdRecorder({ read: () => cur })
    r.start(0, { intervalMs: 0 }) // no live interval in tests
    expect(r.isRecording()).toBe(true)
    cur = { a: 0.5, v: 0, d: 0 }
    r.sample(1000)
    cur = { a: 0.8, v: -0.2, d: 0.1 }
    const out = r.stop(2000)
    expect(r.isRecording()).toBe(false)
    expect(out.startedAt).toBe(0)
    expect(out.endedAt).toBe(2000)
    expect(out.finalVector).toEqual({ a: 0.8, v: -0.2, d: 0.1 })
    // start point (t0) + manual sample (t1000) + final point (t2000)
    expect(out.trajectory.map((p) => p.t)).toEqual([0, 1000, 2000])
    expect(out.trajectory[1]).toEqual({ t: 1000, a: 0.5, v: 0, d: 0 })
  })

  it('sample is a no-op when not recording', () => {
    const r = createAvdRecorder({ read: () => ({ a: 0, v: 0, d: 0 }) })
    r.sample(500) // before start
    const out = r.start(0, { intervalMs: 0 }) // returns nothing; just shouldn't throw
    expect(out).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/avdRecorder.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js
// src/lib/avdRecorder.js
// Samples the AVD vector at ~1 Hz over a session into a trajectory. The live
// setInterval is the only untested glue; the start/sample/stop shaping is
// pure and injectable (read + explicit timestamps) for tests.

import { getAvd } from './avdStore.js'

function shapePoint(v, t) {
  return { t: t | 0, a: v.a, v: v.v, d: v.d }
}

export function createAvdRecorder({ read = getAvd } = {}) {
  let active = false
  let startedAt = 0
  let traj = []
  let timer = null

  return {
    isRecording: () => active,
    start(now, { intervalMs = 1000 } = {}) {
      active = true
      startedAt = now
      traj = [shapePoint(read(), 0)]
      if (intervalMs > 0 && typeof setInterval === 'function') {
        timer = setInterval(() => {
          if (active) traj.push(shapePoint(read(), Date.now() - startedAt))
        }, intervalMs)
      }
    },
    sample(now) {
      if (active) traj.push(shapePoint(read(), now - startedAt))
    },
    stop(now) {
      if (timer) { clearInterval(timer); timer = null }
      const finalVector = read()
      const result = {
        startedAt,
        endedAt: now,
        trajectory: [...traj, shapePoint(finalVector, now - startedAt)],
        finalVector,
      }
      active = false
      traj = []
      return result
    },
  }
}

// Host singleton (reads the live avdStore).
export const avdRecorder = createAvdRecorder()
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lib/__tests__/avdRecorder.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/avdRecorder.js src/lib/__tests__/avdRecorder.test.js
git commit -m "feat(archive): AVD trajectory recorder"
```

---

## Task E: Re-back `sessionStore.js` with the hydrate cache

**Files:** Rewrite internals of `src/lib/sessionStore.js`; create `src/lib/__tests__/sessionStore.hydrate.test.js`. The existing `src/lib/__tests__/sessionStore.test.js` should pass **unchanged** (verify — see Step 4).

- [ ] **Step 1: Rewrite `src/lib/sessionStore.js`** (keep every export name + signature):

```js
// Per-user state for the Admirer. Local-first: IndexedDB (archive.js) is the
// spine; this module is a SYNCHRONOUS façade over an in-memory cache hydrated
// from the archive at app start. Reads hit the cache; writes update the cache
// synchronously AND write through to the archive (fire-and-forget, tolerant of
// environments without IndexedDB — e.g. jsdom unit tests). Legacy localStorage
// data is imported into the archive once.

import {
  openArchive, getAllSessions, putSession, getMeta, putMeta, eraseAll,
} from './archive.js'
import {
  buildSessionRecord,
  isFirstSessionFrom,
  recencySummaryFrom,
  yearTierFrom,
} from './sessionRecord.js'

const LEGACY = {
  ENTRIES: 'musicking_entries',
  LEXICON: 'musicking_lexicon',
  RESTRICTED: 'musicking_restricted',
  USER_NAME: 'musicking_user_name',
  MIGRATED: 'musicking_migrated_to_idb',
}

let cache = { sessions: [], lexicon: {}, restricted: [], name: '' }

function writeThrough(fn) {
  Promise.resolve().then(fn).catch((e) => console.warn('[archive] write failed', e))
}

export async function hydrateSessionStore() {
  try {
    await openArchive()
    await maybeMigrateLegacy()
    cache = {
      sessions: await getAllSessions(),
      lexicon: (await getMeta('lexicon')) || {},
      restricted: (await getMeta('restricted')) || [],
      name: (await getMeta('name')) || '',
    }
  } catch (e) {
    console.warn('[archive] hydrate failed — running from empty cache', e)
  }
}

async function maybeMigrateLegacy() {
  try {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem(LEGACY.MIGRATED)) return
    const existing = await getAllSessions()
    if (existing.length === 0) {
      const raw = localStorage.getItem(LEGACY.ENTRIES)
      const entries = raw ? JSON.parse(raw) : []
      for (const e of Array.isArray(entries) ? entries : []) {
        await putSession(buildSessionRecord({ startedAt: e.ts || 0, summary: e.summary || '' }))
      }
      const lex = JSON.parse(localStorage.getItem(LEGACY.LEXICON) || '{}')
      const res = JSON.parse(localStorage.getItem(LEGACY.RESTRICTED) || '[]')
      const nm = localStorage.getItem(LEGACY.USER_NAME) || ''
      if (lex && typeof lex === 'object') await putMeta('lexicon', lex)
      if (Array.isArray(res)) await putMeta('restricted', res)
      if (nm) await putMeta('name', nm)
    }
    localStorage.setItem(LEGACY.MIGRATED, '1')
  } catch (e) {
    console.warn('[archive] legacy migration skipped', e)
  }
}

export function getEntries() {
  return [...cache.sessions]
}

// Accepts a full SessionRecord (preferred) or a legacy { summary, ts }.
export function appendEntry(record) {
  const rec = record && record.schemaVersion
    ? record
    : buildSessionRecord({ startedAt: record?.ts ?? Date.now(), summary: record?.summary || '', rand: Math.random() })
  cache.sessions.push(rec)
  writeThrough(() => putSession(rec))
}

export function getIsFirstSession() {
  return isFirstSessionFrom(cache.sessions)
}

export function getLexicon() {
  return { ...cache.lexicon }
}

export function addLexicon(term, userPhrasing) {
  if (!term || !userPhrasing) return
  cache.lexicon = { ...cache.lexicon, [term]: userPhrasing }
  writeThrough(() => putMeta('lexicon', cache.lexicon))
}

export function getRestricted() {
  return [...cache.restricted]
}

export function addRestricted(repertoire) {
  if (!repertoire || cache.restricted.includes(repertoire)) return
  cache.restricted = [...cache.restricted, repertoire]
  writeThrough(() => putMeta('restricted', cache.restricted))
}

export function getUserName() {
  return cache.name || ''
}

export function setUserName(name) {
  const trimmed = (name || '').trim()
  if (!trimmed) return
  cache.name = trimmed
  writeThrough(() => putMeta('name', trimmed))
}

export function getRecencySummary(now = Date.now()) {
  return recencySummaryFrom(cache.sessions, now)
}

export function getYearTier(now = Date.now()) {
  return yearTierFrom(cache.sessions, now)
}

export function getTimeOfDay(now = new Date()) {
  const h = now.getHours()
  if (h < 5) return 'late'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 22) return 'evening'
  return 'late'
}

// Flat object passed to the agent as dynamicVariables — primitives only
// (arrays silently kill the ElevenLabs conversation). Reads the cache.
export function buildDynamicVariables() {
  const entries = cache.sessions
  return {
    is_first_session: entries.length === 0,
    session_count: entries.length,
    recency_summary: getRecencySummary(),
    time_of_day: getTimeOfDay(),
    prior_lexicon: Object.entries(cache.lexicon)
      .slice(-12)
      .map(([k, v]) => `${k}: "${v}"`)
      .join('; '),
    prior_entries_summary: entries.slice(-5).map((e) => e.summary).join(' | '),
    restricted_repertoires: cache.restricted.join(', '),
  }
}

// Reset everything — cache (sync) + archive (best-effort async) + legacy keys.
export function clearAll() {
  cache = { sessions: [], lexicon: {}, restricted: [], name: '' }
  writeThrough(() => eraseAll())
  try {
    if (typeof localStorage !== 'undefined') {
      for (const k of Object.values(LEGACY)) localStorage.removeItem(k)
    }
  } catch { /* ignore */ }
}
```

- [ ] **Step 2: Add the hydrate/migration test**

```js
// src/lib/__tests__/sessionStore.hydrate.test.js
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { eraseAll, getAllSessions } from '../archive.js'
import {
  hydrateSessionStore, appendEntry, getEntries, addLexicon, getLexicon, clearAll,
} from '../sessionStore.js'
import { buildSessionRecord } from '../sessionRecord.js'

describe('sessionStore — local-first hydrate + write-through', () => {
  beforeEach(async () => {
    localStorage.clear()
    await eraseAll()
    clearAll()
    await eraseAll() // clearAll's async erase may race; ensure clean
  })

  it('write-through persists to the archive and survives a re-hydrate', async () => {
    appendEntry(buildSessionRecord({ startedAt: 100, summary: 'one' }))
    // allow the fire-and-forget write to flush
    await new Promise((r) => setTimeout(r, 0))
    const persisted = await getAllSessions()
    expect(persisted.map((s) => s.summary)).toContain('one')

    // simulate a fresh app load: clear the in-memory cache by re-hydrating
    await hydrateSessionStore()
    expect(getEntries().map((s) => s.summary)).toContain('one')
  })

  it('one-time migration imports legacy localStorage entries', async () => {
    localStorage.setItem('musicking_entries', JSON.stringify([{ summary: 'legacy', ts: 500 }]))
    localStorage.setItem('musicking_lexicon', JSON.stringify({ qawwali: 'tapes' }))
    await hydrateSessionStore()
    expect(getEntries().map((s) => s.summary)).toContain('legacy')
    expect(getLexicon()).toMatchObject({ qawwali: 'tapes' })
    expect(localStorage.getItem('musicking_migrated_to_idb')).toBe('1')
  })
})
```

- [ ] **Step 3: Run the new test** — `npx vitest run src/lib/__tests__/sessionStore.hydrate.test.js` → PASS.

- [ ] **Step 4: Confirm the EXISTING sessionStore test still passes UNCHANGED** — `npx vitest run src/lib/__tests__/sessionStore.test.js` → PASS. It runs without `fake-indexeddb`, so the write-through no-ops (no IndexedDB in jsdom) and the cache-only behavior matches the old localStorage behavior. If anything fails, the cause is a behavior divergence in the cache logic — fix the *implementation*, not the existing test (its assertions encode the contract). The only acceptable test edit: if it relied on `localStorage` keys directly (it does not — it uses the public API).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sessionStore.js src/lib/__tests__/sessionStore.hydrate.test.js
git commit -m "feat(archive): re-back sessionStore with hydrate cache + write-through"
```

---

## Task F: Host wiring — recorder + record persistence + hydrate

**Files:** Modify `src/lib/admirerTools.js`, `src/phases/Admirer.jsx`, `src/App.jsx`. Verified by build + lint + the full suite (glue).

- [ ] **Step 1: Stop `commitEntry` from appending** (the host now writes the rich record). In `src/lib/admirerTools.js`, change the `commitEntry` tool so it no longer calls `appendEntry` — it just notifies the host:

```js
    commitEntry: ({ summary } = {}) => {
      const entry = { summary: summary || '', ts: Date.now() }
      cb.onCommitEntry?.(entry)
      return { ok: true }
    },
```

Remove the now-unused `appendEntry` import from `admirerTools.js` if nothing else uses it (check; `recordLexicon`/`markRestricted` use `addLexicon`/`addRestricted`, not `appendEntry`). Read `src/lib/__tests__/admirerTools.test.js`: if any test asserted `commitEntry` appended an entry, update it to assert `onCommitEntry` was *called* with the summary instead (persistence moved to the host).

- [ ] **Step 2: Wire the recorder + record build in `src/phases/Admirer.jsx`.** Add imports:

```jsx
import { avdRecorder } from '../lib/avdRecorder.js'
import { buildSessionRecord } from '../lib/sessionRecord.js'
import { appendEntry, getYearTier, getEntries, buildDynamicVariables } from '../lib/sessionStore.js' // extend the existing sessionStore import to include appendEntry
import { getAvd } from '../lib/avdStore.js' // if not already imported from Slice 2 wiring
```

(Confirm against the current imports — `getEntries`, `getYearTier`, `buildDynamicVariables`, `getAvd` may already be imported from Slices 2–3; only add what's missing, and add `appendEntry`.)

In the existing Admirer mount effect (the one that already does `resetAvd()` + `askedSeedIdsRef.current = []` from Slice 2), start the recorder and stop it on unmount:

```jsx
  useEffect(() => {
    resetAvd()
    askedSeedIdsRef.current = []
    avdRecorder.start(Date.now())
    return () => {
      resetAvd()
      if (avdRecorder.isRecording()) avdRecorder.stop(Date.now())
    }
  }, [])
```

In `onCommitEntry`, build and persist the rich record before the handoff `setTimeout`:

```jsx
  const onCommitEntry = useCallback((entry) => {
    clearFragmentPlayback()
    resolveRating('none')
    setFragmentPlaying(false)
    try {
      const rec = avdRecorder.isRecording() ? avdRecorder.stop(Date.now()) : null
      const bundle = stemsBundleRef.current
      const record = buildSessionRecord({
        startedAt: rec?.startedAt ?? Date.now(),
        endedAt: rec?.endedAt ?? Date.now(),
        finalVector: rec?.finalVector ?? getAvd(),
        avdTrajectory: rec?.trajectory ?? [],
        landing: bundle ? { archetypeId: bundle.archetypeId, variationId: bundle.variationId } : null,
        summary: entry?.summary || '',
        rand: Math.random(),
      })
      appendEntry(record)
    } catch (e) {
      console.warn('[admirer] session record persist failed', e)
    }
    setTimeout(() => {
      onNext({ stemsBundle: stemsBundleRef.current, summary: entry?.summary })
    }, 600)
  }, [onNext, clearFragmentPlayback, resolveRating])
```

- [ ] **Step 3: Hydrate at app start in `src/App.jsx`.** Add imports + a mount effect:

```jsx
import { hydrateSessionStore } from './lib/sessionStore.js'
import { requestPersistence } from './lib/archive.js'
```
```jsx
  useEffect(() => {
    hydrateSessionStore().then(() => { requestPersistence() })
  }, [])
```

(Place it with App's other top-level effects. The entry→admirer user gap guarantees hydration resolves before the first `buildDynamicVariables`.)

- [ ] **Step 4: Verify** — `npm run build` succeeds; `npx eslint src/lib/admirerTools.js src/phases/Admirer.jsx src/App.jsx src/lib/avdRecorder.js` → no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admirerTools.js src/phases/Admirer.jsx src/App.jsx src/lib/__tests__/admirerTools.test.js
git commit -m "feat(archive): record AVD trajectory + persist SessionRecord at commit; hydrate on app start"
```

---

## Task G: Export / erase dev affordance

**Files:** Modify `src/App.jsx` (dev-only handles). The capability (`exportJson`/`eraseAll`) is already built + tested in Task C; this exposes it without building a settings UI yet.

- [ ] **Step 1: Add a dev-only export/erase handle in `src/App.jsx`** (a small DOM download helper + window handles guarded by `import.meta.env.DEV`):

```jsx
import { exportJson, eraseAll } from './lib/archive.js'
```
```jsx
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    const download = async () => {
      const json = await exportJson()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'postlistener-archive.json'
      a.click()
      URL.revokeObjectURL(url)
    }
    window.__plArchive = { export: download, erase: eraseAll }
    return () => { delete window.__plArchive }
  }, [])
```

(User-facing export/erase UI + the DPDP/GDPR consent notice copy are a later UX pass — the capability + tests land now, reachable via `window.__plArchive` in dev.)

- [ ] **Step 2: Verify** — `npm run build` succeeds; `npx eslint src/App.jsx` → no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(archive): dev-only export/erase handles (window.__plArchive)"
```

---

## Task H: Full gate + docs

- [ ] **Step 1: Full gate** — `npm test` (no regressions; new suites pass — sessionRecord, archive, avdRecorder, sessionStore.hydrate, plus the unchanged sessionStore + admirerTools), `npm run build` (clean), `npm run lint` (≤ ~149 baseline, no new errors).

- [ ] **Step 2: Update `CLAUDE.md`** — replace the `sessionStore.js` "localStorage in Phase A; IndexedDB later" framing with the local-first reality: IndexedDB archive (`archive.js`) is the spine, `sessionStore` is a sync façade over a hydrate-once cache, rich `SessionRecord` with AVD trajectory written at commit, export/erase via `window.__plArchive` (dev), Supabase desktop journal untouched. Add `sessionRecord.js`/`archive.js`/`avdRecorder.js` to the lib list. Update the Slice status line: Slice 4 done, Slice 5 (longitudinal mechanics) next.

- [ ] **Step 3: Update memory** `project_spec_integration.md` — Slice 4 done, Slice 5 next.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: local-first IndexedDB archive (Slice 4)"
```

---

## Self-Review

**Spec coverage:** IndexedDB archive w/ sessions+meta (Task C) ✓; SessionRecord + AVD trajectory (Tasks B, D, F) ✓; hydrate-cache migration of sessionStore preserving the sync API (Task E) ✓; one-time legacy import (Task E) ✓; export + erase + `requestPersistence` (Tasks C, F, G) ✓; coexist — Supabase/journal/relay untouched (no edits to those files anywhere) ✓; commitEntry double-write avoided by moving persistence to the host (Task F) ✓. Polished export/erase UX + consent copy + Slice 5 features — explicitly deferred.

**Placeholder scan:** every code step is complete; test data is concrete; the one async-race guard in the hydrate test's `beforeEach` is explained.

**Type/name consistency:** `buildSessionRecord`, `isFirstSessionFrom`, `recencySummaryFrom`, `yearTierFrom`, `SCHEMA_VERSION`, `makeSessionId` (Task B) are consumed in Tasks E/F with matching signatures; `openArchive`/`getAllSessions`/`putSession`/`getMeta`/`putMeta`/`exportJson`/`eraseAll`/`requestPersistence` (Task C) match `sessionStore`/`App` usage; `createAvdRecorder`/`avdRecorder.start/sample/stop/isRecording` (Task D) match the Admirer wiring (Task F); `sessionStore`'s public API names are byte-for-byte the same as before the rewrite (Task E), so `admirerTools`/`useAdmirerAgent`/`Admirer` keep importing the same symbols.
