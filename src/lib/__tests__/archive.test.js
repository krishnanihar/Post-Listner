import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getAllSessions, putSession, getMeta, putMeta, exportJson, eraseAll,
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
