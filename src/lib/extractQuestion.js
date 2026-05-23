// Pure: extract the last question sentence from an agent utterance.
// Returns the single sentence containing '?' that ends the most-recent
// question-like clause, or null if the utterance has no '?'.
//
// Used by QuestionDisplay to render only the part of the Admirer's
// turn that the user is meant to respond to — multi-sentence framings
// like "welcome. think of me as a musician... what's around you?" collapse
// to just "what's around you?".

export function extractQuestion(text) {
  if (!text || typeof text !== 'string') return null
  if (!text.includes('?')) return null
  // Split into sentences keeping terminators. A sentence is a run of
  // non-terminator chars followed by one or more of . ! ? (handles "!?")
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  // Walk from end, return the last sentence containing '?' (trimmed).
  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i].trim()
    if (s.includes('?')) return s
  }
  return null
}
