// In-memory store for the CURRENT session's reflection surface — the
// transcript lines and the lexicon words the user has given. NOT persisted
// (sessionStore.js handles cross-session state). A tiny subscribable store
// so React can read it via useSyncExternalStore.

let state = { transcript: [], lexicon: [] }
const listeners = new Set()

function emit() {
  for (const listener of listeners) listener()
}

export function resetLiveSession() {
  state = { transcript: [], lexicon: [] }
  emit()
}

export function addTranscriptLine(role, text) {
  const t = (text || '').trim()
  if (!t) return
  state = { transcript: [...state.transcript, { role, text: t }], lexicon: state.lexicon }
  emit()
}

export function addLexiconWord(word) {
  const w = (word || '').trim()
  if (!w || state.lexicon.includes(w)) return
  state = { transcript: state.transcript, lexicon: [...state.lexicon, w] }
  emit()
}

export function getLiveSession() {
  return state
}

export function subscribeLiveSession(listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
