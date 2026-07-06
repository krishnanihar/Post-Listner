#!/usr/bin/env node
/* global process, Buffer */
// scripts/spike-music-v2.mjs
//
// P0 CAPABILITY SPIKE for the generative redesign (FABLE PLAN §P0). Confirms the
// music_v2 model + composition-plan path works on THIS account and produces
// usable AVD-keyed tracks, and re-probes /music/separate-stems. Fires REAL, PAID
// ElevenLabs calls (~$0.15/audio-min ≈ ~$0.55/track). Requires ELEVENLABS_API_KEY.
//
// Usage:  node scripts/spike-music-v2.mjs
//         MODEL=music_v1 node scripts/spike-music-v2.mjs   (fallback model)
//         LEN_MS=120000  node scripts/spike-music-v2.mjs   (shorter, cheaper)
//
// Then LISTEN to tmp/music-spike/v2-*.mp3 — the go/no-go gate is musical quality
// and whether the 4-band split (run scripts/spike-band-split is a TODO) keeps
// each register distinct enough to conduct. This is a human-eared decision.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { buildPrompt } from '../src/lib/avdToPlan.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'tmp/music-spike')

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
if (!API_KEY) { console.error('No ELEVENLABS_API_KEY in .env.local'); process.exit(1) }

const MUSIC_URL = 'https://api.elevenlabs.io/v1/music'
const STEMS_URL = 'https://api.elevenlabs.io/v1/music/separate-stems'
const MODEL = process.env.MODEL || 'music_v2'
const LEN_MS = Number(process.env.LEN_MS || 210000)

// Three corners of the AVD space + a faced archetype + an era, exercising the
// real buildCompositionPlan the app uses at era-commit.
const CASES = [
  { key: 'calm-deep',    avd: { a: -0.6, v: 0.1, d: 0.7 },  archetypeId: 'late-night-architect', eraYear: 1985 },
  { key: 'bright-high',  avd: { a: 0.7, v: 0.7, d: 0.6 },   archetypeId: 'sky-seeker',           eraYear: 2015 },
  { key: 'melancholic',  avd: { a: -0.2, v: -0.7, d: 0.3 }, archetypeId: 'quiet-insurgent',      eraYear: 1995 },
]

// music_v2 generates from a PROMPT (it rejects composition_plan — verified
// 2026-07-06). This mirrors the runtime path (musicGen.startGenerativeTrack).
async function genFromPrompt(prompt) {
  const body = { prompt, music_length_ms: LEN_MS, force_instrumental: true, model_id: MODEL }
  const t0 = Date.now()
  const res = await fetch(MUSIC_URL, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const ms = Date.now() - t0
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${err.slice(0, 400)}`)
  }
  return { ms, buf: Buffer.from(await res.arrayBuffer()), ct: res.headers.get('content-type') }
}

async function probeSeparate(buf) {
  const form = new FormData()
  form.append('audio', new Blob([buf], { type: 'audio/mpeg' }), 'track.mp3')
  const res = await fetch(STEMS_URL, { method: 'POST', headers: { 'xi-api-key': API_KEY }, body: form })
  return { ok: res.ok, status: res.status, ct: res.headers.get('content-type'), err: res.ok ? null : (await res.text().catch(() => '')).slice(0, 200) }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  console.log(`Model: ${MODEL}  ·  length: ${LEN_MS / 1000}s  ·  out → ${OUT}\n`)
  let firstBuf = null
  for (const c of CASES) {
    const prompt = buildPrompt({ avd: c.avd, archetypeId: c.archetypeId, eraYear: c.eraYear })
    process.stdout.write(`gen ${c.key} (${c.archetypeId}) ... `)
    try {
      const r = await genFromPrompt(prompt)
      writeFileSync(resolve(OUT, `v2-${c.key}.mp3`), r.buf)
      console.log(`${(r.ms / 1000).toFixed(1)}s  (${(r.buf.length / 1024).toFixed(0)} KB, ${r.ct})`)
      if (!firstBuf) firstBuf = r.buf
    } catch (e) {
      console.log('FAIL'); console.error('  ' + e.message)
      if (c === CASES[0]) { console.error('\nFirst plan failed — aborting before spending on the rest.'); process.exit(1) }
    }
  }
  if (firstBuf) {
    process.stdout.write('\nprobe /music/separate-stems ... ')
    const s = await probeSeparate(firstBuf)
    console.log(s.ok ? `OK (${s.ct})` : `unavailable — ${s.status}: ${s.err}`)
    console.log(s.ok
      ? '  → real API stems exist: Rung-2 upgrade is possible (route them into StemPlayer).'
      : '  → no API stems: the client-side 4-band split (GenerativePlayer) is the path. Expected.')
  }
  console.log('\nNext: LISTEN to tmp/music-spike/v2-*.mp3. Quality is the go/no-go gate.')
}
main().catch((e) => { console.error(e); process.exit(1) })
