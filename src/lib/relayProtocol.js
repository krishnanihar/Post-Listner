// relayProtocol — single source of truth for the WS wire format used by the
// phone (conductor), desktop (viewer), and the Cloudflare Worker + DO relay.
//
// All messages are JSON-encoded strings. The wire schema is INTENTIONALLY
// loose to stay backwards-compatible with conduct-relay/src/phone.js (which
// emits the 'gesture' shape with q/raw/downbeat/gestureGain/etc fields).
// Adding fields is safe; removing or renaming fields requires bumping both
// the phone bundle and the desktop consumer.
//
// Conductor → viewer message types:
//   'gesture'     — Per-frame gesture snapshot from GestureCore. Existing
//                   shape from conduct-relay/src/phone.js.
//   'phase'       — Sent on entry to each PostListener phase so viewers can
//                   update their UI (e.g. show "rite in progress" vs cosmos
//                   canvas). { type: 'phase', phase: 'entry' | ... | 'orchestra' }.
//   'audio'       — Sent during Orchestra phase. FFT magnitude array
//                   (128 numbers, 0-255) so viewers can drive an
//                   AnalyserNode-equivalent visualization without playing
//                   the audio themselves. { type: 'audio', freq: number[] }.
//   'session:end' — Sent when the conductor's rite completes normally
//                   (closing card → return to entry). Viewers return to
//                   their waiting state. Distinct from 'conductor:lost'
//                   (which the relay generates on unexpected disconnect).
//
// Relay-generated → viewer message types (not in MSG_TYPES — emitted by
// SessionRoom DO, not the conductor):
//   'conductor:lost'    — Conductor disconnected and didn't reconnect within grace window.
//   'conductor:resumed' — Conductor reconnected within grace window.

export const MSG_TYPES = {
  GESTURE:     'gesture',
  PHASE:       'phase',
  AUDIO:       'audio',
  SESSION_END: 'session:end',
}

export const ROLES = {
  CONDUCTOR: 'conductor',
  VIEWER:    'viewer',
}

export function encodeMessage(msg) {
  return JSON.stringify(msg)
}

export function decodeMessage(raw) {
  try {
    const obj = JSON.parse(raw)
    if (!obj || typeof obj.type !== 'string') return null
    return obj
  } catch {
    return null
  }
}

export function isGestureMessage(m) {
  return !!m && m.type === MSG_TYPES.GESTURE
}

export function isPhaseMessage(m) {
  return !!m && m.type === MSG_TYPES.PHASE && typeof m.phase === 'string'
}

export function isAudioMessage(m) {
  return !!m && m.type === MSG_TYPES.AUDIO && Array.isArray(m.freq)
}

export function isSessionEndMessage(m) {
  return !!m && m.type === MSG_TYPES.SESSION_END
}
