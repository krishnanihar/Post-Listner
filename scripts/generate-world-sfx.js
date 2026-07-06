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
    // The shipped 12s intro bed (public/intro/threshold.mp3). Id is
    // 'intro-threshold' so it does NOT collide with the §5 room-door cue also
    // named 'threshold' below — a bare `node generate-world-sfx.js threshold`
    // must not also regenerate this shipped asset.
    id: 'intro-threshold',
    text: 'a deep, warm cinematic threshold drone that slowly swells and rises with quiet anticipation, ' +
      'soft low resonance, distant airy shimmer, no melody, no percussion, a doorway about to open',
    path: 'public/intro/threshold.mp3',
    durationSeconds: 12,
    promptInfluence: 0.5,
    loop: false,
  },
]

// ── Nocturne diegetic SFX palette (design canon §5) ─────────────────────────
// The 13 room-sourced cues wired by src/world/worldSound.js. Every state change
// in the opera is a sound *from the room*, never a UI blip. Prompts are the
// generation-prompt seeds from the canon table (§5), verbatim. Outputs land at
// public/world/sfx/{id}.mp3. Runs through the same generate() path as CUES.
//
//   node scripts/generate-world-sfx.js                 # all cues (CUES + WORLD_SFX)
//   node scripts/generate-world-sfx.js lamp-up ember   # only the named ids
//
// Each entry: { id, prompt, durationSec } (canon shape). We normalise these
// into the generate() cue shape below (durationSec → durationSeconds, prompt →
// text, path → public/world/sfx/{id}.mp3), so the script stays runnable as-is.
const WORLD_SFX = [
  { id: 'threshold', prompt: 'a distant hall door opening onto a quiet room, soft reverberant air, no music', durationSec: 4 },
  { id: 'lamp-up', prompt: 'a warm practical lamp switching on, faint filament hum settling, intimate', durationSec: 3 },
  { id: 'page-write', prompt: 'a fountain pen writing one word on heavy paper, close and dry', durationSec: 2 },
  { id: 'seat', prompt: 'a single chair settling on a wooden stage, soft, distant', durationSec: 2 },
  { id: 'beat-commit-warm', prompt: 'a low felt mallet on a warm wooden resonator, one soft strike, long decay', durationSec: 3 },
  { id: 'beat-commit-deep', prompt: 'a muted double-bass pizzicato, deep and round, one note', durationSec: 3 },
  { id: 'pool-tip', prompt: 'cloth and air shifting as a light source moves, very soft, no tone', durationSec: 2 },
  { id: 'world-face', prompt: 'six faint struck wine glasses in a ring, barely audible, glassy', durationSec: 3 },
  { id: 'lamp-wide', prompt: 'a small room opening into a large hall, reverb tail lengthening, awe, no music', durationSec: 4 },
  { id: 'ember', prompt: 'a fire settling to embers, one soft collapse, warm', durationSec: 3 },
  { id: 'coda-settle', prompt: 'a page turning and settling flat on a desk, final, quiet', durationSec: 3 },
  { id: 'constellation-open', prompt: 'night air opening to a wide sky, faint distant wind, spacious', durationSec: 4 },
  { id: 'season-open', prompt: 'a heavy book opening, pages fanning once, library-quiet', durationSec: 3 },
]

// Normalise the canon-shaped WORLD_SFX entries into generate()'s cue shape and
// append them. `threshold` already exists as a CUES entry (the 12s intro bed at
// public/intro/threshold.mp3); the §5 `threshold` is the short 4s room-door cue
// at public/world/sfx/threshold.mp3 — distinct asset, distinct path, both kept.
for (const s of WORLD_SFX) {
  CUES.push({
    id: s.id,
    text: s.prompt,
    path: `public/world/sfx/${s.id}.mp3`,
    durationSeconds: s.durationSec,
    promptInfluence: 0.4,
    loop: false,
  })
}

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
