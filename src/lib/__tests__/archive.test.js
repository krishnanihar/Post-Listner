import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getAllSessions, putSession, getMeta, putMeta, exportJson, eraseAll,
  putAudio, getAudio,
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

  it('round-trips audio through putAudio/getAudio', async () => {
    // Missing id → undefined; stored id → the value. (A jsdom Blob doesn't
    // survive fake-indexeddb's structuredClone, so byte fidelity is checked
    // below with a Uint8Array; a real browser IndexedDB preserves Blobs.)
    expect(await getAudio('song-1')).toBeUndefined()
    await putAudio('song-1', new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/mpeg' }))
    expect(await getAudio('song-1')).toBeDefined()

    // Byte-level fidelity via a value structuredClone handles cleanly.
    await putAudio('song-2', new Uint8Array([9, 8, 7]))
    expect(Array.from(await getAudio('song-2'))).toEqual([9, 8, 7])
  })

  it('the v2 upgrade preserves a pre-existing session alongside the audio store', async () => {
    // Write a session, then also store audio under the same id — the additive
    // audio store must not disturb existing session data (the DB is at v2 here).
    await putSession(rec('kept', 100))
    await putAudio('kept', new Uint8Array([9, 9]))
    const all = await getAllSessions()
    expect(all.map((r) => r.id)).toEqual(['kept'])
    expect(Array.from(await getAudio('kept'))).toEqual([9, 9])
  })
})
