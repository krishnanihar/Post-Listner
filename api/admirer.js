import { getApiKey, readJsonBody, sendError } from './_elevenlabs.js'

// Inline copy of the canonical register settings — kept in sync with
// src/lib/voiceRegister.js. The server can't import from src/ in Vercel
// without a build step, so the duplication is intentional.
const ADMIRER_VOICE_ID = 'NtS6nEHDYMQC9QczMQuq'
const REGISTER_SETTINGS = {
  caretaking: { stability: 0.4,  similarity_boost: 0.7, style: 0.6  },
  present:    { stability: 0.55, similarity_boost: 0.7, style: 0.4  },
  elevated:   { stability: 0.3,  similarity_boost: 0.7, style: 0.85 },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'method not allowed')
  }
  let body
  try { body = await readJsonBody(req) } catch (e) {
    return sendError(res, 400, 'invalid JSON body')
  }
  const text = (body.text || '').trim()
  const register = body.register || 'present'
  if (!text) {
    return sendError(res, 400, 'text is required')
  }

  const settings = REGISTER_SETTINGS[register] || REGISTER_SETTINGS.present
  let apiKey
  try { apiKey = getApiKey() } catch (e) {
    return sendError(res, 500, e.message)
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ADMIRER_VOICE_ID}`
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_v3',
      voice_settings: settings,
    }),
  })

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return sendError(res, upstream.status, `ElevenLabs TTS failed: ${errText.slice(0, 200)}`)
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.end(buf)
}
