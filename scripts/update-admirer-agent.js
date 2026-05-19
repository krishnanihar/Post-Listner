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

// Extract the SYSTEM_PROMPT from the create script so the two paths
// cannot drift. We don't import — that would re-trigger the create
// flow's side effects. The prompt is a backtick template literal that
// itself contains escaped backticks for words like `session_stage`,
// so we match lazily up to the next top-level declaration (the
// FRAGMENT_IDS constant) and unescape \` → ` afterward.
function loadSystemPrompt() {
  const src = readFileSync(resolve(__dirname, 'create-admirer-agent.js'), 'utf8')
  const m = src.match(/const SYSTEM_PROMPT = `([\s\S]*?)`\s*\n\s*const FRAGMENT_IDS/)
  if (!m) throw new Error('Could not find SYSTEM_PROMPT in create script')
  return m[1].replace(/\\`/g, '`')
}

const SYSTEM_PROMPT = loadSystemPrompt()

// Patch payload. Each commit to this script should describe WHY a value
// changed, not just what it is. Defaults are listed for comparison.
const patch = {
  conversation_config: {
    agent: {
      prompt: {
        // Source-of-truth system prompt. Currently versioned by the
        // commit history of scripts/create-admirer-agent.js.
        prompt: SYSTEM_PROMPT,
        // Was: gemini-2.5-flash. Lite is materially faster for our prompt
        // size and the quality drop is invisible for a voice register that
        // already wants short, restrained replies.
        llm: 'gemini-2.5-flash-lite',
      },
    },
    turn: {
      // Was: 7.0. The Admirer's brief explicitly tolerates user silence —
      // a shorter timeout makes the agent feel responsive after a beat
      // without cutting off a thinking user.
      turn_timeout: 3.0,
      // Was: "normal". Eager makes the agent commit to responding faster
      // once it has decided the user is done.
      turn_eagerness: 'eager',
      // DISABLED — speculative_turn produced verbatim duplicate responses
      // when the user paused mid-thought or went briefly silent ("..."
      // user turns triggered a second full agent response identical to
      // the previous one). The latency benefit isn't worth the doubling
      // for an intimate voice register that already tolerates 2-3s gaps.
      // Verified in conv_5901ks0y99eceetbgvtn35knpqaf (turns 06/10 and
      // 17/25 doubled).
      speculative_turn: false,
      // Keep existing
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
console.log(`  system prompt:     ${SYSTEM_PROMPT.length} chars synced from create script`)
console.log('  llm:               gemini-2.5-flash-lite')
console.log('  turn_timeout:      3.0')
console.log('  turn_eagerness:    eager')
console.log('  speculative_turn:  false  (was true; caused duplicate utterances)')
console.log('  tts.speed:         1.05')
console.log('')
console.log('No client-side changes needed. Hard-refresh the browser and test.')
