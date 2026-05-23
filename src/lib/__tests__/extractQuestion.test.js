import { describe, it, expect } from 'vitest'
import { extractQuestion } from '../extractQuestion.js'

describe('extractQuestion', () => {
  it('returns the question as-is when the utterance is a single sentence', () => {
    expect(extractQuestion("what's around you?")).toBe("what's around you?")
  })

  it('returns only the question from a multi-sentence framing', () => {
    expect(extractQuestion("welcome. think of me as a musician. what's around you right now?")).toBe("what's around you right now?")
  })

  it('returns the LAST question when an utterance contains multiple', () => {
    expect(extractQuestion("is it warm? or is it cold right now?")).toBe("or is it cold right now?")
  })

  it('returns the question even when a non-question sentence follows it', () => {
    // The rule says: last sentence containing '?'. A trailing statement
    // after the question still returns the question.
    expect(extractQuestion("what about now? tell me.")).toBe("what about now?")
  })

  it('returns null when the utterance has no question mark', () => {
    expect(extractQuestion("mm.")).toBe(null)
    expect(extractQuestion("okay")).toBe(null)
    expect(extractQuestion("i'm going to play you a few pieces.")).toBe(null)
    expect(extractQuestion("it's coming.")).toBe(null)
  })

  it('handles edge inputs gracefully', () => {
    expect(extractQuestion(null)).toBe(null)
    expect(extractQuestion(undefined)).toBe(null)
    expect(extractQuestion('')).toBe(null)
    expect(extractQuestion(42)).toBe(null)
  })

  it('handles the welcome-style trailing question with an em-dash', () => {
    const welcome = "welcome. think of me as a musician who's come into the room. and to start — what's around you right now?"
    expect(extractQuestion(welcome)).toBe("and to start — what's around you right now?")
  })
})
