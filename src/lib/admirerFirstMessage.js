// Pure: returns the per-session opening line the Admirer agent should
// speak as its first utterance. Passed as conversation_initiation_data
// override (overrides.agent.firstMessage) at startSession time, so the
// static welcome baked into the agent on ElevenLabs only plays when no
// override is provided.
//
// Gesture-only input: the listener never speaks. The companion is a voice
// that welcomes and accompanies; the listener answers the room with their
// body (gestures) and a tap to begin. So the opening line invites no spoken
// answer and names no speak button — it just greets and hands the room over.
//
// First-time users get the threshold opening — it lands the tone, introduces
// the Admirer by role (no proper name), and signals the listener will respond
// with attention, not words, when they tap to begin.
//
// Returning users get a short recognition line driven by recencySummary
// and timeOfDay. The system prompt still branches further by is_first_session
// for the conversation that follows; this just changes the very first thing
// the voice says.

const FIRST_SESSION_MESSAGE = "welcome. think of me as a musician who's come into the room while the music's already playing, and has the sense to listen first. this first time runs slow; we're new to each other, and there's no rush. you won't need to say a word — just stay with me, and answer with your attention. when you're ready, tap to begin."

// Returning-user variants. Each is a small fragment that gets joined with
// the constant tail (a short re-welcome that invites no spoken answer).
const RECENCY_FRAGMENTS = {
  'today': "back already.",
  'yesterday': "yesterday, and again.",
  'a few days': "a few days. back.",
  'a few weeks': "a few weeks. you're back.",
  'a couple months': "a couple months. been a while.",
  'a long time': "a long time. you're back.",
}

const TIME_OF_DAY_TAIL = {
  'morning': "morning.",
  'afternoon': "afternoon.",
  'evening': "evening.",
  'late': "late tonight.",
}

const TAIL = "stay with me. tap to begin when you're ready."

export function buildFirstMessage({ isFirstSession, recencySummary, timeOfDay }) {
  if (isFirstSession) return FIRST_SESSION_MESSAGE

  const recencyLine = RECENCY_FRAGMENTS[recencySummary] || "you're back."
  const todLine = TIME_OF_DAY_TAIL[timeOfDay] || ''

  // Join: recency + (optional time-of-day) + tail.
  const parts = [recencyLine]
  if (todLine && timeOfDay === 'late') parts.push(todLine)
  parts.push(TAIL)
  return parts.join(' ')
}
