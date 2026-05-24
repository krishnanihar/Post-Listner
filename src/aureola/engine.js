// Aureola placement engine — pure functions, no React, no three.js.
// Implements the algorithm from AUREOLA-FRAMEWORK-V3.md §14.2, with the
// dynamic-equilibrium math from §6.4 and the symmetry tiebreaker from §8.
//
// Vocabulary:
//   placement = { id, archetype, house, theta, r, ring, weight, summonOrder }
//   activeObjects = array of placements currently on the canvas
//   bindu_world = figure center in R3F world coords ({x, y, z})
//   halfDiag = sqrt(planeW² + planeH²) / 2 in world units (mapping for r=1.0)

import {
  AUREOLA_V3,
  COLOR_TEMP_FACTOR,
  FIGURE_WEIGHT_PARAMS,
  OBJECT_DEFAULT_SAT_VALUE,
} from './config'

// ---------- house ↔ theta helpers ----------

export function houseToTheta(houseId, config = AUREOLA_V3) {
  const house = config.houses.find((h) => h.id === houseId)
  return house ? house.theta : 0
}

export function thetaToHouse(theta, config = AUREOLA_V3) {
  // Wrap theta to [0, 360) and find nearest house by angular distance
  const normalized = ((theta % 360) + 360) % 360
  let minDelta = Infinity
  let nearest = config.houses[0]
  for (const h of config.houses) {
    const raw = Math.abs(normalized - h.theta)
    const delta = Math.min(raw, 360 - raw)
    if (delta < minDelta) {
      minDelta = delta
      nearest = h
    }
  }
  return nearest.id
}

export function findMirrorHouse(houseId, pairs = AUREOLA_V3.symmetry.pairs) {
  for (const [a, b] of pairs) {
    if (a === houseId) return b
    if (b === houseId) return a
  }
  return null // axis-locked (houses 6, 12) or unpaired
}

// ---------- weight (§6.1, §6.2) ----------

// computeObjectWeight: per-object visual weight using §6.1's product.
// Uses sat/value defaults from OBJECT_DEFAULT_SAT_VALUE; opts can override.
export function computeObjectWeight(archetypeKey, ringConfig, opts = {}, config = AUREOLA_V3) {
  const arch = config.archetypes[archetypeKey]
  if (!arch) return 0
  const scale = ringConfig.scale * (opts.scaleOverride ?? 1)
  const saturation = opts.saturation ?? OBJECT_DEFAULT_SAT_VALUE.saturation
  const value = opts.value ?? OBJECT_DEFAULT_SAT_VALUE.value
  const intrinsicInterest = arch.weight
  const colorTemp = COLOR_TEMP_FACTOR[arch.color] ?? 1.0
  return scale * saturation * value * intrinsicInterest * colorTemp
}

// computeFigureWeight: §6.2 figure weight W_f, with the 1.2 figure bonus.
// Area param is calibrated in config so the ceiling allows ~3–5 medium objects.
export function computeFigureWeight(config = AUREOLA_V3) {
  return (
    FIGURE_WEIGHT_PARAMS.area
    * FIGURE_WEIGHT_PARAMS.saturation
    * FIGURE_WEIGHT_PARAMS.value
    * config.weight.figureBonus
  )
}

// ---------- net force / imbalance (§6.4) ----------

export function computeNetForces(activeObjects) {
  let F_x = 0
  let F_y = 0
  for (const o of activeObjects) {
    const thetaRad = (o.theta * Math.PI) / 180
    F_x += o.weight * o.r * Math.sin(thetaRad)
    F_y += o.weight * o.r * Math.cos(thetaRad)
  }
  return { F_x, F_y }
}

// imbalanceAfter: scalar imbalance if we add the candidate force to current forces
export function imbalanceAfter(F_x, F_y, W_new, r_new, theta_new_deg) {
  const thetaRad = (theta_new_deg * Math.PI) / 180
  const fx = F_x + W_new * r_new * Math.sin(thetaRad)
  const fy = F_y + W_new * r_new * Math.cos(thetaRad)
  return Math.sqrt(fx * fx + fy * fy)
}

// ---------- world-space mapping (§5.1) ----------

// polarToWorld: map (theta deg, r normalized) → world {x, y} around bindu.
// Y+ is "up" in R3F world space, which inverts the spec's image-coords formula.
export function polarToWorld(theta_deg, r, binduWorld, halfDiag) {
  const thetaRad = (theta_deg * Math.PI) / 180
  return {
    x: binduWorld.x + r * halfDiag * Math.sin(thetaRad),
    y: binduWorld.y + r * halfDiag * Math.cos(thetaRad),
  }
}

// ---------- axis / candidate enumeration ----------

// houseCandidates: which houses to consider for a given archetype.
// - If archetype has a locked house (Serpent=6, Wing pair=12, etc.), only that.
// - For multi-axis archetypes (Lotus/Flame/Sigil), sprint-1 picks the first axis.
//   Later sprints will use question affect to disambiguate.
export function houseCandidates(archetypeKey, config = AUREOLA_V3) {
  const arch = config.archetypes[archetypeKey]
  if (!arch) return []
  if (arch.house !== undefined) return [arch.house]
  const axisName = Array.isArray(arch.axis) ? arch.axis[0] : arch.axis
  const axis = config.axes[axisName]
  return axis ? axis.houses : []
}

