import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetLiveSession, addTranscriptLine, addLexiconWord,
  getLiveSession, subscribeLiveSession,
} from '../liveSession.js'

describe('liveSession', () => {
  beforeEach(() => resetLiveSession())

  it('appends transcript lines with role and trimmed text', () => {
    addTranscriptLine('agent', '  hello  ')
    expect(getLiveSession().transcript).toEqual([{ role: 'agent', text: 'hello' }])
  })

  it('ignores empty transcript text', () => {
    addTranscriptLine('user', '   ')
    expect(getLiveSession().transcript).toEqual([])
  })

  it('accumulates lexicon words and de-duplicates them', () => {
    addLexiconWord('qawwali')
    addLexiconWord('qawwali')
    addLexiconWord('my mom’s tape')
    expect(getLiveSession().lexicon).toEqual(['qawwali', 'my mom’s tape'])
  })

  it('ignores empty lexicon words', () => {
    addLexiconWord('  ')
    expect(getLiveSession().lexicon).toEqual([])
  })

  it('resetLiveSession clears both lists', () => {
    addTranscriptLine('agent', 'x')
    addLexiconWord('y')
    resetLiveSession()
    expect(getLiveSession()).toEqual({ transcript: [], lexicon: [] })
  })

  it('returns a new snapshot reference after each mutation', () => {
    const before = getLiveSession()
    addLexiconWord('z')
    expect(getLiveSession()).not.toBe(before)
  })

  it('notifies subscribers on change and stops after unsubscribe', () => {
    let calls = 0
    const unsub = subscribeLiveSession(() => { calls += 1 })
    addLexiconWord('a')
    expect(calls).toBe(1)
    unsub()
    addLexiconWord('b')
    expect(calls).toBe(1)
  })
})
