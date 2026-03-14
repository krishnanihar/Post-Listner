// ElevenLabs Sound Generation API wrapper

const API_URL = 'https://api.elevenlabs.io/v1/sound-generation'
const TIMEOUT_MS = 60000 // 60 second ceiling

export async function generateMusic(prompt) {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY

  if (!apiKey) {
    throw new Error('VITE_ELEVENLABS_API_KEY is not set')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: 30,
        prompt_influence: 0.5,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error')
      throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`)
    }

    // Response is raw audio bytes (mp3)
    const blob = await response.blob()
    const audioUrl = URL.createObjectURL(blob)
    return audioUrl

  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Music generation timed out after 60 seconds')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
