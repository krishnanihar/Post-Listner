#!/usr/bin/env node
/* global process, Buffer */
// scripts/generate-admirer-voice.js
//
// Pre-generates the Admirer's spoken lines via the ElevenLabs Text-to-Speech
// API and writes them to public/admirer/voice/*.mp3. The Attunement Room (Act 1)
// is gesture-only with a finite set of authored lines, so the Admirer no longer
// needs the live Conversational AI agent — these pre-baked clips replace it.
//
// Voice: xzZRXG86mSM3naOyL9fa (the Admirer voice — source of truth: this file).
//
// Run with: node scripts/generate-admirer-voice.js
//   (optionally pass line ids to regenerate a subset:
//    node scripts/generate-admirer-voice.js welcome)
//
// Requires: ELEVENLABS_API_KEY in .env.local (server-side, no VITE_ prefix).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { allLines as reflectionLines } from '../src/lib/reflectionScript.js'

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

// ── voice + model config ─────────────────────────────────────────────────────
const VOICE_ID = 'xzZRXG86mSM3naOyL9fa'
const MODEL_ID = 'eleven_multilingual_v2'
// Warmth-by-precision, unhurried, present-not-assistant: high stability, low
// style exaggeration (per the research voice-tuning guidance).
const VOICE_SETTINGS = {
  stability: 0.55,
  similarity_boost: 0.8,
  style: 0.0,
  use_speaker_boost: true,
}

// ── the line bank ────────────────────────────────────────────────────────────
// id → text. The other authored lines (per-movement asks) get added here as
// the redesign proceeds.
const LINES = {
  // The full first-session welcome. Kept whole for backward-compat/rollback;
  // Admirer.jsx's arrival choreography plays the welcome-1/2/3 split below
  // instead, so this id is no longer on the critical path.
  welcome:
    "welcome to Post Listener. this is an instrument — but you don't play it with your hands. you play it by moving, by leaning toward what you want. it's yours to keep, and it learns a little more of you each time you come back. the first time runs slow, so — no rush. lean toward whatever's pulling at you.",
  // The welcome above, split at sentence boundaries into three paced
  // segments — same exact wording, just partitioned so Admirer.jsx can play
  // them in sequence with a breath + a slight room-widen between each,
  // rather than one ~25s monologue before any interaction. Concatenating
  // welcome-1 + ' ' + welcome-2 + ' ' + welcome-3 reproduces `welcome` above
  // verbatim.
  'welcome-1':
    "welcome to Post Listener. this is an instrument — but you don't play it with your hands. you play it by moving, by leaning toward what you want.",
  'welcome-2':
    "it's yours to keep, and it learns a little more of you each time you come back.",
  'welcome-3':
    "the first time runs slow, so — no rush. lean toward whatever's pulling at you.",
  // Returning-user opening (Admirer.jsx branches on getIsFirstSession()):
  // short, skips re-explaining the instrument, and lands on the same tail
  // phrase as welcome-3 so the on-screen leanLift cue still follows naturally.
  // PROPOSED COPY — flag for owner approval before generating.
  'welcome-return':
    "you're back. good — lean toward whatever's pulling at you.",
  // The end-of-Act-1 reflection: 12 gesture-mirror clips + 6 world readings.
  ...reflectionLines(),
}

const OUT_DIR = resolve(ROOT, 'public/admirer/voice')

async function generateLine(id, text, apiKey) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: VOICE_SETTINGS,
      }),
    },
  )
  if (!res.ok) {
    console.error(`[${id}] generation failed: ${res.status} ${res.statusText}`)
    console.error(await res.text())
    process.exit(1)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const outPath = resolve(OUT_DIR, `${id}.mp3`)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(outPath, buf)
  console.log(`[${id}] wrote ${buf.length} bytes → ${outPath}`)
}

const env = loadEnvLocal()
const API_KEY = env.ELEVENLABS_API_KEY
if (!API_KEY) {
  console.error('Missing ELEVENLABS_API_KEY in .env.local')
  process.exit(1)
}

// Optional CLI filter: only regenerate the named ids.
const only = process.argv.slice(2)
const ids = only.length ? only : Object.keys(LINES)

for (const id of ids) {
  const text = LINES[id]
  if (!text) {
    console.error(`Unknown line id: ${id}. Known ids: ${Object.keys(LINES).join(', ')}`)
    process.exit(1)
  }
  console.log(`[${id}] generating with voice ${VOICE_ID}...`)
  await generateLine(id, text, API_KEY)
}

console.log('Done.')
