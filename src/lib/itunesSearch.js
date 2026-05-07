// Thin wrapper around the iTunes Search API.
// Public, CORS-friendly, no auth, ~20 req/min/IP rate limit.
// Used by the Autobio phase for typeahead song search.

const BASE_URL = 'https://itunes.apple.com/search'

export async function searchTracks(query, signal) {
  const trimmed = (query || '').trim()
  if (!trimmed) return []

  const url = `${BASE_URL}?term=${encodeURIComponent(trimmed)}&entity=song&limit=8`

  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new Error(`iTunes search failed: ${res.status}`)
  }
  const data = await res.json()
  return (data.results || []).map(r => ({
    title: r.trackName,
    artist: r.artistName,
    year: r.releaseDate ? Number(String(r.releaseDate).slice(0, 4)) : null,
    id: r.trackId,
    artworkUrl: r.artworkUrl60 || null,
  }))
}
