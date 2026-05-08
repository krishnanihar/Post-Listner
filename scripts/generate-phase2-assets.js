#!/usr/bin/env node
/**
 * Generate the Phase 2 audio assets (3 GEMS excerpts + 18 Spectrum v2 clips)
 * via ElevenLabs Music API. Idempotent — skips files that already exist.
 *
 * Usage:
 *   npm run gen:phase2
 *
 * Requires VITE_ELEVENLABS_API_KEY in .env.local.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function getApiKey() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local not found.')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // Accept either VITE_-prefixed or non-prefixed
    if (trimmed.startsWith('VITE_ELEVENLABS_API_KEY=') ||
        trimmed.startsWith('ELEVENLABS_API_KEY=')) {
      return trimmed.split('=').slice(1).join('=').trim()
    }
  }
  console.error('ERROR: ELEVENLABS_API_KEY not found in .env.local')
  process.exit(1)
}

const API_KEY = getApiKey()

const ASSETS = [
  // GEMS — 15s instrumental excerpts
  {
    file: 'gems/sublimity.mp3',
    durationMs: 15000,
    prompt: 'neo-classical ambient, 50 BPM, felt piano, sustained string pad, choral wash, instrumental, breathless wonder, 2020s ECM-style sparse production with deep reverb tail, no percussion, no vocal melody, builds gently toward an unresolved suspension at 12s',
  },
  {
    file: 'gems/tenderness.mp3',
    durationMs: 15000,
    prompt: 'chamber folk, 65 BPM, fingerpicked nylon guitar, melodic cello, soft upright bass, instrumental, tender longing, 1970s warm tape-saturation, intimate close-mic\'d dynamics, single guitar line carries melody, room-tone breath between phrases',
  },
  {
    file: 'gems/tension.mp3',
    durationMs: 15000,
    prompt: 'post-rock instrumental, 80 BPM, distorted electric guitar with palm-muted restraint, brushed drums, low pulsing analog synth, instrumental, simmering defiance withheld, 2000s dry-room production with no compression on transients, crescendo never resolves, ends on a held minor-second cluster',
  },

  // Spectrum v2 — 8s instrumental clips
  { file: 'spectrum/v2/warm.mp3',         durationMs: 8000, prompt: 'acoustic chamber, 70 BPM, felt piano + cello, instrumental, body-warmth, 1970s tape saturation, no synthesizer, no electric instruments' },
  { file: 'spectrum/v2/cold.mp3',         durationMs: 8000, prompt: 'synth ambient, 70 BPM, sine pad + glassy bell, instrumental, cool sterile beauty, 1980s digital reverb, no acoustic instruments' },
  { file: 'spectrum/v2/dense.mp3',        durationMs: 8000, prompt: 'orchestral chamber, 70 BPM, layered strings + woodwinds + harp + felt piano, instrumental, complex polyphonic texture, full ensemble production' },
  { file: 'spectrum/v2/spare.mp3',        durationMs: 8000, prompt: 'solo piano, 70 BPM, single sustained note line, instrumental, radically minimal, dry-room close-mic, long silences between phrases' },
  { file: 'spectrum/v2/sung.mp3',         durationMs: 8000, prompt: 'chamber pop, 70 BPM, soft humming melody + felt piano + acoustic bass, breathy lead vocal melody, intimate vocal-forward production' },
  { file: 'spectrum/v2/instrumental.mp3', durationMs: 8000, prompt: 'chamber instrumental, 70 BPM, felt piano + acoustic bass + soft cello, instrumental, no vocals, melodic instrumental focus' },
  { file: 'spectrum/v2/analog.mp3',       durationMs: 8000, prompt: 'lo-fi indie, 70 BPM, tube-saturated electric guitar + upright bass, instrumental, 1960s tape warmth, hum + tape hiss audible, no digital reverb' },
  { file: 'spectrum/v2/digital.mp3',      durationMs: 8000, prompt: 'clean electronic, 70 BPM, FM synth lead + sub bass, instrumental, pristine digital production, surgical reverb tails, no analog warmth' },
  { file: 'spectrum/v2/major.mp3',        durationMs: 8000, prompt: 'acoustic folk, 70 BPM, fingerpicked guitar in C major, instrumental, bright open chords, uplifting harmonic motion' },
  { file: 'spectrum/v2/modal.mp3',        durationMs: 8000, prompt: 'chamber ambient, 70 BPM, felt piano in dorian mode, instrumental, neither happy nor sad, suspended ambiguous quality' },
  { file: 'spectrum/v2/slow.mp3',         durationMs: 8000, prompt: 'ambient drone, 50 BPM, sustained string pad + felt piano, instrumental, contemplative meditative pace, no rhythmic pulse' },
  { file: 'spectrum/v2/fast.mp3',         durationMs: 8000, prompt: 'walking groove, 110 BPM, felt piano + brushed snare + upright bass, instrumental, steady forward pulse, deliberate motion' },
  { file: 'spectrum/v2/driving.mp3',      durationMs: 8000, prompt: 'kraut rock, 130 BPM, motorik drums + repeating bass arpeggio, instrumental, locked-in propulsive forward motion, urgent energy' },
  { file: 'spectrum/v2/floating.mp3',     durationMs: 8000, prompt: 'ambient post-rock, 50 BPM, reversed guitar swells + sustained strings, instrumental, weightless suspended quality, no clear pulse' },
  { file: 'spectrum/v2/low.mp3',          durationMs: 8000, prompt: 'chamber, 70 BPM, double bass + bass clarinet + low felt piano, instrumental, deep register focus, dark sustained low frequencies' },
  { file: 'spectrum/v2/high.mp3',         durationMs: 8000, prompt: 'chamber, 70 BPM, glockenspiel + violin harmonics + flute, instrumental, bright high register focus, sparkling upper frequencies' },
  { file: 'spectrum/v2/reverberant.mp3',  durationMs: 8000, prompt: 'chamber, 70 BPM, felt piano + cello, instrumental, cathedral-sized hall reverb, long decaying tail, distant intimate playing' },
  { file: 'spectrum/v2/dry.mp3',          durationMs: 8000, prompt: 'chamber, 70 BPM, felt piano + cello, instrumental, dead-room close-mic\'d, no reverb, intimate fingertip detail audible' },
]

async function generateMusic(prompt, durationMs) {
  const url = 'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: durationMs,
      model_id: 'music_v1',
      force_instrumental: true,
    }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Music API failed: ${res.status} ${err.slice(0, 300)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  const publicDir = path.join(ROOT, 'public')
  let generated = 0
  let skipped = 0

  for (const asset of ASSETS) {
    const outPath = path.join(publicDir, asset.file)
    if (fs.existsSync(outPath)) {
      console.log(`SKIP  ${asset.file} (exists)`)
      skipped++
      continue
    }
    process.stdout.write(`GEN   ${asset.file} ... `)
    try {
      const buf = await generateMusic(asset.prompt, asset.durationMs)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, buf)
      console.log(`OK (${buf.length} bytes)`)
      generated++
    } catch (e) {
      console.log(`FAIL: ${e.message}`)
    }
    // Be a polite client — Music API has stricter rate limits than TTS.
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log(`\nDone. Generated ${generated}, skipped ${skipped} of ${ASSETS.length}.`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
