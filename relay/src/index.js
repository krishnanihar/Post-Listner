// Entry Worker — upgrades incoming WS connections, routes them to the
// SessionRoom DO instance for the requested session ID. Origin check
// rejects connections from unexpected origins (localhost is allowlisted
// so dev works without any "is-production" branch).

export { SessionRoom } from './SessionRoom.js'

// Allowed origins for production AND dev. Localhost is intentionally
// included so `wrangler dev` flows + Vite dev server (5173/4173) work
// against this same Worker without special-casing environment. Any
// *.vercel.app HTTPS subdomain is also allowed so Vercel preview deploys
// (with their per-branch URLs) connect without manual allowlist edits.
const ALLOWED_ORIGINS = new Set([
  'https://post-listner.com',
  'http://localhost:5173',
  'https://localhost:5173',
  'http://localhost:4173',
  'https://localhost:4173',
])

function isAllowedOrigin(origin) {
  if (!origin) return true  // non-browser clients (wscat, curl) don't send Origin
  if (ALLOWED_ORIGINS.has(origin)) return true
  // Allow any Vercel deploy URL — production + previews
  try {
    const u = new URL(origin)
    if (u.protocol === 'https:' && u.hostname.endsWith('.vercel.app')) return true
  } catch { /* malformed Origin header */ }
  return false
}

// Crockford base32, no ambiguous chars (matches src/lib/sessionId.js)
const SESSION_ID_REGEX = /^[0-9A-HJ-NP-TV-Z]{8}$/

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Health check route (browser-pingable for debugging)
    if (url.pathname === '/healthz') {
      return new Response('ok', { status: 200 })
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    // Origin check — always enforced. A missing Origin header is treated
    // as allowed (non-browser WS clients like wscat don't always send one).
    const origin = request.headers.get('Origin')
    if (!isAllowedOrigin(origin)) {
      return new Response('Origin not allowed', { status: 403 })
    }

    const sessionId = url.searchParams.get('s')
    if (!sessionId || !SESSION_ID_REGEX.test(sessionId)) {
      return new Response('Missing or invalid session id', { status: 400 })
    }

    const role = url.searchParams.get('role')
    if (role !== 'conductor' && role !== 'viewer') {
      return new Response('Missing or invalid role', { status: 400 })
    }

    // Route to the DO instance for this session. idFromName + get is the
    // canonical DO namespace API — the same sessionId always hashes to the
    // same DO id, so all connections for a session land on the same instance
    // regardless of which edge POP received the request.
    const id = env.SESSION_ROOM.idFromName(sessionId)
    const stub = env.SESSION_ROOM.get(id)
    return stub.fetch(request)
  },
}
