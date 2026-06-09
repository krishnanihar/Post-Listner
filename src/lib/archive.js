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
