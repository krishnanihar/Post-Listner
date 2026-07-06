// The local-first session record (Ship-Blockers §3) + pure derivations over a
// records array. archive.js persists these; sessionStore.js reads them from a
// hydrated cache. No DOM, no storage here.

export const SCHEMA_VERSION = 1

export function makeSessionId(startedAt, rand = 0) {
  const r = Math.floor((Number.isFinite(rand) ? rand : 0) * 1e9).toString(36)
  return `${startedAt}-${r}`
}

function clampUnit(x) {
  return Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0))
}
function vec(v) {
  return { a: clampUnit(v?.a), v: clampUnit(v?.v), d: clampUnit(v?.d) }
}

export function buildSessionRecord({
  id, startedAt, endedAt, finalVector, avdTrajectory, landing, summary, rand,
} = {}) {
  const start = Number.isFinite(startedAt) ? startedAt : 0
  return {
    schemaVersion: SCHEMA_VERSION,
    id: id || makeSessionId(start, rand ?? 0),
    startedAt: start,
    endedAt: Number.isFinite(endedAt) ? endedAt : start,
    finalVector: vec(finalVector),
    avdTrajectory: Array.isArray(avdTrajectory)
      ? avdTrajectory.map((p) => ({ t: p.t | 0, a: clampUnit(p.a), v: clampUnit(p.v), d: clampUnit(p.d) }))
      : [],
    landing: landing && landing.archetypeId
      ? {
          archetypeId: landing.archetypeId,
          variationId: landing.variationId,
          // How the song was produced: 'catalog' (Demucs stems) or 'generated'
          // (per-session ElevenLabs track). Lets the record know its own source
          // even though the raw audio isn't persisted locally yet.
          mode: landing.mode === 'generated' ? 'generated' : 'catalog',
        }
      : null,
    summary: typeof summary === 'string' ? summary : '',
  }
}

export function isFirstSessionFrom(records) {
  return (records?.length || 0) === 0
}

export function recencySummaryFrom(records, now = 0) {
  if (!records || records.length === 0) return 'first time'
  const last = records[records.length - 1]
  const ageDays = (now - (last.startedAt || 0)) / 86400000
  if (ageDays < 1) return 'today'
  if (ageDays < 2) return 'yesterday'
  if (ageDays < 7) return 'a few days'
  if (ageDays < 21) return 'a few weeks'
  if (ageDays < 70) return 'a couple months'
  return 'a long time'
}

export function yearTierFrom(records, now = 0) {
  if (!records || records.length < 24) return 1
  const first = records[0]?.startedAt || 0
  const daysSinceFirst = (now - first) / 86400000
  return daysSinceFirst >= 180 ? 3 : 1
}
