// Conversation descriptors → (archetypeId, variationId, stems, masterUrl).
//
// Phase A "fake generation": deterministic mapping into the 24 existing
// Suno tracks. Real generation is Phase D.
//
// Descriptor schema (all optional; missing fields fall through):
//   tempo:           'slow' | 'medium' | 'fast'
//   mood:            'warm' | 'shadowed' | 'lifted' | 'tense' | 'patient' | 'expansive'
//   era:             number (year, e.g. 1985)
//   instrumentation: 'acoustic' | 'synth' | 'orchestral' | 'ensemble' | 'electronic'
//   genre_hint:      free-form string (used only for tie-breaks)
//
// Options:
//   restricted:      string[] — archetype ids to avoid (refusal-to-know)

import { ARCHETYPES } from './archetypes.js'
import { getStems, getMasterUrl } from './stemsCatalog.js'

// Mood → archetype mapping. The archetypes were authored to span these.
const MOOD_TO_ARCHETYPE = {
  warm: 'hearth-keeper',
  shadowed: 'late-night-architect',
  lifted: 'sky-seeker',
  expansive: 'sky-seeker',
  tense: 'quiet-insurgent',
  patient: 'slow-glow',
}

// Default when nothing matches.
const DEFAULT_ARCHETYPE = 'hearth-keeper'

// Pick the variation whose `era` value is numerically closest to the requested era.
function pickVariationByEra(archetype, requestedEra) {
  const vs = archetype.variations
  if (!requestedEra || typeof requestedEra !== 'number') {
    return vs[0]
  }
  let best = vs[0]
  let bestDist = Math.abs((best.era || 2000) - requestedEra)
  for (const v of vs.slice(1)) {
    const dist = Math.abs((v.era || 2000) - requestedEra)
    if (dist < bestDist) {
      best = v
      bestDist = dist
    }
  }
  return best
}

export function mapDescriptorsToStems(descriptors = {}, opts = {}) {
  const restricted = new Set(opts.restricted || [])

  // Pick archetype from mood, falling back to default if mood missing/unknown.
  let archetypeId = MOOD_TO_ARCHETYPE[descriptors.mood] || DEFAULT_ARCHETYPE
  if (restricted.has(archetypeId)) {
    // Walk the archetype list deterministically until we find one not restricted.
    archetypeId = ARCHETYPES
      .map(a => a.id)
      .find(id => !restricted.has(id)) || DEFAULT_ARCHETYPE
  }

  const archetype = ARCHETYPES.find(a => a.id === archetypeId) || ARCHETYPES[0]
  const variation = pickVariationByEra(archetype, descriptors.era)

  return {
    archetypeId: archetype.id,
    variationId: variation.id,
    stems: getStems(archetype.id, variation.id),
    masterUrl: getMasterUrl(archetype.id, variation.id),
  }
}
