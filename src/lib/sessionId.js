// Session ID — short, URL-safe, QR-friendly identifier for pairing a phone
// with one or more desktop viewers.
//
// Format: 8 characters, Crockford base32 alphabet (no ambiguous I L O U).
// 8 chars * 5 bits = 40 bits of entropy ≈ 1 trillion combinations. Collision
// probability is negligible at our scale (single-digit thousands of concurrent
// sessions at most). Generated client-side; the Durable Object accepts any
// well-formed ID and lazily creates a SessionRoom for it on first connection.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'   // 32 chars, omits I L O U
const ID_LENGTH = 8
const ID_REGEX = new RegExp(`^[${ALPHABET}]{${ID_LENGTH}}$`)

export function generateSessionId() {
  const bytes = new Uint8Array(ID_LENGTH)
  crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return id
}

export function isValidSessionId(value) {
  return typeof value === 'string' && ID_REGEX.test(value)
}
