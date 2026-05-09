// Stems catalog — pre-recorded Suno V5.5 masters, Demucs-stemmed offline.
//
// One entry per (archetype, variation) pair covering all 24 combinations from
// src/lib/archetypes.js. Each entry resolves to four stem URLs in Demucs's
// canonical channel order: vocals, drums, bass, other.
//
// For PostListener's instrumental masters the "vocals" stem will contain
// whatever lead melodic content Demucs classified into that channel
// (typically lead synth/piano). It is still placed at the front-center
// "vocal" position in the Orchestra spatial graph — that role is structural,
// not literal.
//
// Asset hosting:
//   - Production:  Cloudflare R2, base URL set via VITE_STEMS_BASE_URL
//   - Local dev:   `/stems/...` served from public/ (fallback default)
//
// File layout on disk / in the bucket:
//   {base}/{archetypeId}/{variationId}/{vocals|drums|bass|other}.mp3

import { ARCHETYPES } from './archetypes.js'

export const STEM_NAMES = ['vocals', 'drums', 'bass', 'other']

const DEFAULT_BASE = '/stems'

function getBase() {
  const fromEnv = typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_STEMS_BASE_URL
    : null
  return (fromEnv || DEFAULT_BASE).replace(/\/$/, '')
}

// Build the canonical {vocals, drums, bass, other} URL set for one pair.
function stemUrls(archetypeId, variationId, base = getBase()) {
  const dir = `${base}/${archetypeId}/${variationId}`
  return {
    vocals: `${dir}/vocals.mp3`,
    drums:  `${dir}/drums.mp3`,
    bass:   `${dir}/bass.mp3`,
    other:  `${dir}/other.mp3`,
  }
}

// Lookup: returns { vocals, drums, bass, other } or null.
export function getStems(archetypeId, variationId) {
  const archetype = ARCHETYPES.find(a => a.id === archetypeId)
  if (!archetype) return null
  const variation = archetype.variations.find(v => v.id === variationId)
  if (!variation) return null
  return stemUrls(archetypeId, variationId)
}

// Fallback: archetype-only resolution when the variation can't be matched.
// Returns the first variation's stems for the given archetype.
export function getArchetypeStems(archetypeId) {
  const archetype = ARCHETYPES.find(a => a.id === archetypeId)
  if (!archetype) return null
  return stemUrls(archetypeId, archetype.variations[0].id)
}

// Static fallback: pre-existing single-track master for when the catalog
// has no entry yet (early dev) or stem fetch fails. Caller is responsible
// for handling the single-URL shape vs. the 4-stem shape.
export const STATIC_FALLBACK_TRACK = '/chamber/tracks/track-a.mp3'

// Per-archetype master URL — points at the single Suno-generated MP3.
// Used as the fallback for StemPlayer.load when the 4 separate stems
// aren't reachable. Base URL is env-driven (VITE_MASTERS_BASE_URL) so
// the same code runs against /public/music in dev or R2 in prod.
function getMastersBase() {
  const fromEnv = typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_MASTERS_BASE_URL
    : null
  return (fromEnv || '/music').replace(/\/$/, '')
}

export function getMasterUrl(archetypeId, variationId) {
  if (!archetypeId || !variationId) return STATIC_FALLBACK_TRACK
  return `${getMastersBase()}/${archetypeId}_${variationId}.mp3`
}

// Enumerate every (archetypeId, variationId) the runtime expects to find.
// Kept as a function so it stays in sync with ARCHETYPES additions.
export function listCatalogKeys() {
  const keys = []
  for (const a of ARCHETYPES) {
    for (const v of a.variations) {
      keys.push({ archetypeId: a.id, variationId: v.id })
    }
  }
  return keys
}

// Enumerate all stem URLs we expect to have on the CDN (96 = 24 × 4).
// Useful for preflight checks and for the upload script's manifest.
export function listAllStemPaths(base = getBase()) {
  const out = []
  for (const { archetypeId, variationId } of listCatalogKeys()) {
    const urls = stemUrls(archetypeId, variationId, base)
    for (const stem of STEM_NAMES) {
      out.push({ archetypeId, variationId, stem, url: urls[stem] })
    }
  }
  return out
}
