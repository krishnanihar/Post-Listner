#!/usr/bin/env node
/* global process, Buffer */
// scripts/spike-music-latency.js
//
// R1 LATENCY SPIKE (FABLE_REDESIGN_BRIEF.md) — measures ElevenLabs Music
// generation + stem-separation latency across track lengths, to decide whether
// per-session generative music is viable inside PostListener's unbroken
// Act1→Act2 seam (music must silent-load during Act 1 and continue into Act 2).
//
// Fires REAL, PAID ElevenLabs calls (~$0.15/min music + separation). Requires
// ELEVENLABS_API_KEY in .env.local. Usage: node scripts/spike-music-latency.js
// (override model: MUSIC_MODEL=music_v2 node scripts/spike-music-latency.js)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

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
const MODEL = process.env.MUSIC_MODEL || 'music_v1' // known-good default; override to try v2
const PROMPT =
  'a warm, unhurried instrumental — soft acoustic guitar, gentle room ambience, ' +
  'slow tempo, intimate and spacious, no vocals'

async function genMusic(lengthMs) {
  const body = { prompt: PROMPT, music_length_ms: lengthMs, force_instrumental: true, model_id: MODEL }
  const t0 = Date.now()
  const res = await fetch(MUSIC_URL, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const ms = Date.now() - t0
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${err.slice(0, 300)}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  return { ms, buf, contentType: res.headers.get('content-type') }
}

async function separateStems(buf, variation) {
  const form = new FormData()
  form.append('audio', new Blob([buf], { type: 'audio/mpeg' }), 'track.mp3')
  form.append('stem_variation_id', variation)
  const t0 = Date.now()
  const res = await fetch(STEMS_URL, { method: 'POST', headers: { 'xi-api-key': API_KEY }, body: form })
  const ms = Date.now() - t0
  const ok = res.ok
  return {
    ms, ok, status: res.status,
    ct: res.headers.get('content-type'),
    bytes: ok ? Buffer.from(await res.arrayBuffer()) : null,
    errText: ok ? null : await res.text().catch(() => ''),
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  console.log(`Model: ${MODEL}. Outputs → ${OUT}\n`)
  const lengths = [30000, 120000, 240000] // 30s (validate) · 2min · 4min (production)
  const results = []
  let track240 = null
  for (const len of lengths) {
    process.stdout.write(`gen ${len / 1000}s ... `)
    try {
      const r = await genMusic(len)
      writeFileSync(resolve(OUT, `gen-${len / 1000}s.mp3`), r.buf)
      console.log(`${(r.ms / 1000).toFixed(1)}s  (${(r.buf.length / 1024).toFixed(0)} KB, ${r.contentType})`)
      results.push({ len, ms: r.ms })
      if (len === 240000) track240 = r.buf
    } catch (e) {
      console.log('FAIL'); console.error('  ' + e.message)
      results.push({ len, error: e.message })
      if (len === 30000) { console.error('\nValidation call failed — aborting before spending on longer tracks.'); process.exit(1) }
    }
  }
  let sep = null
  if (track240) {
    process.stdout.write('separate-stems six_stems_v1 (4min) ... ')
    sep = await separateStems(track240, 'six_stems_v1')
    if (sep.ok) { writeFileSync(resolve(OUT, 'stems-response.bin'), sep.bytes); console.log(`${(sep.ms / 1000).toFixed(1)}s  (${sep.ct}, ${(sep.bytes.length / 1024).toFixed(0)} KB)`) }
    else console.log(`FAIL ${sep.status}: ${(sep.errText || '').slice(0, 200)}`)
  }
  console.log('\n=== SUMMARY (latency vs length) ===')
  for (const r of results) console.log(r.error ? `  ${r.len / 1000}s: ERROR` : `  ${r.len / 1000}s gen: ${(r.ms / 1000).toFixed(1)}s`)
  if (sep?.ok) console.log(`  separate-stems(4min): ${(sep.ms / 1000).toFixed(1)}s`)
  const g = results.find(r => r.len === 240000 && !r.error)
  if (g && sep?.ok) console.log(`\n  END-TO-END 4-min track: ${((g.ms + sep.ms) / 1000).toFixed(1)}s (gen ${(g.ms / 1000).toFixed(1)}s + separate ${(sep.ms / 1000).toFixed(1)}s)`)
  console.log('\nCompare against the seam budget (~Act-1 remainder + Briefing 12s + Bloom 24s).')
}
main().catch(e => { console.error(e); process.exit(1) })
