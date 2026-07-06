/* global Buffer */
// POST /api/music — server-side ElevenLabs music-generation proxy.
//
// Keeps ELEVENLABS_API_KEY off the client. Accepts either a composition_plan or
// a prompt (+ music_length_ms), forwards to the ElevenLabs Music API, and
// streams the MP3 bytes back. Vercel: deployed as a serverless function (see the
// `config.maxDuration` below — generation can take ~20s). Local dev: mounted by
// vite.config.js's apiMiddleware via ssrLoadModule.

import { getApiKey, readJsonBody, sendError } from './_elevenlabs.js'

const MUSIC_URL = 'https://api.elevenlabs.io/v1/music'

// Generation is slow — request the longest window Vercel Hobby/Pro allows.
export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'POST only')

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return sendError(res, 400, 'invalid JSON body')
  }

  const elBody = { model_id: body.model_id || 'music_v2' }
  if (body.composition_plan) {
    elBody.composition_plan = body.composition_plan
    if (body.respect_sections_durations) elBody.respect_sections_durations = true
  } else if (body.prompt) {
    elBody.prompt = body.prompt
    elBody.music_length_ms = body.music_length_ms || 210000
    elBody.force_instrumental = body.force_instrumental !== false
  } else {
    return sendError(res, 400, 'provide composition_plan or prompt')
  }

  let apiKey
  try {
    apiKey = getApiKey()
  } catch (e) {
    return sendError(res, 500, e.message)
  }

  let upstream
  try {
    upstream = await fetch(MUSIC_URL, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(elBody),
    })
  } catch (e) {
    return sendError(res, 502, `upstream fetch failed: ${e.message}`)
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return sendError(res, upstream.status, errText.slice(0, 500) || 'music API error')
  }

  const arrayBuf = await upstream.arrayBuffer()
  res.statusCode = 200
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg')
  res.setHeader('Cache-Control', 'no-store')
  res.end(Buffer.from(arrayBuf))
}
