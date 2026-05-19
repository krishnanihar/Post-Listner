// Per-user state for the Admirer. localStorage in Phase A; IndexedDB later.
// All reads return safe defaults if storage is unavailable or empty.

const KEYS = {
  ENTRIES: 'musicking_entries',
  LEXICON: 'musicking_lexicon',
  RESTRICTED: 'musicking_restricted',
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

export function getEntries() {
  const e = readJson(KEYS.ENTRIES, [])
  return Array.isArray(e) ? e : []
}

export function appendEntry(entry) {
  const all = getEntries()
  all.push(entry)
  writeJson(KEYS.ENTRIES, all)
}

export function getIsFirstSession() {
  return getEntries().length === 0
}

export function getLexicon() {
  const l = readJson(KEYS.LEXICON, {})
  return (l && typeof l === 'object') ? l : {}
}

export function addLexicon(term, userPhrasing) {
  if (!term || !userPhrasing) return
  const l = getLexicon()
  l[term] = userPhrasing
  writeJson(KEYS.LEXICON, l)
}

export function getRestricted() {
  const r = readJson(KEYS.RESTRICTED, [])
  return Array.isArray(r) ? r : []
}

export function addRestricted(repertoire) {
  if (!repertoire) return
  const r = getRestricted()
  if (r.includes(repertoire)) return
  r.push(repertoire)
  writeJson(KEYS.RESTRICTED, r)
}

// Coarse human recency phrase from the most recent entry's timestamp.
// "first time" if no entries; otherwise rough buckets matching the brief.
export function getRecencySummary() {
  const entries = getEntries()
  if (entries.length === 0) return 'first time'
  const last = entries[entries.length - 1]
  const ageDays = (Date.now() - (last.ts || 0)) / 86400000
  if (ageDays < 1) return 'today'
  if (ageDays < 2) return 'yesterday'
  if (ageDays < 7) return 'a few days'
  if (ageDays < 21) return 'a few weeks'
  if (ageDays < 70) return 'a couple months'
  return 'a long time'
}

export function getTimeOfDay(now = new Date()) {
  const h = now.getHours()
  if (h < 5) return 'late'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 22) return 'evening'
  return 'late'
}

// Build the flat object passed to the agent as dynamicVariables.
// Keep keys exactly matching the brief Section X "Dynamic variables".
export function buildDynamicVariables() {
  const entries = getEntries()
  const lexiconObj = getLexicon()
  return {
    is_first_session: entries.length === 0,
    session_count: entries.length,
    recency_summary: getRecencySummary(),
    time_of_day: getTimeOfDay(),
    // Stringify lexicon as a CSV the agent can read verbatim. Keep small.
    prior_lexicon: Object.entries(lexiconObj)
      .slice(-12)
      .map(([k, v]) => `${k}: "${v}"`)
      .join('; '),
    prior_entries_summary: entries
      .slice(-5)
      .map(e => e.summary)
      .join(' | '),
    restricted_repertoires: getRestricted(),
  }
}

export function clearAll() {
  for (const k of Object.values(KEYS)) {
    try { localStorage.removeItem(k) } catch { /* ignore */ }
  }
}
