#!/usr/bin/env node
// scripts/generate-footsteps.js
//
// Generates the Admirer's arrival footsteps via the ElevenLabs Sound
// Effects API. Writes ~3s of unhurried wood-floor footsteps to
// public/admirer/footsteps.mp3. Re-run to regenerate.
//
// Requires: ELEVENLABS_API_KEY in .env.local (server-side, no VITE_ prefix).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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
if (!API_KEY) {
  console.error('Missing ELEVENLABS_API_KEY in .env.local')
  process.exit(1)
}

const PROMPT = 'soft unhurried footsteps on a quiet wooden floor in a still room, walking calmly forward, low reverb, no music, no voice, no other sound, ambient room tone'
const DURATION_SEC = 3.0
const OUT_PATH = resolve(ROOT, 'public/admirer/footsteps.mp3')

console.log(`Generating ${DURATION_SEC}s of footsteps...`)

const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
  method: 'POST',
  headers: {
    'xi-api-key': API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'audio/mpeg',
  },
  body: JSON.stringify({
    text: PROMPT,
    duration_seconds: DURATION_SEC,
    prompt_influence: 0.6,
  }),
})

if (!res.ok) {
  console.error(`Generation failed: ${res.status} ${res.statusText}`)
  console.error(await res.text())
  process.exit(1)
}

const buf = Buffer.from(await res.arrayBuffer())
mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, buf)
console.log(`Wrote ${buf.length} bytes to ${OUT_PATH}`)
