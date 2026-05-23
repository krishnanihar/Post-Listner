#!/usr/bin/env node
// scripts/update-admirer-agent.js
//
// PATCHes the existing Admirer agent on ElevenLabs with the current
// system prompt and latency/turn-detection settings. The source-of-truth
// system prompt lives in scripts/create-admirer-agent.js; this script
// re-uses that text so the create and update paths can never drift.
//
// Re-run any time the brief or system prompt evolves.
//
// Run with: node scripts/update-admirer-agent.js
// Requires: ELEVENLABS_API_KEY in .env.local, VITE_ELEVENLABS_AGENT_ID set.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Import the source-of-truth constants directly. The create script has
// a main-guard, so importing it does NOT POST a new agent.
import { TOOLS, SYSTEM_PROMPT, FIRST_MESSAGE } from './create-admirer-agent.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

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

const env = loadEnvLocal()
const API_KEY = env.ELEVENLABS_API_KEY
const AGENT_ID = env.VITE_ELEVENLABS_AGENT_ID
if (!API_KEY) { console.error('Missing ELEVENLABS_API_KEY'); process.exit(1) }
if (!AGENT_ID) { console.error('Missing VITE_ELEVENLABS_AGENT_ID'); process.exit(1) }

// Split TOOLS into client tools (go into prompt.tools) and system tools
// (go into prompt.built_in_tools keyed by tool name). The ElevenLabs API
// stores them in separate structures — passing a system tool in the tools
// array is silently ignored.
const clientTools = TOOLS.filter(t => t.type === 'client')
const systemTools = TOOLS.filter(t => t.type === 'system')

// Build built_in_tools object: each system tool keyed by its name,
// with the shape the API requires ({ name: '<tool_name>' }).
const builtInTools = {}
for (const t of systemTools) {
  builtInTools[t.name] = { name: t.name }
}

// Patch payload. Each commit to this script should describe WHY a value
// changed, not just what it is. Defaults are listed for comparison.
const patch = {
  conversation_config: {
    agent: {
      // Was: "welcome." (1 word). Extended to the full threshold opening
      // so the Admirer's first utterance lands the tone, names the
      // push-to-talk affordance, and ends on the grand-tour question —
      // giving the user a clear thing to respond to instead of silence.
      first_message: FIRST_MESSAGE,
      prompt: {
        // Source-of-truth system prompt. Currently versioned by the
        // commit history of scripts/create-admirer-agent.js.
        prompt: SYSTEM_PROMPT,
        // Was: gemini-2.5-flash. Lite is materially faster for our prompt
        // size and the quality drop is invisible for a voice register that
        // already wants short, restrained replies.
        llm: 'gemini-2.5-flash-lite',
        // Client tools array imported from create-admirer-agent.js.
        tools: clientTools,
        // System tools (e.g. skip_turn) go into built_in_tools, not tools[].
        // The ElevenLabs API stores them under a separate key, keyed by name.
        built_in_tools: builtInTools,
      },
    },
    turn: {
      // See create-admirer-agent.js for full rationale.
      turn_timeout: 30.0,
      turn_eagerness: 'patient',
      speculative_turn: false,
      mode: 'turn',
      turn_model: 'turn_v2',
    },
    tts: {
      // Keep eleven_flash_v2 (already fastest). Slight speed bump makes
      // the cadence feel less drawn-out without sounding hurried.
      speed: 1.05,
    },
  },
}

const res = await fetch(
  `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
  {
    method: 'PATCH',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  }
)

const text = await res.text()
if (!res.ok) {
  console.error(`Update failed: ${res.status} ${res.statusText}`)
  console.error(text)
  process.exit(1)
}

console.log('Agent updated.')
console.log(`  first_message:     ${FIRST_MESSAGE.length} chars`)
console.log(`  system prompt:     ${SYSTEM_PROMPT.length} chars synced from create script`)
console.log('  llm:               gemini-2.5-flash-lite')
console.log(`  tools:             ${TOOLS.length} (${TOOLS.map(t => t.name).join(', ')})`)
console.log('  turn_timeout:      30.0')
console.log('  turn_eagerness:    patient')
console.log('  speculative_turn:  false  (was true; caused duplicate utterances)')
console.log('  tts.speed:         1.05')
console.log('')
console.log('No client-side changes needed. Hard-refresh the browser and test.')
