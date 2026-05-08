// Deterministic 8-char hex hash for cache keys. Implements FNV-1a over the
// UTF-8 byte stream so unicode inputs are handled cleanly. Not cryptographic.

export function hashText(text) {
  const str = String(text ?? '')
  // FNV-1a 32-bit
  let hash = 0x811c9dc5
  // Encode UTF-8 manually so the hash matches across runtimes
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code < 0x80) {
      hash ^= code
      hash = Math.imul(hash, 0x01000193) >>> 0
    } else if (code < 0x800) {
      hash ^= (0xc0 | (code >> 6))
      hash = Math.imul(hash, 0x01000193) >>> 0
      hash ^= (0x80 | (code & 0x3f))
      hash = Math.imul(hash, 0x01000193) >>> 0
    } else {
      hash ^= (0xe0 | (code >> 12))
      hash = Math.imul(hash, 0x01000193) >>> 0
      hash ^= (0x80 | ((code >> 6) & 0x3f))
      hash = Math.imul(hash, 0x01000193) >>> 0
      hash ^= (0x80 | (code & 0x3f))
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
