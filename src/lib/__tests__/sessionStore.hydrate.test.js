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
    await eraseAll()
  })

  it('write-through persists to the archive and survives a re-hydrate', async () => {
    appendEntry(buildSessionRecord({ startedAt: 100, summary: 'one' }))
    await new Promise((r) => setTimeout(r, 0))
    const persisted = await getAllSessions()
    expect(persisted.map((s) => s.summary)).toContain('one')
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
