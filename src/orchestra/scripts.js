// Orchestra v3 — assets reduced to ambient bed only.
// All admirer voices, whispers, ovation, and Track B were removed in v3
// (see Research-grounded brief 2026-05-09). The remaining assets are pure
// effects: hall reverb impulse and 2 audience-murmur beds.

export const AUDIENCE_FILES = ['/chamber/crowd/ambient-01.mp3', '/chamber/crowd/ambient-02.mp3']
export const HALL_IR_FILE = '/chamber/hall-ir.wav'

/**
 * Returns all asset paths needed for preloading. The session's per-archetype
 * stem URLs are joined in by the caller (Orchestra.jsx) — they're not known
 * here at module-load time.
 */
export function getAllPaths() {
  return [...AUDIENCE_FILES, HALL_IR_FILE]
}
