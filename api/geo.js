/**
 * api/geo — resolves the desktop's coarse location from Vercel's geolocation
 * request headers (spec §3.1).
 *
 * Coarsens server-side (rounds to the 1° grid — the same rule as
 * src/lib/geo.js coarsenLocation) so raw IP-precision coordinates never reach
 * the client. The coarsening is inlined rather than imported: api/ routes
 * can't import from src/ in Vercel without a build step (see api/admirer.js).
 *
 * Returns { region } — a "lat,lng" cell-centre string, or null when the
 * headers are absent (local dev) or unparseable.
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  const lat = Number(req.headers['x-vercel-ip-latitude'])
  const lng = Number(req.headers['x-vercel-ip-longitude'])
  const region =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `${Math.round(lat)},${Math.round(lng)}`
      : null
  res.statusCode = 200
  res.end(JSON.stringify({ region }))
}
