#!/usr/bin/env node
// scripts/update-admirer-agent.js
//
// PATCHes the existing Admirer agent on ElevenLabs with latency tunings.
// Re-run any time you want to adjust LLM / turn-detection / TTS settings
// without rebuilding the agent from scratch.
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

// Latency tunings. Each commit to this script should describe WHY a value
// changed, not just what it is. Defaults are listed for comparison.
const patch = {
  conversation_config: {
    agent: {
      prompt: {
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
      // Was: false. Speculative-turn lets the LLM start generating before
      // the user has fully stopped speaking; result is discarded if the
      // user keeps going. This is the single biggest perceived-latency
      // win for voice agents.
      speculative_turn: true,
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
console.log('Applied tunings:')
console.log('  llm:               gemini-2.5-flash → gemini-2.5-flash-lite')
console.log('  turn_timeout:      7.0 → 3.0')
console.log('  turn_eagerness:    normal → eager')
console.log('  speculative_turn:  false → true')
console.log('  tts.speed:         1.0 → 1.05')
console.log('')
console.log('No client-side changes needed. Hard-refresh the browser and test.')
