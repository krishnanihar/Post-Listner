#!/usr/bin/env node
/* global process, Buffer */
// scripts/generate-world-sfx.js
//
// Generates the world's ambient sound cues via the ElevenLabs Sound-Effects API
// and writes them to public/. Currently: the entry "threshold" bed — a cinematic
// low swell that builds anticipation under the intro (Entry was nearly silent, a
// bare 60 Hz drone; redesign area 3 wants the opening to build, not sit silent).
//
// Run with: node scripts/generate-world-sfx.js
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
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
  return out
}

const API_KEY = loadEnvLocal().ELEVENLABS_API_KEY
if (!API_KEY) { console.error('Missing ELEVENLABS_API_KEY in .env.local'); process.exit(1) }

const SFX_URL = 'https://api.elevenlabs.io/v1/sound-generation'

// id → { text, path, durationSeconds, promptInfluence, loop }
const CUES = [
  {
    id: 'threshold',
    text: 'a deep, warm cinematic threshold drone that slowly swells and rises with quiet anticipation, ' +
      'soft low resonance, distant airy shimmer, no melody, no percussion, a doorway about to open',
    path: 'public/intro/threshold.mp3',
    durationSeconds: 12,
    promptInfluence: 0.5,
    loop: false,
  },
]

async function generate(cue) {
  const res = await fetch(SFX_URL, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: cue.text,
      duration_seconds: cue.durationSeconds,
      prompt_influence: cue.promptInfluence,
      loop: !!cue.loop,
    }),
  })
  if (!res.ok) {
    console.error(`[${cue.id}] failed: ${res.status}`)
    console.error(await res.text())
    process.exit(1)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const outPath = resolve(ROOT, cue.path)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, buf)
  console.log(`[${cue.id}] wrote ${(buf.length / 1024).toFixed(0)} KB → ${cue.path}`)
}

const only = process.argv.slice(2)
const cues = only.length ? CUES.filter((c) => only.includes(c.id)) : CUES
for (const cue of cues) {
  console.log(`[${cue.id}] generating (${cue.durationSeconds}s)...`)
  await generate(cue)
}
console.log('Done.')
