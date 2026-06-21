// src/lib/eraSelection.js
// The era (a year) the listener picks via the iTunes search beat — it selects
// which VARIATION within the faced world plays (the 24 tracks differ only by
// era). A movement-stable module store, NOT liveRef (which resets every beat):
// the era is captured at the era beat and must survive into the bloom routing
// call. Reset at the start of each rite.
//
// IMPORTANT: era is a transient routing number ONLY. It is never written to the
// AVD vector (avdStore.commitTurn) — if it leaked in, it would drag the
// nearest-centroid archetype pick and break the face hard-snap match.

let era = null

export function setEra(year) {
  era = typeof year === 'number' && Number.isFinite(year) ? year : null
}

export function getEra() {
  return era
}

export function resetEra() {
  era = null
}
