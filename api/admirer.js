import { getApiKey, readJsonBody, sendError } from './_elevenlabs.js'
import { resolveLine } from './_admirerLines.js'

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

  // Lookup-by-id contract: client sends a lineId like "entry.threshold";
  // server resolves the actual text from its own copy of the script.
  // This prevents an attacker from spending ElevenLabs credits on
  // arbitrary text by hitting the deployed endpoint.
  const lineId = (body.lineId || '').trim()
  if (!lineId) {
    return sendError(res, 400, 'lineId is required')
  }
  const line = resolveLine(lineId)
  if (!line) {
    return sendError(res, 400, `unknown lineId: ${lineId}`)
  }

  const settings = REGISTER_SETTINGS[line.register] || REGISTER_SETTINGS.present
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
      text: line.text,
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
