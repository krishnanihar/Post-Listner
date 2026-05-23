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

describe('addTranscriptLine dedupe', () => {
  beforeEach(() => { resetLiveSession() })

  it('replaces a partial agent line when its extension lands', () => {
    addTranscriptLine('agent', 'welcome.')
    addTranscriptLine('agent', 'welcome. think of me as a musician.')
    const { transcript } = getLiveSession()
    expect(transcript).toHaveLength(1)
    expect(transcript[0].text).toBe('welcome. think of me as a musician.')
  })

  it('appends when the new agent line is NOT a continuation', () => {
    addTranscriptLine('agent', 'welcome.')
    addTranscriptLine('agent', 'what is around you?')
    const { transcript } = getLiveSession()
    expect(transcript).toHaveLength(2)
    expect(transcript[0].text).toBe('welcome.')
    expect(transcript[1].text).toBe('what is around you?')
  })

  it('does not coalesce across roles', () => {
    addTranscriptLine('agent', 'hello.')
    addTranscriptLine('user', 'hello. hi.')
    const { transcript } = getLiveSession()
    expect(transcript).toHaveLength(2)
  })

  it('appends user lines even when they extend a prior user line (we want both visible)', () => {
    // Push-to-talk means user lines are committed all-at-once, but the SDK
    // may emit tentative + final for the user too; for the *agent* tail we
    // promoted here, dedupe applies to agent role. User role keeps the
    // current append-always behaviour so the prior tests stay green.
    addTranscriptLine('user', 'hello.')
    addTranscriptLine('user', 'hello. how are you.')
    const { transcript } = getLiveSession()
    // Agent dedupe only; user lines append as before.
    expect(transcript).toHaveLength(2)
  })
})
