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

  // Spectrum v2 — 20s instrumental clips, polar pairs.
  // Each pair shares fixed-axis values (BPM, voice count, mood) and varies
  // ONLY on the active AVD axis to avoid corrupting the orthogonal scoring
  // design in src/lib/spectrumPairs.js.

  // warm/cold — Valence axis only. Both 80 BPM, 2-3 voices, contemplative.
  { file: 'spectrum/v2/warm.mp3', durationMs: 20000, prompt:
    'Acoustic chamber piece in C major, 80 BPM. Felt piano playing a tender unhurried melody, soft cello holding consonant suspended chords underneath. 1970s tape-saturated production with warm vinyl character. Close-mic\'d intimate dynamics, gentle acoustic reverb. Major-key, no dissonance, no synths, no electronic instruments. The piano breathes between phrases. Instrumental. Twenty seconds.' },
  { file: 'spectrum/v2/cold.mp3', durationMs: 20000, prompt:
    'Synthetic ambient piece in A minor, 80 BPM. FM sine pad sustaining a cold drone, glassy bell tones playing dissonant intervals over the top. 1980s digital production — sterile, clinical, metallic. Long cold digital reverb tail. Minor-key, suspended unresolved harmony, no acoustic instruments at all. The bell rings out into emptiness. Instrumental. Twenty seconds.' },

  // dense/spare — Depth axis only. Both 70 BPM, dorian, contemplative.
  { file: 'spectrum/v2/dense.mp3', durationMs: 20000, prompt:
    'Chamber orchestra in D dorian, 70 BPM. Six independent voices weaving in modal counterpoint: first violin, viola, cello, oboe, clarinet, harp, felt piano. Voices enter sequentially and overlap, building a complex polyphonic texture. Wide-stereo audiophile mix. Modal interchange, no clear lead instrument — every voice carries melody. Instrumental. Twenty seconds.' },
  { file: 'spectrum/v2/spare.mp3', durationMs: 20000, prompt:
    'Solo felt piano in D dorian, 70 BPM. A single sustained melodic line, three or four notes per phrase, with long breathing silences between phrases. Dry close-mic\'d room tone, you can hear the hammer felt and string resonance. No accompaniment, no chords beyond an occasional single sustained low note. Radically minimal. Instrumental. Twenty seconds.' },

  // sung/instrumental — vocal presence axis. Both 70 BPM, F major.
  // sung.mp3 needs vocals — forceInstrumental override below.
  { file: 'spectrum/v2/sung.mp3', durationMs: 20000, forceInstrumental: false, prompt:
    'Soft chamber pop in F major, 70 BPM. Breathy female lead vocal humming a wordless melodic line — no lyrics, just intimate vocal tone. Felt piano and acoustic bass underneath. Vocal-forward production, close-mic\'d, room-tone breath audible between phrases. The voice is the focus throughout. Has vocals. Twenty seconds.' },
  { file: 'spectrum/v2/instrumental.mp3', durationMs: 20000, prompt:
    'Chamber instrumental in F major, 70 BPM. Felt piano carrying the lead melody, acoustic bass holding the foundation, soft cello sustaining beneath. The piano is melodic and forward — it occupies the space a vocal would. No vocals, no humming, no choir, no human voice of any kind. Pure instrumental focus. Instrumental. Twenty seconds.' },

  // chamber/programmed — Depth axis (arrangement complexity). Both 70 BPM,
  // F major (mid V), same energy. Differ on number of voices + organic vs grid.
  { file: 'spectrum/v2/chamber.mp3', durationMs: 20000, prompt:
    'Chamber ensemble in F major, 70 BPM, instrumental. Six independent voices weaving in counterpoint: violin, viola, cello, oboe, clarinet, felt piano — all played by humans, each carrying distinct melodic material. Wide-stereo audiophile mix. Modal interchange, complex polyphonic texture. The arrangement breathes with human tempo and dynamic variation. Twenty seconds.' },
  { file: 'spectrum/v2/programmed.mp3', durationMs: 20000, prompt:
    'Electronic minimal in F major, 70 BPM, instrumental. Three-element arrangement: programmed kick on every quarter, sub-bass holding the root, sustained synth pad on the chord. No counterpoint, no melodic development, no live instruments. Every note quantized to the grid. Dry-room production, minimal reverb. Twenty seconds.' },

  // major/modal — Valence axis. Both 75 BPM, acoustic, similar density.
  { file: 'spectrum/v2/major.mp3', durationMs: 20000, prompt:
    'Acoustic folk in C major, 75 BPM. Fingerpicked steel-string guitar playing bright open chords (C, F, G, Am — major-key cadence) with uplifting harmonic motion. Sun-warmed and resolved. Each chord change feels like a release rather than a question. Soft brushed snare on backbeat. Instrumental. Twenty seconds.' },
  { file: 'spectrum/v2/modal.mp3', durationMs: 20000, prompt:
    'Chamber ambient in C phrygian, 75 BPM. Felt piano playing a phrygian melody (flat-2 against the tonic creating ancient unresolved tension), suspended chords that don\'t resolve. Neither happy nor sad — a held ambiguous modal quality, ancient and unsettled. Modal harmonic language throughout, no major-key cadences. Instrumental. Twenty seconds.' },

  // slow/fast — Arousal axis. Same V, similar D.
  { file: 'spectrum/v2/slow.mp3', durationMs: 20000, prompt:
    'Ambient drone, 55 BPM. Sustained string pad floating, felt piano playing one note every six seconds, deep contemplative pace. No rhythmic pulse at all — the music breathes rather than counts. Meditative, nearly motionless. Long held tones, gentle dynamics. Instrumental. Twenty seconds.' },
  { file: 'spectrum/v2/fast.mp3', durationMs: 20000, prompt:
    'Walking groove, 130 BPM. Felt piano and brushed snare driving forward with deliberate motion, upright bass pulsing on the downbeat, steady forward pulse, locked-in tempo. Energetic but controlled — every beat lands clearly. No drone, no sustained pads — only rhythmic forward movement. Instrumental. Twenty seconds.' },

  // driving/floating — Arousal axis (and a Depth nudge).
  { file: 'spectrum/v2/driving.mp3', durationMs: 20000, prompt:
    'Kraut rock, 140 BPM. Motorik drums (insistent 8th-note kick, locked snare on 2 and 4), repeating bass arpeggio cycling, urgent forward propulsion. Locked-in groove, no rubato, no dynamic variation — pure forward motion. Like a train you can\'t stop. Instrumental. Twenty seconds.' },
  { file: 'spectrum/v2/floating.mp3', durationMs: 20000, prompt:
    'Ambient post-rock, 55 BPM. Reversed guitar swells washing in and out, sustained string drones underneath, no clear pulse or downbeat. Weightless, suspended, time-dilated. The listener can\'t tell where the beat is — there isn\'t one. Long reverb tails, dreamy and unanchored. Instrumental. Twenty seconds.' },

  // hi-fi/lo-fi — Depth axis (production aesthetic). Same instrumentation,
  // same 70 BPM, same F major; differ ONLY on production polish.
  { file: 'spectrum/v2/hi-fi.mp3', durationMs: 20000, prompt:
    'Acoustic chamber in F major, 70 BPM, instrumental. Felt piano, cello, and soft brushed snare. Pristine high-resolution recording, wide-stereo audiophile mix, every detail audible — string resonance, hammer felt, performer breath. Reference-grade mastering with extended dynamic range. Production polish is the focus. Twenty seconds.' },
  { file: 'spectrum/v2/lo-fi.mp3', durationMs: 20000, prompt:
    'Lo-fi bedroom recording in F major, 70 BPM, instrumental. Felt piano, cello, and soft brushed snare. Heavy tape hiss, degraded fidelity, audible noise floor and tape hum. Casual room-tone recording, no mastering polish. Performance feels intimate and slightly imperfect. Production is intentionally raw. Twenty seconds.' },

  // reverberant/dry — production-space axis. Same 70 BPM, same instruments.
  { file: 'spectrum/v2/reverberant.mp3', durationMs: 20000, prompt:
    'Chamber, 70 BPM. Felt piano and cello playing a slow contemplative line in a cathedral-sized hall. Long decaying reverb tail (4-6 seconds per note), distant intimate playing — the listener feels they\'re seated across the cathedral from the performers. Each note rings out before settling. Instrumental. Twenty seconds.' },
  { file: 'spectrum/v2/dry.mp3', durationMs: 20000, prompt:
    'Chamber, 70 BPM. Felt piano and cello, dead-room close-mic\'d. No reverb whatsoever — anechoic. Intimate fingertip detail audible: hammer felt on strings, bow-on-string friction, performer breath. The performers feel inches from the listener. Instrumental. Twenty seconds.' },
]

async function generateMusic(prompt, durationMs, forceInstrumental = true) {
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
      force_instrumental: forceInstrumental,
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
      const buf = await generateMusic(asset.prompt, asset.durationMs, asset.forceInstrumental ?? true)
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
