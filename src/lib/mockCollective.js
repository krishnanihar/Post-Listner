/**
 * mockCollective — a deterministic mock "field" of collective lights for the
 * sky (spec §6.1). Slice 5 has no real collective; Slice 6 replaces this.
 *
 * Real geography does the emergent-clustering for free: ~35 world-metro
 * anchors, each spawning a small jittered cluster. Built once at module load
 * from a fixed seed, so the field is identical across renders and reloads.
 */
import { mulberry32 } from './mulberry32.js'

// [lat, lng] of ~35 world metros — the clustering anchors.
const METROS = [
  [40.7, -74.0], [34.0, -118.2], [41.9, -87.6], [19.4, -99.1], [-23.5, -46.6],
  [-34.6, -58.4], [51.5, -0.1], [48.9, 2.3], [40.4, -3.7], [52.5, 13.4],
  [55.8, 37.6], [41.0, 28.9], [30.0, 31.2], [6.5, 3.4], [-26.2, 28.0],
  [-1.3, 36.8], [19.1, 72.9], [28.6, 77.2], [13.1, 80.3], [23.8, 90.4],
  [13.8, 100.5], [-6.2, 106.8], [1.4, 103.8], [22.3, 114.2], [31.2, 121.5],
  [39.9, 116.4], [37.6, 127.0], [35.7, 139.7], [-33.9, 151.2], [-37.8, 144.9],
  [-36.8, 174.8], [49.3, -123.1], [43.7, -79.4], [25.8, -80.2], [59.3, 18.1],
]

const SEED = 0x5c01dfee
const BASE_PER_METRO = 14

/** Build the deterministic mock field — a flat array of { lat, lng }. */
export function buildMockCollective() {
  const rand = mulberry32(SEED)
  const points = []
  for (const [lat, lng] of METROS) {
    const n = BASE_PER_METRO + Math.floor(rand() * 8) // 14..21 per metro
    for (let i = 0; i < n; i++) {
      // sum-of-two-uniforms → a soft gaussian-ish spread around the anchor
      const dLat = (rand() + rand() - 1) * 3.5
      const dLng = (rand() + rand() - 1) * 3.5
      points.push({
        lat: Math.max(-85, Math.min(85, lat + dLat)),
        lng: ((lng + dLng + 540) % 360) - 180,
      })
    }
  }
  return points
}

export const MOCK_COLLECTIVE = buildMockCollective()
