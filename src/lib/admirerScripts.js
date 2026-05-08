// Admirer voice lines per phase. Sparse by design — silence is part of the
// rite. Per Research/voice-intimacy-admirer-design.md, the voice should
// confirm rather than narrate.

export const ADMIRER_LINES = {
  entry: {
    breathe:   { text: 'Breathe out with me. Slowly.', register: 'caretaking' },
    threshold: { text: 'For the next sixteen minutes you are not your inbox.', register: 'caretaking' },
  },
  spectrum: {
    intro:    { text: 'Lean toward the word that feels closer.', register: 'present' },
    midpairs: { text: "You're choosing the warmer ones — interesting.", register: 'present' },
  },
  depth: {
    intro: { text: "Stay until the room has the shape you want.", register: 'present' },
  },
  gems: {
    intro: { text: 'Tell me what you heard. Tap any that feel true.', register: 'present' },
    pivot: { text: "You let the sad ones land. Most people skip past them.", register: 'present' },
  },
  moment: {
    intro: { text: "A track will play. Move with it. Don't decide.", register: 'present' },
    after: { text: 'Did that feel good?', register: 'caretaking' },
  },
  autobio: {
    intro: { text: 'Three songs you carry. Take your time.', register: 'caretaking' },
    pivot: { text: 'Take your time. The wrong one would feel wrong.', register: 'caretaking' },
  },
  reflection: {
    open: { text: 'Here is what I heard.', register: 'caretaking' },
  },
}
