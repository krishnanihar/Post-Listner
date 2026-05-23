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
  const last = state.transcript[state.transcript.length - 1]
  // Agent-role dedupe: the ElevenLabs SDK fires onMessage for both
  // tentative and final agent transcripts; the tentative arrives first
  // and the final extends it. When the new line is a strict superset of
  // the previous agent line, replace in place so the visible transcript
  // tail shows the final wording, not a stack of partials. User-role
  // lines append unchanged (push-to-talk means they're committed
  // all-at-once anyway and a few partials are acceptable).
  if (role === 'agent' && last && last.role === 'agent' && t.startsWith(last.text)) {
    const updated = state.transcript.slice(0, -1).concat([{ role, text: t }])
    state = { transcript: updated, lexicon: state.lexicon }
  } else {
    state = { transcript: [...state.transcript, { role, text: t }], lexicon: state.lexicon }
  }
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
