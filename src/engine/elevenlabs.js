// ElevenLabs Music Generation API wrapper

const MUSIC_API_URL = 'https://api.elevenlabs.io/v1/music'
const SFX_API_URL = 'https://api.elevenlabs.io/v1/text-to-sound-effects'
const TIMEOUT_MS = 120000 // 120 second ceiling (music API is slower than SFX)

// Mock mode: set VITE_MOCK_ELEVENLABS=true in .env to skip API calls during testing
const MOCK_MODE = import.meta.env.VITE_MOCK_ELEVENLABS === 'true'

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
  // samples are already zeroed (silent)

  const blob = new Blob([buffer], { type: 'audio/wav' })
  return URL.createObjectURL(blob)
}

function getApiKey() {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('VITE_ELEVENLABS_API_KEY is not set')
  return apiKey
}

async function fetchAudioBlob(url, body, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': getApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      const message = errorBody?.detail?.message || errorBody?.detail || `status ${response.status}`
      const error = new Error(`ElevenLabs API error ${response.status}: ${message}`)
      error.detail = errorBody?.detail
      throw error
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)

  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Music generation timed out after ${timeoutMs / 1000} seconds`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function generateMusic(prompt, isRetry = false) {
  if (MOCK_MODE) {
    console.log('[ElevenLabs mock] generateMusic skipped — returning silent audio')
    await new Promise(r => setTimeout(r, 1500)) // simulate latency
    return createSilentAudioUrl(30)
  }
  try {
    return await fetchAudioBlob(MUSIC_API_URL, {
      prompt,
      music_length_ms: 30000,
      force_instrumental: true,
      model_id: 'music_v1',
    })
  } catch (err) {
    // Auto-retry with prompt suggestion on bad_prompt errors
    if (err.detail?.status === 'bad_prompt' && err.detail.prompt_suggestion && !isRetry) {
      return generateMusic(err.detail.prompt_suggestion, true)
    }
    throw err
  }
}

export async function generateMusicWithPlan(compositionPlan) {
  if (MOCK_MODE) {
    console.log('[ElevenLabs mock] generateMusicWithPlan skipped — returning silent audio')
    await new Promise(r => setTimeout(r, 1500))
    return createSilentAudioUrl(30)
  }
  try {
    return await fetchAudioBlob(MUSIC_API_URL, {
      composition_plan: compositionPlan,
      force_instrumental: true,
      model_id: 'music_v1',
    })
  } catch (err) {
    // Auto-retry with plan suggestion on bad_composition_plan errors
    if (err.detail?.status === 'bad_composition_plan' && err.detail.composition_plan_suggestion) {
      return fetchAudioBlob(MUSIC_API_URL, {
        composition_plan: err.detail.composition_plan_suggestion,
        force_instrumental: true,
        model_id: 'music_v1',
      })
    }
    throw err
  }
}

export async function generateSoundEffect(text, durationSeconds = 2) {
  if (MOCK_MODE) {
    console.log('[ElevenLabs mock] generateSoundEffect skipped — returning silent audio')
    await new Promise(r => setTimeout(r, 500))
    return createSilentAudioUrl(durationSeconds)
  }
  return fetchAudioBlob(SFX_API_URL, {
    text,
    duration_seconds: durationSeconds,
    prompt_influence: 0.8,
  }, 30000) // 30s timeout for short SFX
}
