// Generate the 6 per-archetype Forer voiceovers via ElevenLabs v2.
// One MP3 per archetype, saved to public/archetypes/voice/{id}.mp3.
//
// Usage:
//   node scripts/generate-archetype-voices.js              (all six)
//   node scripts/generate-archetype-voices.js <id>         (just one)
//
// Reads ELEVENLABS_API_KEY from .env.local.
//
// Voice register: "elevated" per src/lib/voiceRegister.js — matches the
// project's research-derived choice for Reveal Forer paragraphs.
// Model: eleven_multilingual_v2 (stable, no first-word truncation bug).

import { config as dotenv } from 'dotenv'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(REPO_ROOT, 'public/archetypes/voice')

dotenv({ path: resolve(REPO_ROOT, '.env.local') })

const VOICE_ID = 'y1qhFrVEY0hUWrNMR216'
const MODEL_ID = 'eleven_multilingual_v2'

// Voice settings — adjusted for v2 stable narration per ElevenLabs docs:
//   - stability 0.40: docs say 35-40% for long passages, never below 30%
//   - similarity_boost 0.75: docs cap at ~75-80% to avoid artifacts
//   - style 0.55: medium (high style on v2 causes emotional pumping)
//   - speed 0.95: within 0.7-1.2 sweet spot, slight contemplative slow
//   - speaker_boost: improves consonant clarity without v2 artifacts
const VOICE_SETTINGS = {
  stability: 0.40,
  similarity_boost: 0.75,
  style: 0.55,
  speed: 0.95,
  use_speaker_boost: true,
}

const OUTPUT_FORMAT = 'mp3_44100_192'

// Scripts use ONLY natural punctuation for pauses (no SSML breaks). v2
// docs warn: "too many break tags can cause instability — speed up, noise,
// audio artifacts." Paragraph breaks give ~700-900ms, ellipsis ~500-700ms,
// em-dashes ~400-600ms — enough cadence without the artifact risk.
const SCRIPTS = {
  'late-night-architect':
`You like music that rewards a second listen.

You'll give a whole night to a song that earns it.

You keep your saddest songs for cab rides home...

There is a song you only listen to alone — and you don't know why.`,

  'hearth-keeper':
`You're drawn to music that arrives like a person sitting beside you.

You trust warmth more than spectacle.

There's a song you only play when no one else is in the house...

There is a song that belongs to a person you no longer speak to.`,

  'velvet-mystic':
`You hear architecture in music — height, light, the way a room holds sound.

You're moved by what other people find too quiet.

You collect songs the way other people collect rooms...

There is a song you have never told anyone you love.`,

  'quiet-insurgent':
`You're loyal to music that holds tension without resolving it.

You prefer the half-spoken thing to the chorus.

You have a song you've never put on a playlist for anyone...

There is a song you keep at the back of the queue on purpose.`,

  'slow-glow':
`You like music that takes its time and assumes you will too.

You hear groove as a kind of patience — not a kind of speed.

You play certain songs only after the room has gone warm...

There is a song that only sounds right after midnight.`,

  'sky-seeker':
`You're drawn to music that makes the ceiling feel higher.

You give yourself permission to be moved — most people don't.

There's a moment you keep waiting for in songs — and you know it when it arrives...

There is a song you have never listened to without something arriving in you.`,
}

const apiKey = process.env.ELEVENLABS_API_KEY
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY not set in .env.local')
  process.exit(1)
}

await mkdir(OUT_DIR, { recursive: true })

const target = process.argv[2]
const ids = target ? [target] : Object.keys(SCRIPTS)

if (target && !SCRIPTS[target]) {
  console.error(`Unknown archetype id: ${target}`)
  console.error(`Known: ${Object.keys(SCRIPTS).join(', ')}`)
  process.exit(1)
}

for (const id of ids) {
  const script = SCRIPTS[id]
  const outPath = resolve(OUT_DIR, `${id}.mp3`)
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${OUTPUT_FORMAT}`

  console.log(`→ ${id} (${script.length} chars)...`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: script,
      model_id: MODEL_ID,
      voice_settings: VOICE_SETTINGS,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error(`  ✗ ${id} failed [${res.status}]: ${errText.slice(0, 200)}`)
    process.exit(1)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(outPath, buf)
  const charsHeader = res.headers.get('character-cost') || res.headers.get('x-character-cost')
  console.log(`  ✓ ${id} (${(buf.length / 1024).toFixed(1)} KB${charsHeader ? `, ${charsHeader} chars` : ''})`)

  // Small breath between requests so we're polite to the rate limiter.
  if (ids.length > 1 && id !== ids[ids.length - 1]) {
    await new Promise(r => setTimeout(r, 800))
  }
}

console.log(`\nAll done. Files in ${OUT_DIR}`)
