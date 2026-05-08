// Shared helpers for the /api/* serverless routes.
// Resolves the ElevenLabs API key from env (works in Vercel and local Vite dev).

export function getApiKey() {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) {
    throw new Error('ELEVENLABS_API_KEY not set. Add it to .env.local (no VITE_ prefix).')
  }
  return key
}

export async function readJsonBody(req) {
  // Vercel parses JSON for us when content-type is application/json; Vite's
  // raw http req is a Node IncomingMessage and needs manual parsing.
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf-8')
  return raw ? JSON.parse(raw) : {}
}

export function sendError(res, status, message) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: message }))
}
