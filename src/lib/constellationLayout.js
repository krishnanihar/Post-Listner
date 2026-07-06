// Nocturne — the constellation (canon §6, Phase 4b). The Coda's optional third
// surface: the dark stage fills with anonymized taste-lights. The listener's own
// sessions glow warm-amber from the local archive; a mock collective is a dim,
// scattered haze. VIEW-ONLY, opt-in, streak-free (no dark patterns, Invariant 4)
// and NAMELESS (witness not measurement, Invariant 3) — a star is a position, no
// number or label is ever shown.
//
// Pure + deterministic (no Math.random / Date.now) so the same taste always
// lands in the same place — a person can recognize their own sky over months.
// Points are shaped {x, y, warmth, brightness, own} in normalized [0,1] screen
// space, ready to feed lightField sources or a direct canvas draw.
//
// Mapping (principled, not a scatter): a signed AVD vector (a,v,d ∈ [−1,1])
//   valence  → x   (left = darker-valenced, right = brighter)
//   arousal  → y   (top = high arousal, bottom = calm)
//   depth    → warmth + brightness (deeper listening = warmer, more inward glow)
// A small id-seeded jitter separates near-identical tastes so they don't stack.

export function normalizeAvd(input) {
  if (Array.isArray(input)) {
    return { a: num(input[0]), v: num(input[1]), d: num(input[2]) }
  }
  if (input && typeof input === 'object') {
    return {
      a: num(input.a != null ? input.a : input.arousal),
      v: num(input.v != null ? input.v : input.valence),
      d: num(input.d != null ? input.d : input.depth),
    }
  }
  return { a: 0, v: 0, d: 0 }
}

// A single star from an AVD vector + an optional string seed (session id) for
// jitter. Returns a normalized point; brightness/warmth from depth.
export function avdToStar(avd, seed = '') {
  const { a, v, d } = normalizeAvd(avd)
  const jitter = seededJitter(seed) // {jx, jy} in ~[-0.04, 0.04]
  const x = clamp01((v + 1) / 2 + jitter.jx)
  const y = clamp01(1 - (a + 1) / 2 + jitter.jy)
  const warmth = clamp01(0.4 + ((d + 1) / 2) * 0.5) // deeper → warmer (0.4..0.9)
  const brightness = clamp01(0.45 + ((d + 1) / 2) * 0.4)
  return { x, y, warmth, brightness }
}

// The listener's own constellation from archive session records. Accepts records
// carrying a finalVector / avd / [a,v,d]; newer sessions glow a touch brighter
// (recency, NOT a streak — purely a gentle "this is recent" read). `own: true`.
export function buildOwnConstellation(sessions = []) {
  const list = Array.isArray(sessions) ? sessions : []
  const n = list.length
  return list.map((rec, i) => {
    const avd = rec.finalVector || rec.avd || rec.vector || rec
    const seed = String(rec.id || rec.sessionId || rec.startedAt || i)
    const star = avdToStar(avd, seed)
    // Recency: the last few sessions read slightly brighter. Bounded, additive.
    const recency = n > 1 ? i / (n - 1) : 1
    return {
      ...star,
      brightness: clamp01(star.brightness * (0.75 + 0.25 * recency)),
      own: true,
    }
  })
}

// A mock collective haze — many dim, cool, scattered lights. Deterministic
// (seeded by index), so it's stable across renders and honest as a *mock*
// (labeled in-app + in the reel). Real anonymized data replaces this later.
export function buildMockCollective(count = 120, seedBase = 'collective') {
  const out = []
  const n = Math.max(0, Math.min(2000, count | 0))
  for (let i = 0; i < n; i++) {
    const h = hashStr(`${seedBase}:${i}`)
    const x = ((h & 0xffff) / 0xffff)
    const y = (((h >>> 16) & 0xffff) / 0xffff)
    const dim = 0.06 + ((h >>> 8) & 0x7) / 0x7 * 0.08 // 0.06..0.14
    out.push({ x: clamp01(x), y: clamp01(y), warmth: 0.35, brightness: dim, own: false })
  }
  return out
}

// Convenience: the full field for the Coda — own stars over the mock haze.
export function buildConstellation(sessions, mockCount = 120) {
  return {
    collective: buildMockCollective(mockCount),
    own: buildOwnConstellation(sessions),
  }
}

// ── seeded helpers (deterministic; no Math.random) ──────────────────────────
function seededJitter(seed) {
  const h = hashStr(String(seed))
  const jx = (((h & 0xffff) / 0xffff) - 0.5) * 0.08
  const jy = ((((h >>> 16) & 0xffff) / 0xffff) - 0.5) * 0.08
  return { jx, jy }
}

// FNV-1a 32-bit — same family as src/lib/textHash.js; inlined to keep this lib
// dependency-free.
function hashStr(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
function num(v) {
  if (!Number.isFinite(v)) return 0
  return v < -1 ? -1 : v > 1 ? 1 : v
}
function clamp01(v) {
  if (!Number.isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}
