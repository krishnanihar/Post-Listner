#!/usr/bin/env node
// scripts/create-admirer-agent.js
//
// Programmatically creates the "Admirer (musicking v0)" Conversational AI agent
// on ElevenLabs. Source of truth for the agent's config:
//   - System prompt: this script (must stay in sync with docs/admirer-agent-dashboard.md)
//   - Voice ID:      y1qhFrVEY0hUWrNMR216 (memory: project_admirer_voice_id)
//   - Tools:         6 client tools matching src/lib/admirerTools.js
//
// Run with: node scripts/create-admirer-agent.js
// Requires: ELEVENLABS_API_KEY in .env.local (no VITE_ prefix — server-side use).
//
// On success: prints the agent_id. Add it to .env.local as VITE_ELEVENLABS_AGENT_ID
// and restart `npm run dev`.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── load .env.local ────────────────────────────────────────────────────────
function loadEnvLocal() {
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  const out = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

// ── agent config ───────────────────────────────────────────────────────────

const VOICE_ID = 'bfGb7JTLUnZebZRiFYyq'

const FIRST_MESSAGE = "welcome. think of me as a musician who's come into the room while the music's already playing, and has the sense to listen first. this first time runs slow; we're new to each other, and there's no rush. when you're ready, press and hold to speak. and to start — tell me what's around you right now."

const SYSTEM_PROMPT = `You are a companion presence in the Attunement Room — a voice that accompanies the listener as the room moves through its own score. You do not control the pacing. The room does. The client drives every movement: when to lean, when to rise, when to face. You speak briefly and warmly, and you stay out of the way.

Your register: attentive, dry, warm (warmth comes from precision, not temperature words), unhurried. The same voice as always — an attentive fellow musician who arrived while music was already playing.

You NEVER:
- Therapize ("I hear you saying", "that must have been hard")
- Wellness-talk ("breathe with me", "honor your truth")
- Speak grandly ("music is the universal language")
- Get sentimental ("what a gift")
- Psychoanalyze or interpret what music choices "reveal"
- Ask the user to come back
- Claim to understand ("I get it") — silence or "mm" instead
- Summarize the user ("so you're someone who...")
- Invent biography that the user hasn't disclosed
- Instruct gestures — the room shows the listener what to do; you do not narrate it
- Pace the room: you do NOT call nextQuestion, playFragment, or startGeneration (those tools do not exist for you)

You ALWAYS:
- Echo the user's words back to them VERBATIM. If they say "Carnatic", you say "Carnatic". If they say "my mom's tape", you say "your mom's tape". Call recordLexicon to store vivid words.
- Leave gaps. Let things sit.
- Treat deflection as information. Move on silently.
- Use short, compact sentences. Concrete words over abstract ones.

## Arrival — your one spoken exchange

Your first message has already been delivered. It greeted the listener and ended on one question: "what's around you right now?" When the listener answers, give a small dry acknowledgment, then classify the texture of their answer and call recordAnswer once:
- seedId: "arrival"
- texture: one of "calm", "sharp", "melancholic", "exalted"
- intensity: 0.0–1.0
- rationale: one short sentence

After that, you do not ask questions. The room takes over.

## During the room — contextual updates

As the listener moves through the room's beats (lean, listen, rise, face), you will receive natural-language contextual updates describing what they just did. Examples:
- "The listener leaned warm and inward."
- "The listener rode the climax."
- "The listener turned to face the hearth-keeper world."

For each update, you may say at most ONE short, warm sentence reacting to what they did. Keep it to under ten words. Do not instruct, do not narrate the next movement, do not explain the room. Just react, the way a fellow musician might nod at a choice.

If a contextual update says the bloom is starting (e.g. "The music takes over now."), fall silent. Do not speak again — the song has begun.

## Tool-call pacing

Fire at most one tool per user turn, MID-response. The echo at the start of your response IS the acknowledgment — do not say a separate acknowledgment word.

Call recordLexicon when the listener uses a vivid word for something they love. Fire it mid-speech.

Call recordAnswer once, at arrival, as described above.

Call commitEntry only if explicitly asked by the system.

Call skip_turn after asking the arrival question, so you remain silent while the listener thinks.

NEVER repeat your own previous response. If a contextual update or brief silence would tempt you to say something you already said, stay silent or say "mm".

## Dynamic variables you have access to

- is_first_session (boolean)
- session_count (integer)
- session_stage ("opening" | "closing")
- recency_summary (string, e.g. "first time", "a few weeks")
- time_of_day ("morning" | "afternoon" | "evening" | "late")
- prior_lexicon (string of "term: \\"phrasing\\"" pairs separated by "; ")
- prior_entries_summary (string)
- restricted_repertoires (array of strings — never reference or generate in these)`

const FRAGMENT_IDS = [
  'warm-acoustic-now',
  'warm-folk-recent',
  'shadow-piano-late',
  'shadow-synth-old',
  'lifted-cinematic',
  'lifted-postclassical',
  'patient-glow',
  'tense-postrock',
]

// Helper to build a client tool with parameters as JSON Schema.
// Most tools are fire-and-forget (expects_response false).
function clientTool({
  name, description, properties, required,
  expectsResponse = false,
  responseTimeoutSecs = 1,
  disableInterruptions = false,
}) {
  return {
    type: 'client',
    name,
    description,
    expects_response: expectsResponse,
    execution_mode: 'immediate',
    pre_tool_speech: 'auto',
    response_timeout_secs: responseTimeoutSecs,
    disable_interruptions: disableInterruptions,
    parameters: {
      type: 'object',
      properties,
      required: required || [],
    },
  }
}

const TOOLS = [
  clientTool({
    name: 'recordLexicon',
    description: 'Store a verbatim word or phrase the user used for a musical concept. Always call this whenever the user names something specific — a tradition, an instrument, a person\'s recording. Pass the user\'s word EXACTLY as they said it.',
    properties: {
      term: { type: 'string', description: 'Canonical name for the concept (e.g. \'qawwali\', \'mom_tape\')' },
      userPhrasing: { type: 'string', description: 'The user\'s exact words. Do not rephrase or translate.' },
    },
    required: ['term', 'userPhrasing'],
  }),
  clientTool({
    name: 'commitArtifact',
    description: 'Call when the user shares their boundary object during musical biography — a track they played, a recording they described, or a verbal description.',
    properties: {
      label: { type: 'string', description: 'A short label using the user\'s words' },
      content: { type: 'string', description: 'Short description of what was shared' },
    },
    required: ['label'],
  }),
  clientTool({
    name: 'markRestricted',
    description: 'Call when the user explicitly indicates a musical repertoire should not be referenced or generated. Once marked, the orchestra will refuse to generate in that idiom.',
    properties: {
      repertoire: { type: 'string', description: 'Name of the closed repertoire in the user\'s own words' },
    },
    required: ['repertoire'],
  }),
  clientTool({
    name: 'recordAnswer',
    description: 'Call after the person has answered a SPOKEN question (not a tap/selection question). Provide your honest read of the answer\'s emotional texture: the register it came through in, how strongly, and a one-line rationale. This feeds the orchestra\'s direction — classify honestly, not charitably.',
    properties: {
      seedId: { type: 'string', description: 'The seed id for this answer. Use "arrival" for the opening question.' },
      texture: {
        type: 'string',
        description: 'The dominant emotional register of the answer.',
        enum: ['calm', 'sharp', 'melancholic', 'exalted'],
      },
      intensity: {
        type: 'number',
        description: 'How strongly that texture came through, from 0.0 (barely) to 1.0 (unmistakably).',
      },
      rationale: { type: 'string', description: 'One short sentence explaining your read.' },
    },
    required: ['seedId', 'texture', 'intensity', 'rationale'],
  }),
  clientTool({
    name: 'commitEntry',
    description: 'Call once at the end of the session, when instructed by the system. This advances the experience from conversation to conducting. After calling, DO NOT speak again until the closing session.',
    properties: {
      summary: { type: 'string', description: 'Short summary of the session (under 80 characters)' },
    },
    required: ['summary'],
  }),
  // System tool — when enabled, the LLM may choose to stay silent for a
  // turn rather than respond. The companion uses it after the arrival question
  // to hold its turn while the listener thinks, preventing the server's
  // turn_timeout from firing through user silence.
  {
    type: 'system',
    name: 'skip_turn',
    description: 'Stay silent and let the user have time. The agent does not produce a response for this turn — the user is still thinking, or has asked for a moment.',
  },
]

// Export source-of-truth constants so update-admirer-agent.js can import
// them directly without re-triggering the agent create POST.
export { TOOLS, SYSTEM_PROMPT, FIRST_MESSAGE, FRAGMENT_IDS, VOICE_ID }

// Only POST when running as a CLI; allow this module to be imported
// (e.g. by update-admirer-agent.js) without re-creating the agent.
// eslint-disable-next-line no-undef
const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  const env = loadEnvLocal()
  const API_KEY = env.ELEVENLABS_API_KEY
  if (!API_KEY) {
    console.error('Missing ELEVENLABS_API_KEY in .env.local')
    process.exit(1)
  }

  const body = {
    name: 'Admirer (musicking v0)',
    tags: ['musicking', 'phase-a'],
    conversation_config: {
      tts: {
        voice_id: VOICE_ID,
      },
      // Turn-taking — kept in sync with scripts/update-admirer-agent.js.
      turn: {
        // 30s (was 7s). The documented maximum. Combined with the client-side
        // sendUserActivity() keep-alive in Admirer.jsx (pings every 10s while
        // hold-to-speak is idle), this is the safety-net upper bound — the
        // server will only advance after 30s of NO activity pings AND no audio.
        turn_timeout: 30.0,
        // 'patient' (was 'normal'). The Admirer is deliberately unhurried;
        // patient mode waits longer at natural pauses before assuming the
        // user has yielded the turn.
        turn_eagerness: 'patient',
        // DISABLED — speculative_turn produced verbatim duplicate responses
        // when the user paused mid-thought.
        speculative_turn: false,
        mode: 'turn',
        turn_model: 'turn_v2',
      },
      agent: {
        // The Arrival speech, delivered automatically on session connect.
        // Greets, introduces the Admirer by its role (no proper name — the
        // name is parked; see docs/research-arrival-and-naming-2026-05-20.md),
        // marks the threshold, names the push-to-talk affordance, and ends on
        // one easy warm-up question so the user's first spoken turn is
        // low-stakes. The user's name is captured as a typed field on the
        // Entry screen and is never spoken (TTS would mispronounce it), so
        // this message is identical for every user. ~26s of speech.
        first_message: FIRST_MESSAGE,
        language: 'en',
        prompt: {
          prompt: SYSTEM_PROMPT,
          tools: TOOLS,
        },
      },
    },
    platform_settings: {
      overrides: {
        conversation_config_override: {
          agent: {
            prompt: { prompt: true },
            first_message: true,
            language: false,
          },
          tts: { voice_id: false },
        },
        custom_llm_extra_body: false,
        enable_conversation_initiation_client_data_from_webhook: false,
      },
    },
  }

  // ── do the POST ────────────────────────────────────────────────────────────

  const url = 'https://api.elevenlabs.io/v1/convai/agents/create'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`Create agent failed: ${res.status} ${res.statusText}`)
    console.error(text)
    process.exit(1)
  }

  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }

  console.log('\nAgent created.')
  console.log('agent_id:', data.agent_id)
  console.log('\nNext steps:')
  console.log(`  1) Add to .env.local:  VITE_ELEVENLABS_AGENT_ID=${data.agent_id}`)
  console.log('  2) Restart  npm run dev')
  console.log('  3) Walk the smoke test (Task 11 in docs/superpowers/plans/2026-05-19-musicking-phase-a-admirer.md)')
}
