// ElevenLabs Music Generation API wrapper

const MUSIC_API_URL = 'https://api.elevenlabs.io/v1/music'
const SFX_API_URL = 'https://api.elevenlabs.io/v1/text-to-sound-effects'
const TIMEOUT_MS = 120000 // 120 second ceiling (music API is slower than SFX)

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
  return fetchAudioBlob(SFX_API_URL, {
    text,
    duration_seconds: durationSeconds,
    prompt_influence: 0.8,
  }, 30000) // 30s timeout for short SFX
}
