// In-memory pub/sub for editorial release moments in the Admirer phase.
// BackgroundGlyph subscribes to this to drive its release ratio (0..1)
// without props-drilling through ReflectionSurface. ALL dispatches happen
// in Admirer.jsx — mount lifecycle, SDK callbacks (recordLexicon, fragment
// rating, startGeneration), and the transcript watcher for agent questions
// + user turns. BackgroundGlyph never calls fireMoment itself.
//
// fireMoment accepts an optional eventId. If the same eventId fires twice
// (dev-mode double-mount, retry on transient SDK glitch, etc.) the second
// call is a no-op. Calls WITHOUT an eventId are not de-duped — they're
// for legitimate repeats. resetMoments clears both the ratio AND the
// seen-id set so a fresh rite starts from zero.
//
// totalRelease is monotonic-up within a rite — it only goes back to zero
// when resetMoments() is explicitly called (Admirer's mount effect).

let totalRelease = 0
const listeners = new Set()
const seenEventIds = new Set()

export function fireMoment(amount, eventId) {
  if (eventId != null) {
    if (seenEventIds.has(eventId)) return
    seenEventIds.add(eventId)
  }
  totalRelease = Math.max(0, Math.min(1, totalRelease + amount))
  for (const l of listeners) l(totalRelease)
}

export function getCurrentRelease() {
  return totalRelease
}

// Returns an unsubscribe function. Subscribers receive the current value
// immediately on subscribe so callers don't need a separate initial read.
export function subscribeMoments(listener) {
  listeners.add(listener)
  listener(totalRelease)
  return () => listeners.delete(listener)
}

// Re-arm for a fresh rite. Clears both the running ratio AND the seen-id
// set so eventIds (e.g. 'mount') can fire again on the next session.
// Notifies all listeners so they reset their own derived state.
export function resetMoments() {
  totalRelease = 0
  seenEventIds.clear()
  for (const l of listeners) l(0)
}
