// Per-user state for the Admirer. Local-first: IndexedDB (archive.js) is the
// spine; this module is a SYNCHRONOUS façade over an in-memory cache hydrated
// from the archive at app start. Reads hit the cache; writes update the cache
// synchronously AND write through to the archive (fire-and-forget, tolerant of
// environments without IndexedDB — e.g. jsdom unit tests). Legacy localStorage
// data is imported into the archive once.

import {
  openArchive, getAllSessions, putSession, getMeta, putMeta, eraseAll,
} from './archive.js'
import {
  buildSessionRecord,
  isFirstSessionFrom,
  recencySummaryFrom,
  yearTierFrom,
} from './sessionRecord.js'

const LEGACY = {
  ENTRIES: 'musicking_entries',
  LEXICON: 'musicking_lexicon',
  RESTRICTED: 'musicking_restricted',
  USER_NAME: 'musicking_user_name',
  MIGRATED: 'musicking_migrated_to_idb',
}

let cache = { sessions: [], lexicon: {}, restricted: [], name: '' }

function writeThrough(fn) {
  Promise.resolve().then(fn).catch((e) => console.warn('[archive] write failed', e))
}

export async function hydrateSessionStore() {
  try {
    await openArchive()
    await maybeMigrateLegacy()
    cache = {
      sessions: await getAllSessions(),
      lexicon: (await getMeta('lexicon')) || {},
      restricted: (await getMeta('restricted')) || [],
      name: (await getMeta('name')) || '',
    }
  } catch (e) {
    console.warn('[archive] hydrate failed — running from empty cache', e)
  }
}

// Tolerant JSON parse — a malformed legacy value must not abort the whole
// migration (which would drop the other fields AND leave the MIGRATED flag
// unset, re-running every startup). Returns `fallback` on any parse failure.
function safeParse(raw, fallback) {
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function maybeMigrateLegacy() {
  try {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem(LEGACY.MIGRATED)) return
    const existing = await getAllSessions()
    if (existing.length === 0) {
      const entries = safeParse(localStorage.getItem(LEGACY.ENTRIES), [])
      const list = Array.isArray(entries) ? entries : []
      for (let i = 0; i < list.length; i++) {
        const e = list[i]
        // id must be unique even if two legacy entries share a ts — disambiguate by index.
        await putSession(buildSessionRecord({ id: `${e.ts || 0}-legacy-${i}`, startedAt: e.ts || 0, summary: e.summary || '' }))
      }
      const lex = safeParse(localStorage.getItem(LEGACY.LEXICON), {})
      const res = safeParse(localStorage.getItem(LEGACY.RESTRICTED), [])
      const nm = localStorage.getItem(LEGACY.USER_NAME) || ''
      if (lex && typeof lex === 'object') await putMeta('lexicon', lex)
      if (Array.isArray(res)) await putMeta('restricted', res)
      if (nm) await putMeta('name', nm)
    }
    localStorage.setItem(LEGACY.MIGRATED, '1')
  } catch (e) {
    console.warn('[archive] legacy migration skipped', e)
  }
}

export function getEntries() {
  return [...cache.sessions]
}

// Accepts a full SessionRecord (preferred) or a legacy { summary, ts }.
export function appendEntry(record) {
  const rec = record && record.schemaVersion
    ? record
    : buildSessionRecord({ startedAt: record?.ts ?? Date.now(), summary: record?.summary || '', rand: Math.random() })
  cache.sessions.push(rec)
  writeThrough(() => putSession(rec))
}

export function getIsFirstSession() {
  return isFirstSessionFrom(cache.sessions)
}

export function getLexicon() {
  return { ...cache.lexicon }
}

export function addLexicon(term, userPhrasing) {
  if (!term || !userPhrasing) return
  cache.lexicon = { ...cache.lexicon, [term]: userPhrasing }
  writeThrough(() => putMeta('lexicon', cache.lexicon))
}

export function getRestricted() {
  return [...cache.restricted]
}

export function addRestricted(repertoire) {
  if (!repertoire || cache.restricted.includes(repertoire)) return
  cache.restricted = [...cache.restricted, repertoire]
  writeThrough(() => putMeta('restricted', cache.restricted))
}

export function getUserName() {
  return cache.name || ''
}

export function setUserName(name) {
  const trimmed = (name || '').trim()
  if (!trimmed) return
  cache.name = trimmed
  writeThrough(() => putMeta('name', trimmed))
}

export function getRecencySummary(now = Date.now()) {
  return recencySummaryFrom(cache.sessions, now)
}

export function getYearTier(now = Date.now()) {
  return yearTierFrom(cache.sessions, now)
}

export function getTimeOfDay(now = new Date()) {
  const h = now.getHours()
  if (h < 5) return 'late'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 22) return 'evening'
  return 'late'
}

// Flat object passed to the agent as dynamicVariables — primitives only
// (arrays silently kill the ElevenLabs conversation). Reads the cache.
export function buildDynamicVariables() {
  const entries = cache.sessions
  return {
    is_first_session: entries.length === 0,
    session_count: entries.length,
    recency_summary: getRecencySummary(),
    time_of_day: getTimeOfDay(),
    prior_lexicon: Object.entries(cache.lexicon)
      .slice(-12)
      .map(([k, v]) => `${k}: "${v}"`)
      .join('; '),
    prior_entries_summary: entries.slice(-5).map((e) => e.summary).join(' | '),
    restricted_repertoires: cache.restricted.join(', '),
  }
}

// Reset everything — cache (sync) + archive (best-effort async) + legacy keys.
export function clearAll() {
  cache = { sessions: [], lexicon: {}, restricted: [], name: '' }
  writeThrough(() => eraseAll())
  try {
    if (typeof localStorage !== 'undefined') {
      for (const k of Object.values(LEGACY)) localStorage.removeItem(k)
    }
  } catch { /* ignore */ }
}
