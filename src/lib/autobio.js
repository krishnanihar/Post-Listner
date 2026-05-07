// Pure shape helpers for the autobiographical module.
// Phase 2 collects 3 Rathbone "I am..." prompts; this module validates entries
// and summarizes them into a shape the Mirror + Reflection screens can render.

import { detectEraCluster } from './era.js'

export function validateSong(entry) {
  if (!entry || typeof entry !== 'object') {
    return { valid: false, reason: 'no entry' }
  }
  const title = (entry.title || '').trim()
  if (!title) {
    return { valid: false, reason: 'no title' }
  }
  return { valid: true, reason: null }
}

export function summarizeAutobio(songs) {
  const valid = (songs || []).filter(s => validateSong(s).valid)
  const years = valid.map(s => s.year).filter(y => typeof y === 'number' && y > 0)
  return {
    songs: valid,
    eraSummary: detectEraCluster(years),
  }
}
