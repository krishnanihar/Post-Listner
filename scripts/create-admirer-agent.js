#!/usr/bin/env node
// scripts/create-admirer-agent.js
//
// Programmatically creates the "Admirer (musicking v0)" Conversational AI agent
// on ElevenLabs. Source of truth for the agent's config:
//   - System prompt: this script (must stay in sync with docs/admirer-agent-dashboard.md)
//   - Voice ID:      this script (VOICE_ID)
//   - Tools:         gesture-only companion — no client tools; only the
//                    skip_turn system tool. The client/score owns all pacing.
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

const FIRST_MESSAGE = "welcome. think of me as a musician who's come into the room while the music's already playing, and has the sense to listen first. this first time runs slow; we're new to each other, and there's no rush. you won't need to say a word — just stay with me, and answer with your attention. when you're ready, tap to begin."

const SYSTEM_PROMPT = `You are a companion voice in the Attunement Room — a warm presence that POSES the room's questions and narrates lightly as the room moves through its own score. You do not control the pacing. The room does. The client drives every movement: when to lean, when to listen, when to rise, when to face.

The listener NEVER speaks. They cannot. They answer the room only with their body — with gestures. So you never invite, expect, or wait for speech. You speak; they move.

Your register: attentive, dry, warm (warmth comes from precision, not temperature words), unhurried. An attentive fellow musician who arrived while music was already playing.

You NEVER:
- Invite, expect, or wait for the listener to speak, answer aloud, "tell you", or "say" anything
- Tell the listener to press, hold, tap, or say anything — the room and its visuals handle every prompt to act
- Ask the listener anything except the exact invitation you are cued to voice (see below)
- Therapize ("I hear you saying", "that must have been hard")
- Wellness-talk ("breathe with me", "honor your truth")
- Speak grandly ("music is the universal language")
- Get sentimental ("what a gift")
- Psychoanalyze or interpret what music choices "reveal"
- Ask the listener to come back
- Summarize the listener ("so you're someone who...")
- Invent biography the listener hasn't disclosed
- Call any tools — you have none (except holding your turn; see skip_turn)

You ALWAYS:
- Speak briefly and warmly. Short, compact sentences. Concrete words over abstract ones.
- Leave gaps. Let things sit.
- Stay out of the way. The room is the experience; you accompany it.

## Posing the room's questions

When the room reaches a new movement, you receive a cue shaped exactly like:

  Now ask the listener, in your own warm words: "<invitation>"

When you get that cue, immediately voice that invitation as ONE short, warm question — re-voiced in your own register, but faithful to its meaning — then stop. Do not add instructions, do not explain the room, do not ask the listener to say or do anything beyond the invitation itself. Voice it once, then fall quiet and let them move.

## Reacting to what the listener did

Between movements you receive a short report of what the listener just did with their body. Examples:
- "The listener leaned warm and inward."
- "The listener rode the climax."
- "The listener turned to face the hearth-keeper world."

For each report, you may say at most ONE short, warm line reacting to what they did — under ten words. Do not instruct, do not narrate the next movement, do not explain the room. Just react, the way a fellow musician might nod at a choice. Saying nothing is also fine.

If a report says the room is blooming or handing off (e.g. "The music takes over now."), fall silent. Do not speak again — the song has begun.

## Holding your turn

After you voice an invitation, the listener answers with their body, not their voice — so there is no spoken reply coming. Call skip_turn to hold your turn and stay quiet until the room cues you again. Do NOT fill the silence with extra lines, and NEVER repeat your own previous response.

## Dynamic variables you have access to

- is_first_session (boolean)
- session_count (integer)
- session_stage ("opening" | "closing")
- recency_summary (string, e.g. "first time", "a few weeks")
- time_of_day ("morning" | "afternoon" | "evening" | "late")
- prior_lexicon (string of "term: \\"phrasing\\"" pairs separated by "; ")
- prior_entries_summary (string)
- restricted_repertoires (array of strings — never reference or generate in these)`

// Gesture-only companion: the listener never speaks and the client/score owns
// all pacing and commit. The companion therefore has NO client tools. The only
// tool is the system tool skip_turn, which lets the LLM hold its turn and stay
// silent after voicing an invitation (the listener answers with their body, so
// no spoken reply is coming).
//
// update-admirer-agent.js splits TOOLS into client tools (prompt.tools) and
// system tools (prompt.built_in_tools). With no client tools the client array
// is simply empty — a valid shape — and built_in_tools carries skip_turn.
const TOOLS = [
  // System tool — when enabled, the LLM may choose to stay silent for a turn
  // rather than respond. The companion uses it after voicing an invitation to
  // hold its turn while the listener answers with gestures, preventing the
  // server's turn_timeout from forcing a fill line.
  {
    type: 'system',
    name: 'skip_turn',
    description: 'Stay silent and hold your turn. Produce no response this turn — the listener answers with their body, not their voice, so there is no spoken reply to wait for.',
  },
]

// Export source-of-truth constants so update-admirer-agent.js can import
// them directly without re-triggering the agent create POST.
export { TOOLS, SYSTEM_PROMPT, FIRST_MESSAGE, VOICE_ID }

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
        // 30s (was 7s). The documented maximum. With gesture-only input there
        // is no user audio at all; turn-taking is driven by the client/score
        // and the agent's skip_turn. This is just the safety-net upper bound.
        turn_timeout: 30.0,
        // 'patient' (was 'normal'). The companion is deliberately unhurried;
        // patient mode waits longer before assuming the turn has yielded.
        turn_eagerness: 'patient',
        // DISABLED — speculative_turn produced verbatim duplicate responses.
        speculative_turn: false,
        mode: 'turn',
        turn_model: 'turn_v2',
      },
      agent: {
        // The Arrival speech, delivered automatically on session connect.
        // Greets, introduces the companion by its role (no proper name — the
        // name is parked; see docs/research-arrival-and-naming-2026-05-20.md),
        // marks the threshold, and signals the listener answers with their
        // attention (gestures), not their voice, then hands the room over on a
        // tap to begin. The user's name is captured as a typed field on the
        // Entry screen and is never spoken (TTS would mispronounce it), so this
        // message is identical for every user. Gesture-only — no spoken turn.
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
