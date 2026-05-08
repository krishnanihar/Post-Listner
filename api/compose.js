import { getApiKey, readJsonBody, sendError } from './_elevenlabs.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'method not allowed')
  }
  let body
  try { body = await readJsonBody(req) } catch (e) {
    return sendError(res, 400, 'invalid JSON body')
  }
  const plan = body.composition_plan
  if (!plan || !Array.isArray(plan.sections)) {
    return sendError(res, 400, 'composition_plan with sections[] required')
  }

  let apiKey
  try { apiKey = getApiKey() } catch (e) {
    return sendError(res, 500, e.message)
  }

  const url = 'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128'
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      composition_plan: plan,
      model_id: 'music_v1',
    }),
  })

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return sendError(res, upstream.status, `ElevenLabs Music failed: ${errText.slice(0, 300)}`)
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Cache-Control', 'private, no-store')  // per-session, don't cache
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.end(buf)
}
