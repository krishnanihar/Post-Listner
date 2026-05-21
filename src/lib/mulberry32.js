/**
 * mulberry32 — a small, fast, deterministic seeded PRNG. Given an integer
 * seed it returns a function producing a repeatable 0..1 sequence. Used for
 * the journal's seeded procedural decoration: the entry-page watercolour
 * wash and the no-glyph procedural fallback mark.
 */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
