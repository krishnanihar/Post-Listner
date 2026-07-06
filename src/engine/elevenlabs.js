// ElevenLabs generative-music client (music_v2, composition-plan aware).
//
// The API key stays server-side: this posts to the `/api/music` proxy
// (api/music.js), which adds ELEVENLABS_API_KEY and forwards to ElevenLabs.
// Returns an object-URL for the generated MP3 blob, ready for
// GenerativePlayer.load(ctx, url).
//
// Mock mode (VITE_MOCK_ELEVENLABS=true or VITE_MOCK_MUSIC=true) returns a silent
// WAV so the whole seam (generate → decode → band-split → handoff) can be
// exercised in dev/tests without spend. A silent buffer decodes fine; its RMS is
// ~0 so GenerativePlayer's normalization clamps to unity and it plays silence.

const MUSIC_PROXY_URL = '/api/music'
const SFX_API_URL = 'https://api.elevenlabs.io/v1/text-to-sound-effects'
const TIMEOUT_MS = 120000

const MOCK_MODE =
  import.meta.env.VITE_MOCK_ELEVENLABS === 'true' ||
  import.meta.env.VITE_MOCK_MUSIC === 'true'

// Model id is env-overridable so a music_v2 rollout / rename doesn't need a code
// change. Defaults to music_v2 (the current generative model per the brief).
export const MUSIC_MODEL_ID = import.meta.env.VITE_MUSIC_MODEL_ID || 'music_v2'

// Default generated-track length. ~3:30 generates in ~18s (spike: ~5s/audio-min),
// comfortably inside the Act-1 tail + Briefing (12s) + Bloom (24s) cover window.
export const DEFAULT_MUSIC_LENGTH_MS = 210000

function createSilentAudioUrl(durationSec = 30) {
  const sampleRate = 8000
  const numSamples = sampleRate * durationSec
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = numSamples * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)
  const blob = new Blob([buffer], { type: 'audio/wav' })
  return URL.createObjectURL(blob)
}

async function postForBlob(url, body, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`music proxy error ${response.status}: ${errText.slice(0, 300)}`)
    }
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Music generation timed out after ${timeoutMs / 1000}s`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Generate a track from either a composition plan (object) or a prose prompt
 * (string). Returns an object-URL for the MP3 blob.
 * @param {object|string} planOrPrompt
 * @param {{durationMs?:number}} [opts]
 */
export async function generateMusicTrack(planOrPrompt, { durationMs = DEFAULT_MUSIC_LENGTH_MS } = {}) {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 300))
    return createSilentAudioUrl(Math.round(durationMs / 1000))
  }
  const body = { model_id: MUSIC_MODEL_ID }
  if (planOrPrompt && typeof planOrPrompt === 'object') {
    body.composition_plan = planOrPrompt
    body.respect_sections_durations = true
  } else {
    body.prompt = String(planOrPrompt || '')
    body.music_length_ms = durationMs
    body.force_instrumental = true
  }
  return postForBlob(MUSIC_PROXY_URL, body)
}

// SFX utility (dev/offline asset generation). Direct client call — used by
// scripts and dev tools, not on the live per-session path.
export async function generateSoundEffect(text, durationSeconds = 2) {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 200))
    return createSilentAudioUrl(durationSeconds)
  }
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('VITE_ELEVENLABS_API_KEY is not set')
  const response = await fetch(SFX_API_URL, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: durationSeconds, prompt_influence: 0.8 }),
  })
  if (!response.ok) throw new Error(`SFX API error ${response.status}`)
  return URL.createObjectURL(await response.blob())
}
