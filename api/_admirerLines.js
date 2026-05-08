// Server-side mirror of src/lib/admirerScripts.js. The Vite dev middleware
// can't import from src/ in production (Vercel builds api/ separately), so
// the lines are duplicated here. Update both when adding a new line.
//
// This file is the canonical source of truth for what /api/admirer is
// allowed to synthesize — the client sends a `lineId` and the server
// looks up the actual text. This prevents an attacker from POSTing
// arbitrary text to spend ElevenLabs credits.

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

// Resolve a lineId like "entry.threshold" to its { text, register } entry.
// Returns null for unknown ids (caller rejects with 400).
export function resolveLine(lineId) {
  if (typeof lineId !== 'string' || !lineId.includes('.')) return null
  const [phase, key] = lineId.split('.')
  const entry = ADMIRER_LINES[phase]?.[key]
  if (!entry) return null
  return entry
}
