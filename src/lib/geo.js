/**
 * geo — pure geographic helpers for the collective sky (spec §3.2).
 *
 * Location is coarsened to a 1° grid (~100 km cells) so a stored region never
 * carries finer-than-city precision. jitterInCell de-stacks co-located
 * entries visually without narrowing that coarsening — the offset stays
 * inside the cell.
 */
import { mulberry32 } from './mulberry32.js'
import { hashText } from './textHash.js'

/**
 * Snap a coordinate to the 1° grid and return its cell-centre as a "lat,lng"
 * string — the value stored in entries.region. null for non-finite input.
 */
export function coarsenLocation(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return `${Math.round(lat)},${Math.round(lng)}`
}

/** Parse a stored "lat,lng" region string back to { lat, lng }. null if malformed. */
export function regionToLatLng(region) {
  if (typeof region !== 'string') return null
  const parts = region.split(',')
  if (parts.length !== 2) return null
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/**
 * Deterministic per-entry jitter of up to ±0.45° around the region's cell
 * centre — keeps co-located entries from stacking. The offset stays inside
 * the 1° cell, so coarsening is preserved. null if the region is malformed.
 */
export function jitterInCell(region, seed) {
  const center = regionToLatLng(region)
  if (!center) return null
  const intSeed = parseInt(hashText(String(seed ?? '')), 16) >>> 0
  const rand = mulberry32(intSeed)
  const dLat = (rand() - 0.5) * 0.9 // ±0.45° — safely inside the cell
  const dLng = (rand() - 0.5) * 0.9
  return { lat: center.lat + dLat, lng: center.lng + dLng }
}
