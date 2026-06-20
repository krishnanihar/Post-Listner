// src/lib/archetypeRing.js
// The Face movement: the six archetype centroids placed as a frontal ring the
// listener turns to face. Cold (low valence) on the left, warm on the right —
// consistent with the Lean mockup. nearestArchetypeToYaw maps the user's
// facing direction to a world; preloadDecision drives the speculative
// StemPlayer load during Rise. Pure — unit-tested.

import { ARCHETYPE_CENTROIDS, selectArchetypeByAvd } from './avdToStems.js'
import { MAX_AZIMUTH_OFFSET_DEG } from '../orchestra/AdmirerRoom.js'

const RING_HALF_WIDTH_DEG = MAX_AZIMUTH_OFFSET_DEG // 75 — matches the room's roll→azimuth limit

// [{ id, anchor:[a,v,d], azimuthDeg }] sorted cold→warm, spread -75..+75.
export function archetypeRing() {
  const byValence = [...ARCHETYPE_CENTROIDS].sort((a, b) => a.anchor[1] - b.anchor[1])
  const n = byValence.length
  const span = RING_HALF_WIDTH_DEG * 2
  return byValence.map((c, i) => ({
    id: c.id,
    anchor: c.anchor,
    azimuthDeg: n === 1 ? 0 : -RING_HALF_WIDTH_DEG + (span * i) / (n - 1),
  }))
}

// Archetype whose ring azimuth is nearest the (baseline-relative) facing yaw.
export function nearestArchetypeToYaw(relYawDeg, ring = archetypeRing()) {
  if (!ring.length) return null
  let best = ring[0]
  let bestDist = Infinity
  for (const r of ring) {
    const d = Math.abs(r.azimuthDeg - relYawDeg)
    if (d < bestDist) { best = r; bestDist = d }
  }
  return best.id
}

// Signed centroid {a,v,d} for an archetype id — used to snap the AVD vector
// toward the faced world on commit.
export function archetypeAnchorVector(id) {
  const c = ARCHETYPE_CENTROIDS.find((x) => x.id === id) || ARCHETYPE_CENTROIDS[0]
  return { a: c.anchor[0], v: c.anchor[1], d: c.anchor[2] }
}

// Should the speculative pre-load change archetype? `prev` is the currently
// loading/loaded archetype id (or null). Returns the nearest archetype to the
// in-progress vector and whether it differs from prev.
export function preloadDecision(prev, vector, { restricted = [] } = {}) {
  const archetypeId = selectArchetypeByAvd(vector, { restricted })
  return { archetypeId, changed: archetypeId !== prev }
}