// ---------- symmetry tiebreaker (§8) ----------

// bilateralBalance: how much placing a heavy archetype at `contenderHouse`
// would improve mirroring across the vertical axis vs existing heavies.
// Higher score = better symmetric pairing with current heavy objects.
export function bilateralBalance(contenderHouse, activeObjects, config = AUREOLA_V3) {
  let score = 0
  for (const obj of activeObjects) {
    if (!config.symmetry.heavyArchetypes.includes(obj.archetype)) continue
    const objHouse = thetaToHouse(obj.theta, config)
    const mirror = findMirrorHouse(objHouse, config.symmetry.pairs)
    if (mirror !== null && mirror === contenderHouse) score += 1
  }
  return score
}

// ---------- demotion (§6.3) ----------

// demoteOldest: remove the oldest object, preferring light archetypes first.
// Returns a NEW array; never mutates input.
export function demoteOldest(activeObjects, config = AUREOLA_V3) {
  if (activeObjects.length === 0) return activeObjects
  const sortedByAge = [...activeObjects].sort((a, b) => a.summonOrder - b.summonOrder)
  const oldestLight = sortedByAge.find((o) =>
    config.symmetry.lightArchetypes.includes(o.archetype),
  )
  const toRemove = oldestLight ?? sortedByAge[0]
  return activeObjects.filter((o) => o.id !== toRemove.id)
}

// ---------- summon (§14.2) ----------

function nextSummonId() {
  return `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// summon: the main entry point. Given an archetype key and current activeObjects,
// returns { active, placement, reason }. Pure: never mutates input.
//
// Returns:
//   { active, placement } on success — `active` is the updated array (possibly
//     with one demotion applied), `placement` is the new object.
//   { active, placement: null, reason } on failure (weight constraint can't
//     be relaxed via demotion).
export function summon(archetypeKey, activeObjects, config = AUREOLA_V3, _retries = 0) {
  const arch = config.archetypes[archetypeKey]
  if (!arch) return { active: activeObjects, placement: null, reason: 'unknown_archetype' }

  const ring = config.rings[arch.ring]
  if (!ring) return { active: activeObjects, placement: null, reason: 'unknown_ring' }

  const candidateHouses = houseCandidates(archetypeKey, config)
  if (candidateHouses.length === 0) {
    return { active: activeObjects, placement: null, reason: 'no_candidate_houses' }
  }

  const { F_x, F_y } = computeNetForces(activeObjects)

  // Enumerate (house, r ± 0.05) candidates, score by imbalance after placement
  const candidates = []
  for (const houseId of candidateHouses) {
    const theta = houseToTheta(houseId, config)
    const rOptions = [ring.r - 0.05, ring.r, ring.r + 0.05]
    for (const r of rOptions) {
      const W_new = computeObjectWeight(archetypeKey, { ...ring, r }, {}, config)
      const imbalance = imbalanceAfter(F_x, F_y, W_new, r, theta)
      candidates.push({ houseId, theta, r, imbalance, weight: W_new })
    }
  }

  candidates.sort((a, b) => a.imbalance - b.imbalance)
  const optimum = candidates[0].imbalance
  const epsilon = config.symmetry.tiebreakerEpsilon
  // Floor the ceiling at a small absolute tolerance so a clean 0 optimum doesn't
  // exclude every other candidate from the contender set.
  const ceiling = Math.max(optimum * (1 + epsilon), 1e-6)
  const contenders = candidates.filter((c) => c.imbalance <= ceiling + 1e-9)

  // Symmetry tiebreaker — only for heavy archetypes, only when multiple contenders tie
  let chosen
  if (config.symmetry.heavyArchetypes.includes(archetypeKey) && contenders.length > 1) {
    const scored = contenders.map((c) => ({
      ...c,
      symScore: bilateralBalance(c.houseId, activeObjects, config),
    }))
    scored.sort((a, b) => b.symScore - a.symScore || a.imbalance - b.imbalance)
    chosen = scored[0]
  } else {
    chosen = contenders[0]
  }

  // Arnheim weight constraint (§6.3): demote oldest if Σ + W_new would exceed W_f
  const W_f = computeFigureWeight(config)
  const totalAfter = activeObjects.reduce((s, o) => s + o.weight, 0) + chosen.weight
  if (totalAfter >= W_f) {
    if (_retries >= 5) {
      return { active: activeObjects, placement: null, reason: 'weight_full' }
    }
    const demoted = demoteOldest(activeObjects, config)
    if (demoted.length === activeObjects.length) {
      // Nothing more to demote — give up
      return { active: activeObjects, placement: null, reason: 'cannot_demote' }
    }
    return summon(archetypeKey, demoted, config, _retries + 1)
  }

  // Build the placement record
  const maxOrder = activeObjects.reduce((m, o) => Math.max(m, o.summonOrder), 0)
  const placement = {
    id: nextSummonId(),
    archetype: archetypeKey,
    house: chosen.houseId,
    theta: chosen.theta,
    r: chosen.r,
    ring: arch.ring,
    weight: chosen.weight,
    summonOrder: maxOrder + 1,
  }

  return {
    active: [...activeObjects, placement],
    placement,
  }
}
