// Generate the PostListener intro voice via ElevenLabs v3.
// One-shot script — saves to public/intro/voice.mp3.
//
// Usage:  node scripts/generate-intro-voice.js
// Reads ELEVENLABS_API_KEY from .env.local.

import { config as dotenv } from 'dotenv'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const OUT_PATH = resolve(REPO_ROOT, 'public/intro/voice.mp3')

dotenv({ path: resolve(REPO_ROOT, '.env.local') })

const VOICE_ID = 'y1qhFrVEY0hUWrNMR216' // custom intro voice
const MODEL_ID = 'eleven_multilingual_v2'

// Switched from v3 to multilingual_v2 because v3's first-word-truncation bug
// is reproducible on the ElevenLabs web UI itself. v2 is production-stable,
// supports SSML <break> for reliable pauses, and supports use_speaker_boost.
// Leading "..." kept as belt-and-suspenders cold-start absorber.
const SCRIPT = `... Welcome to PostListener.

<break time="1.5s" />

A self-portrait — in sound.

<break time="1.5s" />

You'll lean. You'll tap. You'll choose. Small things — songs you've kept, moments you almost forgot.

<break time="1.5s" />

Something is listening. <break time="0.6s" /> Not measuring. Listening.

<break time="1.5s" />

When you're done — it will play you back to yourself.

<break time="1.5s" />

Begin when you're ready.`

const OUTPUT_FORMAT = 'mp3_44100_192'

const VOICE_SETTINGS = {
  stability: 0.5,            // v2 sweet spot for narration
  similarity_boost: 0.75,
  style: 0.4,                // intimate, slight expressiveness
  speed: 0.95,               // contemplative pacing
  use_speaker_boost: true,   // sharpens consonants — helps "Welcome" land
}

const apiKey = process.env.ELEVENLABS_API_KEY
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY not set in .env.local')
  process.exit(1)
}

const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${OUTPUT_FORMAT}`

console.log(`→ requesting v3 synthesis (${SCRIPT.length} chars, format=${OUTPUT_FORMAT})...`)

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
    'Accept': OUTPUT_FORMAT.startsWith('wav') ? 'audio/wav' : 'audio/mpeg',
  },
  body: JSON.stringify({
    text: SCRIPT,
    model_id: MODEL_ID,
    voice_settings: VOICE_SETTINGS,
  }),
})

if (!res.ok) {
  const errText = await res.text().catch(() => '')
  console.error(`ElevenLabs error ${res.status}: ${errText}`)
  process.exit(1)
}

const buf = Buffer.from(await res.arrayBuffer())
await mkdir(dirname(OUT_PATH), { recursive: true })
await writeFile(OUT_PATH, buf)

const charsHeader = res.headers.get('x-character-count')
console.log(`✓ wrote ${OUT_PATH} (${(buf.length / 1024).toFixed(1)} KB${charsHeader ? `, ${charsHeader} chars billed` : ''})`)
