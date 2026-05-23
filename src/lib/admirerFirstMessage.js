// Pure: returns the per-session opening line the Admirer agent should
// speak as its first utterance. Passed as conversation_initiation_data
// override (overrides.agent.firstMessage) at startSession time, so the
// static "welcome. this first time runs slow..." baked into the agent on
// ElevenLabs only plays when no override is provided.
//
// First-time users get the threshold opening verbatim — it lands the
// tone, introduces the Admirer by role (no proper name), names the
// push-to-talk affordance, and ends on the warm-up question.
//
// Returning users get a short recognition line driven by recencySummary
// and timeOfDay — no "welcome", no "this first time runs slow". The
// system prompt still branches further by is_first_session for the
// conversation that follows; this just changes the very first thing
// the voice says.

const FIRST_SESSION_MESSAGE = "welcome. think of me as a musician who's come into the room while the music's already playing, and has the sense to listen first. this first time runs slow; we're new to each other, and there's no rush. when you're ready, press and hold to speak. and to start — what's around you right now?"

// Returning-user variants. Each is a small fragment that gets joined with
// the constant tail (the push-to-talk reminder + an opener question that
// is shorter than the first-time grand-tour).
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

const TAIL = "press and hold to speak when you want. what's around you now?"

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
