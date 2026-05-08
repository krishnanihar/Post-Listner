// Hierarchical knowledge-based archetype scoring (Burke 2002 cascade hybrid).
// Step 1: archetype via weighted Euclidean distance in AVD space + softmax. No stochasticity.
// Step 2: variation via era / texture density tie-breaking + ε-greedy (ε=0.12) for surprise.

import { ARCHETYPES } from './archetypes.js'
import { applyHedonicBias } from './hedonicBias.js'

const TEMPERATURE = 0.18  // softmax temperature — lower = sharper confidence
const EPSILON_VARIATION = 0.12

// Distance in AVD-weighted space: lower distance = higher fit.
function avdDistance(avd, weights) {
  const da = avd.a - weights.a
  const dv = avd.v - weights.v
  const dd = avd.d - weights.d
  return Math.sqrt(da * da + dv * dv + dd * dd)
}

// Internal: returns { archetypeId: softmaxScore } with all values summing to 1.
export function _archetypeScores(avd) {
  const distances = ARCHETYPES.map(a => ({
    id: a.id,
    distance: avdDistance(avd, a.scoringWeights),
  }))

  // Convert distance → score: -distance / temperature, then softmax.
  const logits = distances.map(d => -d.distance / TEMPERATURE)
  const maxLogit = Math.max(...logits)
  const exps = logits.map(l => Math.exp(l - maxLogit))
  const sumExp = exps.reduce((s, v) => s + v, 0)
  const result = {}
  distances.forEach((d, i) => {
    result[d.id] = exps[i] / sumExp
  })
  return result
}

function selectVariation(archetype, phaseData, rand = Math.random) {
  // ε-greedy: sometimes return a random variation for serendipity.
  if (rand() < EPSILON_VARIATION) {
    const idx = Math.floor(rand() * archetype.variations.length)
    return archetype.variations[idx]
  }

  // Prefer the autobio era median when present — the user's named songs are
  // a stronger era signal than the depth-density heuristic.
  const autobioMedian = phaseData.autobio?.eraSummary?.median
  if (typeof autobioMedian === 'number' && autobioMedian > 0) {
    const ranked = archetype.variations
      .map(v => ({ variation: v, score: -Math.abs(v.era - autobioMedian) }))
      .sort((a, b) => b.score - a.score)
    return ranked[0].variation
  }

  // Fall back to the depth-density heuristic from Phase 1.
  const depthNorm = Math.min(1, (phaseData.depth?.finalLayer || 1) / 8)
  const texCount = (phaseData.textures?.preferred || []).length

  const variationScores = archetype.variations.map(v => {
    const eraNorm = (v.era - 1960) / 70
    const eraFit = 1 - Math.abs(depthNorm - eraNorm)
    const textureFit = texCount / 8
    return { variation: v, score: eraFit * 0.7 + textureFit * 0.3 }
  })

  variationScores.sort((a, b) => b.score - a.score)
  return variationScores[0].variation
}

export function scoreArchetype(avd, phaseData, rand = Math.random) {
  const rawScores = _archetypeScores(avd)
  const scores = applyHedonicBias(rawScores, phaseData?.moment?.hedonic ?? null)
  let topId = null
  let topScore = -Infinity
  for (const [id, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score
      topId = id
    }
  }
  const archetype = ARCHETYPES.find(a => a.id === topId)
  const variation = selectVariation(archetype, phaseData, rand)

  return {
    archetypeId: topId,
    variationId: variation.id,
    confidence: topScore,
    scores,
  }
}
