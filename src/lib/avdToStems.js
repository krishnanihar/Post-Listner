// AVD vector → (archetypeId, variationId, stems, masterUrl). The committed
// signed AVD vector (Slice 1 spine) picks the archetype by nearest centroid;
// `era` (still from the agent's descriptors) picks the variation. Mirrors
// descriptorsToStems.js's bundle shape so it's a drop-in at startGeneration.
//
// The archetype centroids are the existing `scoringWeights` ({a,v,d} in [0,1])
// mapped into the signed [-1,1] spine. Slice 3 of the spec-integration program.

import { ARCHETYPES } from './archetypes.js'
import { selectScene } from './avdRuntime.js'
import { pickVariationByEra } from './descriptorsToStems.js'
import { getStems, getMasterUrl } from './stemsCatalog.js'

const toSigned = (x) => x * 2 - 1

// { id, anchor: [a, v, d] } per archetype, in signed [-1,1] space.
export const ARCHETYPE_CENTROIDS = ARCHETYPES.map((a) => ({
  id: a.id,
  anchor: [toSigned(a.scoringWeights.a), toSigned(a.scoringWeights.v), toSigned(a.scoringWeights.d)],
}))

// Nearest archetype centroid to `vector`, excluding restricted ids. One-shot
// pick (no hysteresis) — selectScene with currentId = null returns plain
// nearest. Falls back to the first archetype if every archetype is restricted.
export function selectArchetypeByAvd(vector, { restricted = [] } = {}) {
  const block = new Set(restricted)
  const eligible = ARCHETYPE_CENTROIDS.filter((c) => !block.has(c.id))
  if (eligible.length === 0) return ARCHETYPES[0].id
  return selectScene(vector, eligible, null)
}

// Full bundle: AVD → archetype, era → variation, then resolve R2 stem URLs.
export function mapAvdToStems(vector, { restricted = [], era } = {}) {
  const archetypeId = selectArchetypeByAvd(vector, { restricted })
  const archetype = ARCHETYPES.find((a) => a.id === archetypeId) || ARCHETYPES[0]
  const variation = pickVariationByEra(archetype, era)
  return {
    archetypeId: archetype.id,
    variationId: variation.id,
    stems: getStems(archetype.id, variation.id),
    masterUrl: getMasterUrl(archetype.id, variation.id),
  }
}
