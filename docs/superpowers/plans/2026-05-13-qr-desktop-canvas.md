# QR-Paired Desktop-as-Canvas Conducting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user open Post-Listener on desktop, scan a QR code with their phone, run the 9-phase rite on their phone, and have the desktop transition automatically into a cosmos canvas that visualizes the user's conducting gestures + audio in real time. Multiple desktops can join the same session as viewers.

**Architecture:** Phone is the primary device — runs all phases, plays audio through headphones. Desktop is a paired "stage" — shows QR code → waiting state → cosmos canvas. Pairing uses an 8-char session ID embedded in the QR URL. A Cloudflare Worker + Durable Object handles WebSocket fan-out at `relay.post-listner.com` — one DO instance per session ID, holding all WS connections (1 conductor + N viewers). Conductor messages broadcast to all viewers. Local development continues to use the existing Node relay at `wss://localhost:8443` with the same session-aware message protocol.

**Tech Stack:** Cloudflare Workers + Durable Objects (new), `qrcode.react` for QR rendering (new dep), existing GestureCore + cosmos canvas + Vite + React 19.

---

## Research grounding (read once, then refer back)

The plan leans on a few specific patterns. Keep these in mind:

- **Cloudflare Durable Object WebSocket Hibernation** (Cloudflare 2024) — `ctx.acceptWebSocket()` enables free hibernation between messages; auto ping/pong via `setWebSocketAutoResponse`. Single DO instance per session, broadcasts via `ctx.getWebSockets()`.
- **Session ID as routing key** — `env.SESSION_ROOM.idFromName(sessionId)` derives a stable DO ID from the session ID; `env.SESSION_ROOM.get(id)` returns the stub. The same `sessionId` always lands on the same DO instance regardless of which edge POP handled the request.
- **Crockford base32 alphabet** for session IDs — 32 chars `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, omits ambiguous `I L O U`. 8 chars = 40 bits = ~1 trillion combinations.
- **Existing WS message shape** stays unchanged so the conducting refactor's outputs (phone bundle, desktop consumer) work with zero modifications: `{type: 'gesture', q, raw, downbeat, gestureGain, articulation, rotationRate, accel, calibrated, t}` plus new `{type: 'phase', phase}` and `{type: 'audio', freq}` message types.

## Decisions locked in during brainstorming

| Question | Answer |
|---|---|
| Audio location | Phone + headphones only (no streaming to desktop) |
| Where the rite runs | Phone for all 9 phases; desktop is "stage" |
| Production relay | Cloudflare Workers + Durable Objects |
| Custom domain | `relay.post-listner.com` |
| Reconnection | 30-min session TTL; conductor disconnect = 5-second grace before "lost" signal to viewers; client auto-reconnect with exponential backoff |
| Multi-viewer broadcast | Yes (v1 requirement) |
| Multi-conductor | OUT of scope for this plan |
| Cosmos audio sync | Phone sends FFT samples (128 bytes, 30 fps) over WS — guarantees what user hears matches what desktop visualizes |

## Out of scope

- Multi-conductor sessions (multiple people conducting same session)
- Audio streaming to desktop (always phone-only)
- Phase-specific desktop companion visuals during phases 0–7 (just generic "waiting" state)
- Session recording / replay
- Authentication beyond "knowing the session ID is enough to join"

---

## File structure

### New top-level directory: `relay/`

Separate from the main Vite project — different runtime (Cloudflare Workers), different package.json, different deploy target.

| File | Responsibility |
|---|---|
| `relay/wrangler.toml` | Cloudflare Workers config: DO binding, migrations, compatibility date, custom domain route |
| `relay/package.json` | Worker-only deps: `wrangler`, `@cloudflare/workers-types` |
| `relay/src/index.js` | Worker entry — HTTP→WS upgrade, session ID routing, role assignment, origin check |
| `relay/src/SessionRoom.js` | Durable Object — holds WS connections, fans out conductor messages to viewers, manages reconnect grace period |
| `relay/.gitignore` | Standard Cloudflare ignores (`.wrangler/`, `node_modules/`, `.dev.vars`) |

### New frontend files

| File | Responsibility |
|---|---|
| `src/lib/sessionId.js` | `generateSessionId()`, `isValidSessionId()` — Crockford base32, 8 chars, 5 tests |
| `src/lib/relayClient.js` | WS client class — auto-reconnect, exponential backoff, session-aware connect URL, role parameter, event handlers. Wraps the raw WebSocket API. |
| `src/lib/relayProtocol.js` | Message type constants + JSON validators. Single source of truth for the wire format. |
| `src/hooks/useDeviceMode.js` | `useDeviceMode()` → `'mobile' \| 'desktop'`. Uses `matchMedia('(pointer: coarse)')` + screen-width fallback. |
| `src/phases/Stage.jsx` | Desktop landing — QR code, waiting state, transition to cosmos canvas |
| `src/lib/__tests__/sessionId.test.js` | Vitest |
| `src/lib/__tests__/relayProtocol.test.js` | Vitest |

### Modified frontend files

| File | What changes |
|---|---|
| `src/main.jsx` | Add device detection — desktop without `?s=` → render `<Stage />`, otherwise existing `<App />` |
| `src/App.jsx` | Read `?s=` URL param, create relay client if present, expose phase changes |
| `src/phases/Orchestra.jsx` | Emit `phase: 'orchestra'` to relay on entry; send FFT samples during Throne |
| `src/conductor-codex/usePhoneConductor.js` | Take session ID as param, use `relayClient` |
| `src/conductor-codex/motion.js` | Remove hardcoded `RELAY_URL`; replace with env-driven URL builder that takes session ID + role |
| `conduct-relay/src/phone.js` | Accept session ID, env-driven URL, use relayClient |
| `conduct-relay/server.cjs` | Add session ID param parsing (dev parity with production Worker) |
| `vite.config.js` | Already loads `.env.local`; document the new `VITE_RELAY_URL` env var |
| `.env.local` | Add `VITE_RELAY_URL=wss://localhost:8443` for dev |
| `.env.production` (new) | `VITE_RELAY_URL=wss://relay.post-listner.com` for Vercel prod |
| `package.json` | Add `qrcode.react` dep + `deploy:relay` script |
| `CLAUDE.md` | Document new relay infra + Stage route |

---

## Step 1 — Shared session primitives

No infrastructure needed yet. Pure-function modules with unit tests so subsequent steps can rely on them.

### Task 1.1: Add `qrcode.react` dependency

**Files:** `package.json`

- [ ] **Step 1: Install the lib**

```bash
npm install qrcode.react@^4.2.0
```

- [ ] **Step 2: Verify install + version**

Run: `grep "qrcode.react" package.json`
Expected: `"qrcode.react": "^4.2.0"` in `dependencies` (not `devDependencies` — it's used at runtime).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add qrcode.react for desktop QR pairing screen

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.2: Implement session ID generator + validator

**Files:**
- Create: `src/lib/sessionId.js`
- Create: `src/lib/__tests__/sessionId.test.js`

- [ ] **Step 1: Write failing test `src/lib/__tests__/sessionId.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { generateSessionId, isValidSessionId } from '../sessionId.js'

describe('generateSessionId', () => {
  it('returns an 8-character string', () => {
    const id = generateSessionId()
    expect(id).toMatch(/^[0-9A-HJ-NP-TV-Z]{8}$/)
  })

  it('returns a different value on each call', () => {
    const a = generateSessionId()
    const b = generateSessionId()
    expect(a).not.toBe(b)
  })

  it('uses Crockford base32 (no I, L, O, U)', () => {
    // Generate 100 IDs; collectively should never contain those chars
    const ids = Array.from({ length: 100 }, generateSessionId).join('')
    expect(ids).not.toMatch(/[ILOU]/)
  })
})

describe('isValidSessionId', () => {
  it('accepts a valid 8-char Crockford base32 string', () => {
    expect(isValidSessionId('ABCD1234')).toBe(true)
    expect(isValidSessionId('XYZ0PQRS')).toBe(true)
  })

  it('rejects wrong length', () => {
    expect(isValidSessionId('ABC')).toBe(false)
    expect(isValidSessionId('ABCDEFGHI')).toBe(false)
    expect(isValidSessionId('')).toBe(false)
  })

  it('rejects ambiguous chars (I L O U)', () => {
    expect(isValidSessionId('ABCDIFGH')).toBe(false)  // I
    expect(isValidSessionId('ABCDLFGH')).toBe(false)  // L
    expect(isValidSessionId('ABCDOFGH')).toBe(false)  // O
    expect(isValidSessionId('ABCDUFGH')).toBe(false)  // U
  })

  it('rejects lowercase', () => {
    expect(isValidSessionId('abcd1234')).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(isValidSessionId(null)).toBe(false)
    expect(isValidSessionId(undefined)).toBe(false)
    expect(isValidSessionId(12345678)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/sessionId.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/sessionId.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/sessionId.test.js`
Expected: 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sessionId.js src/lib/__tests__/sessionId.test.js
git commit -m "feat(lib): add session ID generator + validator

8-char Crockford base32 (no I L O U). 40 bits of entropy, suitable as a
QR-encoded session identifier for the desktop ↔ phone pairing flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.3: Define the WS message protocol module

**Files:**
- Create: `src/lib/relayProtocol.js`
- Create: `src/lib/__tests__/relayProtocol.test.js`

- [ ] **Step 1: Write failing test `src/lib/__tests__/relayProtocol.test.js`**

```js
import { describe, it, expect } from 'vitest'
import {
  MSG_TYPES, ROLES, encodeMessage, decodeMessage, isGestureMessage,
} from '../relayProtocol.js'

describe('relayProtocol — constants', () => {
  it('exports the four conductor→viewer message types', () => {
    expect(MSG_TYPES.GESTURE).toBe('gesture')
    expect(MSG_TYPES.PHASE).toBe('phase')
    expect(MSG_TYPES.AUDIO).toBe('audio')
    expect(MSG_TYPES.SESSION_END).toBe('session:end')
  })

  it('exports the two roles', () => {
    expect(ROLES.CONDUCTOR).toBe('conductor')
    expect(ROLES.VIEWER).toBe('viewer')
  })
})

describe('relayProtocol — encode/decode', () => {
  it('encodes a gesture message as JSON string', () => {
    const msg = { type: 'gesture', gestureGain: 0.5, articulation: 0.2 }
    const encoded = encodeMessage(msg)
    expect(typeof encoded).toBe('string')
    expect(JSON.parse(encoded)).toEqual(msg)
  })

  it('decodes a JSON string back to an object', () => {
    const json = '{"type":"phase","phase":"orchestra"}'
    expect(decodeMessage(json)).toEqual({ type: 'phase', phase: 'orchestra' })
  })

  it('returns null on malformed JSON', () => {
    expect(decodeMessage('not json')).toBe(null)
  })

  it('returns null on missing type field', () => {
    expect(decodeMessage('{"foo":"bar"}')).toBe(null)
  })
})

describe('relayProtocol — type guards', () => {
  it('isGestureMessage accepts a well-formed gesture', () => {
    expect(isGestureMessage({ type: 'gesture', gestureGain: 0.5 })).toBe(true)
  })

  it('isGestureMessage rejects other types', () => {
    expect(isGestureMessage({ type: 'phase', phase: 'orchestra' })).toBe(false)
    expect(isGestureMessage({})).toBe(false)
    expect(isGestureMessage(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/relayProtocol.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/relayProtocol.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/relayProtocol.test.js`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relayProtocol.js src/lib/__tests__/relayProtocol.test.js
git commit -m "feat(lib): add relayProtocol module — WS message types + encoders

Single source of truth for the wire format used by phone (conductor),
desktop (viewer), and the Cloudflare Worker relay. 4 message types:
gesture / phase / audio / session:end. Backwards-compatible with the
existing gesture shape emitted by conduct-relay/src/phone.js. Relay-
generated 'conductor:lost' and 'conductor:resumed' are documented in
the module header but not in MSG_TYPES (only conductor emits MSG_TYPES).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Step 2 — Cloudflare Worker + Durable Object (local dev with wrangler)

### Task 2.1: Initialize `relay/` directory

**Files:**
- Create: `relay/wrangler.toml`
- Create: `relay/package.json`
- Create: `relay/.gitignore`

- [ ] **Step 1: Verify wrangler is callable via npx (no global install needed)**

Wrangler will be installed locally via the `relay/package.json` devDep in Step 5 — all commands in this plan invoke it as `npx wrangler ...` so no global install is required.

You can verify the npx pathway works once the relay directory is scaffolded (Steps 2-5).

- [ ] **Step 2: Create `relay/wrangler.toml`**

```toml
name = "post-listner-relay"
main = "src/index.js"
compatibility_date = "2026-04-07"
compatibility_flags = ["nodejs_compat"]

# Durable Object binding — each session is one DO instance.
[[durable_objects.bindings]]
name = "SESSION_ROOM"
class_name = "SessionRoom"

# First DO migration — register the class.
[[migrations]]
tag = "v1"
new_classes = ["SessionRoom"]

# Production routes — added in Task 3.2 when custom domain is set up.
# For now, the Worker is reachable at https://post-listner-relay.<account>.workers.dev.
```

- [ ] **Step 3: Create `relay/package.json`**

```json
{
  "name": "post-listner-relay",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20251101.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 4: Create `relay/.gitignore`**

```gitignore
node_modules/
.wrangler/
.dev.vars
```

- [ ] **Step 5: Install local wrangler in the relay dir**

```bash
cd relay && npm install && cd ..
```

Expected: creates `relay/node_modules/`, `relay/package-lock.json`.

- [ ] **Step 6: Authenticate wrangler with the existing Cloudflare account**

```bash
cd relay && npx wrangler login
```

Browser opens, user authorizes. Account should match the one already used for R2 (`9e1a18fd2ad77e23ef5c83ec0ab6a26c` per `.env.local`).

- [ ] **Step 7: Commit**

```bash
git add relay/wrangler.toml relay/package.json relay/package-lock.json relay/.gitignore
git commit -m "build(relay): scaffold Cloudflare Worker directory

New top-level relay/ dir with wrangler.toml configured for Durable Objects
binding (SESSION_ROOM → SessionRoom class). nodejs_compat flag enabled.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.2: Implement SessionRoom Durable Object

**Files:**
- Create: `relay/src/SessionRoom.js`

- [ ] **Step 1: Create `relay/src/SessionRoom.js`**

```js
// SessionRoom — Durable Object holding the WebSocket connections for a
// single Post-Listener session. One DO instance per session ID, routed by
// the entry Worker via env.SESSION_ROOM.idFromName(sessionId) + .get(id).
//
// Roles:
//   conductor — the phone running the rite. Exactly one allowed; a second
//               conductor connect replaces (closes) the existing one. This
//               handles phone reconnects after network blips cleanly.
//   viewer    — a desktop watching the cosmos canvas. Unlimited.
//
// Behaviors:
//   - Conductor 'gesture' / 'phase' / 'audio' messages are broadcast to all viewers.
//   - Viewer messages (any) are currently ignored (no upstream signaling in v1).
//   - On conductor disconnect, the DO schedules a Durable Object alarm
//     CONDUCTOR_GRACE_MS in the future. If the conductor reconnects before
//     the alarm fires, the alarm is cancelled. Otherwise the alarm() handler
//     broadcasts {type:'conductor:lost'} to viewers. Using alarms (not
//     setTimeout) makes this hibernation-safe.
//   - Hibernation: ctx.acceptWebSocket() lets the runtime sleep the DO
//     between messages — free on idle sessions. Storage + alarms survive.

import { DurableObject } from 'cloudflare:workers'

const CONDUCTOR_GRACE_MS = 5000

export class SessionRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    // Auto ping/pong without waking — keeps connections alive cheaply.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    )
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const url = new URL(request.url)
    const role = url.searchParams.get('role') || 'viewer'

    if (role !== 'conductor' && role !== 'viewer') {
      return new Response('Invalid role', { status: 400 })
    }

    // Enforce single-conductor — close any existing conductor socket before
    // accepting the new one. Reconnect-after-blip flows produce a phantom
    // old socket that hasn't yet fired webSocketClose; without this, viewers
    // would see interleaved streams from two phones.
    if (role === 'conductor') {
      for (const conn of this.ctx.getWebSockets()) {
        const { role: existingRole } = conn.deserializeAttachment() || {}
        if (existingRole === 'conductor') {
          try { conn.close(1000, 'replaced by reconnect') } catch { /* ignore */ }
        }
      }
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // Tag the server-side socket with its role for routing decisions later.
    server.serializeAttachment({ role })

    this.ctx.acceptWebSocket(server)

    // If a "conductor lost" alarm was pending, cancel it — the conductor is
    // back within the grace window. Broadcast resumed signal to viewers.
    if (role === 'conductor') {
      const pendingAlarm = await this.ctx.storage.getAlarm()
      if (pendingAlarm != null) {
        await this.ctx.storage.deleteAlarm()
        this._broadcast({ type: 'conductor:resumed' }, 'viewer')
      }
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  // Called when ANY connected WS receives a message.
  async webSocketMessage(ws, message) {
    const { role } = ws.deserializeAttachment() || {}
    // Only conductor messages are fanned out — v1 has no viewer→conductor traffic.
    if (role !== 'conductor') return

    // Broadcast to all viewers. We forward the raw message untouched so the
    // wire format stays opaque to the relay — phone.js and the desktop
    // consumer agree on the schema independently (src/lib/relayProtocol.js).
    this._broadcast(message, 'viewer')
  }

  async webSocketClose(ws, code, reason, wasClean) {
    const { role } = ws.deserializeAttachment() || {}
    if (role === 'conductor') {
      // Schedule a DO alarm — survives hibernation, unlike setTimeout.
      // The alarm() handler below fires after the grace period if no
      // replacement conductor reconnects in time.
      await this.ctx.storage.setAlarm(Date.now() + CONDUCTOR_GRACE_MS)
    }
  }

  async webSocketError(ws, error) {
    console.error('SessionRoom WebSocket error:', error)
  }

  // Called when the alarm scheduled in webSocketClose fires.
  async alarm() {
    // Only broadcast 'conductor:lost' if no conductor is currently connected.
    // (Reconnect during the grace window deletes the alarm; if we get here,
    // no reconnect happened.)
    let hasConductor = false
    for (const conn of this.ctx.getWebSockets()) {
      const { role } = conn.deserializeAttachment() || {}
      if (role === 'conductor') { hasConductor = true; break }
    }
    if (!hasConductor) {
      this._broadcast({ type: 'conductor:lost' }, 'viewer')
    }
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  _broadcast(payload, targetRole) {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
    for (const conn of this.ctx.getWebSockets()) {
      const { role } = conn.deserializeAttachment() || {}
      if (role !== targetRole) continue
      try {
        conn.send(data)
      } catch (_e) {
        // Stale connection; ignore. Runtime will fire webSocketClose for it.
      }
    }
  }
}
```

- [ ] **Step 2: Commit (Worker entry comes in next task)**

```bash
git add relay/src/SessionRoom.js
git commit -m "feat(relay): implement SessionRoom Durable Object

One DO instance per session. Holds WS connections (1 conductor + N viewers),
fans out conductor 'gesture'/'phase'/'audio' messages to all viewers using
ctx.getWebSockets() + serializeAttachment for role tagging. Single-conductor
enforcement: a new conductor connection closes the existing one (handles
phone reconnect-after-blip cleanly). 5-second grace window on conductor
disconnect uses DO Alarms (hibernation-safe, persisted across restarts).
Hibernation enabled via acceptWebSocket().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.3: Implement the entry Worker

**Files:**
- Create: `relay/src/index.js`

- [ ] **Step 1: Create `relay/src/index.js`**

```js
// Entry Worker — upgrades incoming WS connections, routes them to the
// SessionRoom DO instance for the requested session ID. Origin check
// rejects connections from unexpected origins (localhost is allowlisted
// so dev works without any "is-production" branch).

export { SessionRoom } from './SessionRoom.js'

// Allowed origins for production AND dev. Localhost is intentionally
// included so `wrangler dev` flows + Vite dev server (5173/4173) work
// against this same Worker without special-casing environment.
const ALLOWED_ORIGINS = new Set([
  'https://post-listner.vercel.app',
  'https://post-listner.com',
  'http://localhost:5173',
  'https://localhost:5173',
  'http://localhost:4173',
  'https://localhost:4173',
])

// Crockford base32, no ambiguous chars (matches src/lib/sessionId.js)
const SESSION_ID_REGEX = /^[0-9A-HJ-NP-TV-Z]{8}$/

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Health check route (browser-pingable for debugging)
    if (url.pathname === '/healthz') {
      return new Response('ok', { status: 200 })
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    // Origin check — always enforced. A missing Origin header is treated
    // as allowed (non-browser WS clients like wscat don't always send one).
    const origin = request.headers.get('Origin')
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response('Origin not allowed', { status: 403 })
    }

    const sessionId = url.searchParams.get('s')
    if (!sessionId || !SESSION_ID_REGEX.test(sessionId)) {
      return new Response('Missing or invalid session id', { status: 400 })
    }

    const role = url.searchParams.get('role')
    if (role !== 'conductor' && role !== 'viewer') {
      return new Response('Missing or invalid role', { status: 400 })
    }

    // Route to the DO instance for this session. idFromName + get is the
    // canonical DO namespace API — the same sessionId always hashes to the
    // same DO id, so all connections for a session land on the same instance
    // regardless of which edge POP received the request.
    const id = env.SESSION_ROOM.idFromName(sessionId)
    const stub = env.SESSION_ROOM.get(id)
    return stub.fetch(request)
  },
}
```

- [ ] **Step 2: Sanity-check it builds in wrangler**

```bash
cd relay && npx wrangler dev --dry-run --outdir /tmp/wrangler-check 2>&1 | tail -10
```
Expected: no compilation errors. (`--dry-run` builds without starting the server.)

- [ ] **Step 3: Commit**

```bash
git add relay/src/index.js
git commit -m "feat(relay): implement entry Worker with session routing

URL contract:
  wss://<host>/?s=<8-char-id>&role=<conductor|viewer>
Routes via env.SESSION_ROOM.idFromName(sessionId).get() — canonical DO
namespace API. Origin check is always enforced (localhost allowlisted so
dev works without environment branching). Returns 400 on missing/malformed
session ID, 403 on disallowed origin, 426 on non-WebSocket request.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.4: Local-dev verification with `wrangler dev`

**Files:** (none — verification only)

- [ ] **Step 1: Run the Worker locally**

```bash
cd relay && npx wrangler dev
```

Expected output includes something like:
```
⎔ Starting local server...
[wrangler:info] Ready on http://localhost:8787
```

Leave it running for the next step.

- [ ] **Step 2: Verify the health check**

In a second terminal:
```bash
curl -i http://localhost:8787/healthz
```
Expected: `HTTP/1.1 200 OK` with body `ok`.

- [ ] **Step 3: Verify session routing rejects malformed IDs**

```bash
curl -i 'http://localhost:8787/?s=BAD&role=conductor' -H "Upgrade: websocket" -H "Connection: Upgrade"
```
Expected: 400 with body `Missing or invalid session id`.

- [ ] **Step 4: Verify a valid WS handshake**

```bash
curl -i 'http://localhost:8787/?s=ABCD1234&role=conductor' -H "Upgrade: websocket" -H "Connection: Upgrade" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" -H "Sec-WebSocket-Version: 13"
```
Expected: `HTTP/1.1 101 Switching Protocols`. (curl won't speak WS, but the response code confirms the handshake reached the DO.)

- [ ] **Step 5: Stop the worker**

`Ctrl+C` in the wrangler dev terminal.

- [ ] **Step 6: No commit needed (verification only)**

---

## Step 3 — Custom domain + production deploy

### Task 3.1: First deploy to default workers.dev domain

**Files:** (none — deploy only)

- [ ] **Step 1: Deploy**

```bash
cd relay && npx wrangler deploy
```

Wrangler outputs the URL — should be similar to `https://post-listner-relay.<account>.workers.dev`.

Note the URL — you'll use it in Task 3.4 verification.

- [ ] **Step 2: Verify health endpoint over HTTPS**

```bash
curl -i https://post-listner-relay.<account>.workers.dev/healthz
```
Expected: 200 `ok`.

- [ ] **Step 3: Tail logs in another terminal**

```bash
cd relay && npx wrangler tail
```
Leave running to observe live traffic in the next step.

- [ ] **Step 4: No commit (deploy is config-driven)**

---

### Task 3.2: Add `relay.post-listner.com` custom domain

**Files:** `relay/wrangler.toml`

Prerequisite: the user owns `post-listner.com` and has its DNS managed by Cloudflare. If DNS is on Vercel or another provider, this task requires moving DNS to Cloudflare first (free, ~30 min: change nameservers at the registrar).

If `post-listner.com` is not yet a Cloudflare-managed domain, **skip this task** — the production URL stays `https://post-listner-relay.<account>.workers.dev`. You can always upgrade later. The plan steps that follow will reference `VITE_RELAY_URL` as the production endpoint and work either way.

- [ ] **Step 1: Add the custom domain route to `relay/wrangler.toml`**

Append to the end of `wrangler.toml`:

```toml
# Production custom domain
[[routes]]
pattern = "relay.post-listner.com"
custom_domain = true
```

`custom_domain = true` makes wrangler automatically create the necessary DNS record (CNAME `relay` → workers infrastructure) and the SSL certificate during deploy.

- [ ] **Step 2: Re-deploy**

```bash
cd relay && npx wrangler deploy
```

Wrangler creates the DNS record automatically. Output should mention `relay.post-listner.com` being claimed.

- [ ] **Step 3: Verify DNS resolution**

```bash
dig relay.post-listner.com +short
```
Expected: one or more IP addresses (Cloudflare's anycast network).

- [ ] **Step 4: Verify TLS + health endpoint**

```bash
curl -i https://relay.post-listner.com/healthz
```
Expected: 200 `ok`. (May take up to 60 seconds after deploy for the TLS cert to provision.)

- [ ] **Step 5: Commit**

```bash
git add relay/wrangler.toml
git commit -m "deploy(relay): bind relay.post-listner.com custom domain

Wrangler manages DNS + TLS automatically via custom_domain=true. The Worker
is now reachable at both the default workers.dev URL (backup) and
relay.post-listner.com (canonical production URL — referenced by
VITE_RELAY_URL in subsequent tasks).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.3: End-to-end WS connection sanity check

**Files:** (none — verification)

- [ ] **Step 1: Use a CLI WebSocket client (`npx wscat`) for the test**

```bash
npx -y wscat -c "wss://relay.post-listner.com/?s=TESTTEST&role=conductor"
```
Expected: `Connected (press CTRL+C to quit)`. Type any text + Enter — the message goes nowhere (no viewers connected) but doesn't error. Ctrl+C to exit.

- [ ] **Step 2: Open a second wscat as viewer, broadcast from conductor**

Terminal A:
```bash
npx -y wscat -c "wss://relay.post-listner.com/?s=TESTTEST&role=viewer"
```

Terminal B:
```bash
npx -y wscat -c "wss://relay.post-listner.com/?s=TESTTEST&role=conductor"
```

In terminal B, type: `{"type":"gesture","gestureGain":0.5}`

Expected in terminal A: the same JSON appears.

- [ ] **Step 3: Verify origin check by attempting from a disallowed origin**

```bash
npx -y wscat -c "wss://relay.post-listner.com/?s=TESTTEST&role=conductor" -H "Origin: https://example.com"
```
Expected: connection rejected with 403.

- [ ] **Step 4: No commit (verification)**

---

## Step 4 — Env-driven relay URL on clients

### Task 4.1: Add the env var for the relay URL

**Files:**
- Modify: `.env.local` (gitignored — local development)
- Create: `.env.production` (committed — Vite picks this up in production build)
- Modify: `CLAUDE.md` (Environment section)

- [ ] **Step 1: Add to `.env.local`**

Append to the existing `.env.local`:

```
VITE_RELAY_URL=wss://localhost:8443
```

(This file is gitignored — don't commit changes to it.)

- [ ] **Step 2: Create `.env.production`**

```
VITE_RELAY_URL=wss://relay.post-listner.com
```

(If you skipped custom domain in Task 3.2, use the workers.dev URL instead: `wss://post-listner-relay.<account>.workers.dev`.)

- [ ] **Step 3: Document the new env var in CLAUDE.md**

Find the "Environment" section table (around line 184) and add a row:

```markdown
| `VITE_RELAY_URL` | Runtime (`motion.js`, `phone.js`) | WebSocket relay endpoint. Dev: `wss://localhost:8443`. Prod: `wss://relay.post-listner.com`. |
```

Also add to the Vercel production environment vars list at the bottom of the Environment section: `VITE_RELAY_URL` (set to the production WSS URL).

- [ ] **Step 4: Commit**

```bash
git add .env.production CLAUDE.md
git commit -m "build(env): VITE_RELAY_URL for env-driven relay endpoint

Local dev → wss://localhost:8443 (existing Node relay).
Production → wss://relay.post-listner.com (Cloudflare Worker from Step 3).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Set the Vercel production env var**

In the Vercel dashboard → Post-Listener project → Settings → Environment Variables:

Add: `VITE_RELAY_URL` = `wss://relay.post-listner.com` for the Production environment.

(This is a UI step; no commit needed.)

---

### Task 4.2: Update `conduct-relay/server.cjs` to accept session ID (dev parity)

**Files:** `conduct-relay/server.cjs`

- [ ] **Step 1: Update the WS connection handler to honor the `s` param**

Find the existing block at lines 86–125 (in `wss.on('connection', ...)`). Replace it with:

```js
const sessions = new Map() // sessionId → { conductor: ws | null, viewers: Set<ws> }

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const sessionId = url.searchParams.get('s') || 'default';
  const role = url.searchParams.get('role');

  // Backwards compat: the existing phone.js sent role=phone/desktop, the new
  // protocol uses conductor/viewer. Accept both for dev convenience.
  const isConductor = role === 'conductor' || role === 'phone';
  const isViewer    = role === 'viewer'    || role === 'desktop';

  if (!isConductor && !isViewer) {
    ws.close();
    return;
  }

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { conductor: null, viewers: new Set() });
  }
  const session = sessions.get(sessionId);

  if (isConductor) {
    session.conductor = ws;
    console.log(`[ws] conductor connected to session ${sessionId}`);
    let msgCount = 0;
    ws.on('message', (data, isBinary) => {
      msgCount++;
      for (const v of session.viewers) {
        if (v.readyState === WebSocket.OPEN) v.send(data, { binary: isBinary });
      }
      if (msgCount === 1 || msgCount % 60 === 0) {
        console.log(`[ws] session ${sessionId} conductor msg #${msgCount} → ${session.viewers.size} viewers`);
      }
    });
    ws.on('close', () => {
      if (session.conductor === ws) session.conductor = null;
      console.log(`[ws] conductor disconnected from session ${sessionId}`);
      if (!session.conductor && session.viewers.size === 0) {
        sessions.delete(sessionId);
      }
    });
  } else {
    session.viewers.add(ws);
    console.log(`[ws] viewer connected to session ${sessionId} (${session.viewers.size} total)`);
    ws.on('close', () => {
      session.viewers.delete(ws);
      console.log(`[ws] viewer disconnected from session ${sessionId} (${session.viewers.size} remaining)`);
      if (!session.conductor && session.viewers.size === 0) {
        sessions.delete(sessionId);
      }
    });
  }
});
```

- [ ] **Step 2: Test the local relay still works with the updated code**

In one terminal:
```bash
npm run relay
```
Output should include the relay URLs (HTTPS + WSS) as before.

In another:
```bash
npx -y wscat -c "wss://localhost:8443/?s=TESTTEST&role=viewer" --no-check
```
(`--no-check` skips self-signed cert check.) Expected: connected.

Open another phone tab with `role=conductor` and verify broadcast works in this session.

- [ ] **Step 3: Stop the relay**

- [ ] **Step 4: Commit**

```bash
git add conduct-relay/server.cjs
git commit -m "feat(relay): support session ID + conductor/viewer roles (dev parity)

The local Node relay now matches the Cloudflare Worker's URL contract:
?s=<sessionId>&role=conductor|viewer (also accepts legacy phone/desktop).
Multiple sessions are isolated via the sessions Map. Sessions auto-evict
when both conductor and viewer counts hit zero.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.3: Add the relay client abstraction

**Files:** Create `src/lib/relayClient.js`

- [ ] **Step 1: Create the file**

```js
// relayClient — WS client wrapper with auto-reconnect, session ID, and role.
// Used by both the phone (conductor) and desktop (viewer).
//
// Why a wrapper instead of raw WebSocket: we need exponential backoff on
// disconnect, a uniform onMessage/onOpen/onClose callback shape, and an
// env-driven base URL. Raw WebSocket would force every caller to duplicate
// these.

const MAX_BACKOFF_MS = 8000
const INITIAL_BACKOFF_MS = 500

export default class RelayClient {
  /**
   * @param {object} options
   * @param {string} options.baseUrl   e.g. 'wss://relay.post-listner.com' or 'wss://localhost:8443'
   * @param {string} options.sessionId 8-char Crockford base32 ID
   * @param {string} options.role      'conductor' | 'viewer'
   * @param {(msg: object) => void} options.onMessage      Called with decoded JSON, or string if non-JSON.
   * @param {() => void} [options.onOpen]
   * @param {() => void} [options.onClose]
   * @param {(error: Error) => void} [options.onError]
   */
  constructor({ baseUrl, sessionId, role, onMessage, onOpen, onClose, onError }) {
    if (!baseUrl) throw new Error('RelayClient: baseUrl required')
    if (!sessionId) throw new Error('RelayClient: sessionId required')
    if (role !== 'conductor' && role !== 'viewer') {
      throw new Error(`RelayClient: invalid role '${role}'`)
    }
    this.baseUrl   = baseUrl
    this.sessionId = sessionId
    this.role      = role
    this.onMessage = onMessage || (() => {})
    this.onOpen    = onOpen    || (() => {})
    this.onClose   = onClose   || (() => {})
    this.onError   = onError   || (() => {})

    this._ws = null
    this._cancelled = false
    this._backoff = INITIAL_BACKOFF_MS
    this._reconnectTimer = 0
  }

  start() {
    this._cancelled = false
    this._connect()
  }

  stop() {
    this._cancelled = true
    clearTimeout(this._reconnectTimer)
    if (this._ws) {
      try { this._ws.close() } catch { /* ignore */ }
      this._ws = null
    }
  }

  /** Send a JSON-encodable object. Returns true if sent, false if not connected. */
  send(payload) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return false
    try {
      this._ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }

  isConnected() {
    return !!this._ws && this._ws.readyState === WebSocket.OPEN
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  _connect() {
    if (this._cancelled) return
    const url = `${this.baseUrl}/?s=${this.sessionId}&role=${this.role}`

    try {
      this._ws = new WebSocket(url)
    } catch (err) {
      this.onError(err)
      this._scheduleReconnect()
      return
    }

    this._ws.addEventListener('open', () => {
      this._backoff = INITIAL_BACKOFF_MS
      this.onOpen()
    })

    this._ws.addEventListener('message', (e) => {
      let parsed = e.data
      if (typeof e.data === 'string') {
        try { parsed = JSON.parse(e.data) } catch { /* keep raw string */ }
      }
      this.onMessage(parsed)
    })

    this._ws.addEventListener('close', () => {
      this.onClose()
      if (!this._cancelled) this._scheduleReconnect()
    })

    this._ws.addEventListener('error', (e) => {
      this.onError(e)
    })
  }

  _scheduleReconnect() {
    this._reconnectTimer = setTimeout(() => this._connect(), this._backoff)
    this._backoff = Math.min(this._backoff * 2, MAX_BACKOFF_MS)
  }
}
```

- [ ] **Step 2: Add export to a barrel if there is one — there isn't, so skip**

- [ ] **Step 3: Commit**

```bash
git add src/lib/relayClient.js
git commit -m "feat(lib): add RelayClient — WS wrapper with auto-reconnect + session

Replaces raw WebSocket usage in usePhoneConductor (desktop) and phone.js
(conductor). Exponential backoff (500ms → 8s max), env-driven baseUrl,
session+role URL construction, uniform onMessage/onOpen/onClose callbacks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.4: Migrate `motion.js` + `usePhoneConductor.js` to use RelayClient

**Files:**
- Modify: `src/conductor-codex/motion.js`
- Modify: `src/conductor-codex/usePhoneConductor.js`

- [ ] **Step 1: Remove the hardcoded RELAY_URL from `motion.js`**

In `src/conductor-codex/motion.js`, delete line 1:
```js
export const RELAY_URL = 'wss://localhost:8443/?role=desktop'
```

The rest of the file (DEFAULT_CONTROLS, mapRelayMessage, applyRelayMessage, snapshotFromState) stays — it's the decoder, transport-agnostic.

- [ ] **Step 2: Rewrite `usePhoneConductor.js` to use RelayClient**

Replace the entire file content:

```js
import { useEffect, useRef, useState } from 'react'
import RelayClient from '../lib/relayClient'
import {
  applyRelayMessage,
  createConductorState,
  snapshotFromState,
} from './motion'

/**
 * usePhoneConductor — desktop-side viewer hook.
 *
 * Connects to the relay as 'viewer' for the given sessionId. Decodes
 * incoming conductor messages via applyRelayMessage. Publishes a snapshot
 * to React state at ~8 Hz so renders aren't gated by message rate.
 *
 * @param {string} sessionId — the Crockford base32 ID being broadcast.
 *                             If null/undefined, the hook is inactive.
 */
export function usePhoneConductor(sessionId) {
  const stateRef = useRef(createConductorState())
  const [snapshot, setSnapshot] = useState(() =>
    snapshotFromState(createConductorState(), 0),
  )

  useEffect(() => {
    if (!sessionId) return

    const publish = () => {
      setSnapshot(snapshotFromState(stateRef.current, performance.now()))
    }

    const baseUrl = import.meta.env.VITE_RELAY_URL || 'wss://localhost:8443'
    const client = new RelayClient({
      baseUrl,
      sessionId,
      role: 'viewer',
      onOpen: () => {
        stateRef.current.status = 'connected'
        stateRef.current.connected = true
        publish()
      },
      onClose: () => {
        stateRef.current.status = 'disconnected'
        stateRef.current.connected = false
        publish()
      },
      onError: () => {
        stateRef.current.status = 'error'
        stateRef.current.lastError = 'relay unavailable'
        publish()
      },
      onMessage: (message) => {
        if (message && (message.type === 'orientation' || message.type === 'gesture')) {
          applyRelayMessage(stateRef.current, message, performance.now())
        }
      },
    })

    client.start()
    const uiTimer = window.setInterval(publish, 120)

    return () => {
      client.stop()
      window.clearInterval(uiTimer)
    }
  }, [sessionId])

  return { stateRef, snapshot }
}
```

- [ ] **Step 3: Update any callers passing `sessionId`**

Find existing callers:

```bash
grep -rn "usePhoneConductor" src/
```

Currently only `src/conductor-glb/ConductGlb.jsx` (and indirectly via PhoneContext) calls it. They invoke `usePhoneConductor()` with no args. For the existing `/conduct-glb` route to keep working in dev, hardcode a default session ID there until Step 7 wires the real session in:

In `src/conductor-glb/ConductGlb.jsx`, change:
```js
const phone = usePhoneConductor()
```
to:
```js
// Default session for the standalone /conduct-glb dev route. Real session
// IDs are wired in via the QR pairing flow on the Stage route.
const phone = usePhoneConductor('DEV00000')
```

- [ ] **Step 4: Test**

```bash
npm test
```
Expected: 200+ tests still pass (none cover this code, but sanity check).

- [ ] **Step 5: Commit**

```bash
git add src/conductor-codex/motion.js src/conductor-codex/usePhoneConductor.js src/conductor-glb/ConductGlb.jsx
git commit -m "refactor(conductor): migrate usePhoneConductor to RelayClient + session

Removes the hardcoded wss://localhost:8443 from motion.js — RelayClient now
constructs the URL from VITE_RELAY_URL + sessionId + role. usePhoneConductor
takes the sessionId as an argument; the standalone /conduct-glb dev route
uses a default 'DEV00000' session until the QR pairing flow (Step 7) wires
the real session in.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.5: Migrate `conduct-relay/src/phone.js` to use RelayClient + session ID

**Files:** `conduct-relay/src/phone.js`

- [ ] **Step 1: Update the file's imports and URL construction**

Read the current file. Find the `connectWS()` function (currently around line 30 — uses hardcoded `location.host` for the URL). Replace with:

```js
import {
  createState, processMotion, processOrientation, calibrate as coreCalibrate, read,
  activeParams,
} from '../../src/conducting/index.js'
import { quatFromEulerZXY, quatMul, quatConj } from '../../src/conducting/quaternion.js'
import RelayClient from '../../src/lib/relayClient.js'
import { isValidSessionId } from '../../src/lib/sessionId.js'

// ─── Session ID — taken from URL ?s= or the phone.html "session" input ─────

function readSessionId() {
  const fromUrl = new URLSearchParams(location.search).get('s')
  if (fromUrl && isValidSessionId(fromUrl)) return fromUrl
  return null
}

let sessionId = readSessionId()
let relay = null

// ─── Existing DOM / state setup (preserved) ──────────────────────────────────

const startBtn = document.getElementById('start')
const calibrateBtn = document.getElementById('calibrate')
const statusEl = document.getElementById('status')
const dataEl = document.getElementById('data')

const SEND_INTERVAL_MS = 16

const state = createState({ params: activeParams() })

let lastSentAt = 0
let zeroQuat = [0, 0, 0, 1]
let lastAbsQuat = [0, 0, 0, 1]
let calibrated = false
let hasSample = false

function setStatus(s) { statusEl.textContent = s }
function fmt(n, w = 7, p = 2) {
  if (n == null || Number.isNaN(n)) return '   —  '.padStart(w, ' ')
  return n.toFixed(p).padStart(w, ' ')
}
```

Then in `start()`, replace the existing `connectWS()` call with:

```js
    // Construct the relay client (env-driven base URL).
    if (!sessionId) {
      setStatus('Missing session id in URL (?s=...).')
      startBtn.disabled = false
      return
    }
    const baseUrl =
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_RELAY_URL) ||
      `wss://${location.host}`
    relay = new RelayClient({
      baseUrl,
      sessionId,
      role: 'conductor',
      onOpen:  () => setStatus(`Connected to session ${sessionId}. Move the phone.`),
      onClose: () => setStatus('Disconnected.'),
      onError: () => setStatus('WebSocket error.'),
    })
    relay.start()
```

Then in `onOrientation`, replace the `ws.send(JSON.stringify(msg))` line with `relay.send(msg)`.

The rest of `onMotion`, `onOrientation` (downbeat detection, gesture extraction), `calibrate`, `start` stay unchanged — they're DOM/data flow.

Remove the old `connectWS` function entirely.

- [ ] **Step 2: Add a session-id field to `conduct-relay/public/phone.html`**

For dev convenience when not clicking through from a QR. Read the file, find where the start button is, and insert above it:

```html
<label for="session">session</label>
<input id="session" type="text" placeholder="8 chars (or use URL ?s=)" maxlength="8" autocapitalize="characters" />
```

Then in `phone.js`, after `readSessionId()`, add:

```js
const sessionInput = document.getElementById('session')
if (sessionInput) {
  if (sessionId) sessionInput.value = sessionId
  sessionInput.addEventListener('change', () => {
    const v = sessionInput.value.trim().toUpperCase()
    if (isValidSessionId(v)) {
      sessionId = v
      setStatus(`Session set to ${v}. Tap Start.`)
    } else if (v) {
      setStatus('Invalid session id format.')
    }
  })
}
```

- [ ] **Step 3: Rebuild the bundle**

```bash
npm run build:relay-phone
```
Expected: `[build-relay-phone] built conduct-relay/public/phone.bundle.js`. Bundle should be ~16-17kb now (slightly larger from the added imports).

- [ ] **Step 4: Smoke test locally**

```bash
npm run relay
```

Connect a phone to `https://<lan-ip>:8443/phone?s=ABCD1234`. The status should read "Session set to ABCD1234." after page load. Tap Start, grant motion permission. The relay logs should show `[ws] conductor connected to session ABCD1234`.

Open `https://<lan-ip>:8443/?s=ABCD1234` or `wscat` as viewer in the same session — messages should appear.

- [ ] **Step 5: Commit**

```bash
git add conduct-relay/src/phone.js conduct-relay/public/phone.html conduct-relay/public/phone.bundle.js
git commit -m "feat(relay): phone.js uses RelayClient + session ID

Replaces raw WebSocket + hardcoded host with RelayClient (auto-reconnect,
env-driven base URL, session+role URL contract). Session ID can be passed
via URL ?s= param (production QR flow) or typed into a new field on the
phone landing page (dev convenience).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Note: the bundle file (`phone.bundle.js`) is .gitignored — won't actually be committed. The `git add` line stays in case the user has chosen to track it for some reason. If the file is ignored, `git add` is a no-op for it.

---

## Step 5 — Device detection + desktop Stage route

### Task 5.1: Add the device detection hook

**Files:**
- Create: `src/hooks/useDeviceMode.js`
- Create: `src/hooks/__tests__/useDeviceMode.test.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDeviceMode } from '../useDeviceMode.js'

function mockMatchMedia(matches) {
  return vi.fn((query) => ({
    matches: query.includes('coarse') ? matches : !matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('useDeviceMode', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns "mobile" when pointer is coarse', () => {
    window.matchMedia = mockMatchMedia(true)
    const { result } = renderHook(() => useDeviceMode())
    expect(result.current).toBe('mobile')
  })

  it('returns "desktop" when pointer is fine', () => {
    window.matchMedia = mockMatchMedia(false)
    const { result } = renderHook(() => useDeviceMode())
    expect(result.current).toBe('desktop')
  })
})
```

- [ ] **Step 2: Add `@testing-library/react` to devDeps if not present**

```bash
grep "@testing-library/react" package.json || npm install -D @testing-library/react@^16.0.0
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/hooks/__tests__/useDeviceMode.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `src/hooks/useDeviceMode.js`**

```js
import { useState, useEffect } from 'react'

/**
 * useDeviceMode — return 'mobile' or 'desktop' based on input modality.
 *
 * The `(pointer: coarse)` media query is the modern, reliable way to
 * detect touch-first devices. It correctly classifies iPhones/iPads as
 * mobile and laptops/desktops as desktop, including hybrid devices like
 * Surface tablets in tablet-mode (mobile) vs laptop-mode (desktop).
 *
 * Updates if the input modality changes (rare — only Surface-style hybrids).
 */
export function useDeviceMode() {
  const [mode, setMode] = useState(() => detect())

  useEffect(() => {
    if (!window.matchMedia) return  // defensive — SSR or exotic test envs
    const mq = window.matchMedia('(pointer: coarse)')
    const handler = () => setMode(mq.matches ? 'mobile' : 'desktop')
    handler()  // sync once on mount in case SSR returned stale value
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return mode
}

function detect() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop'
  return window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop'
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/hooks/__tests__/useDeviceMode.test.js`
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDeviceMode.js src/hooks/__tests__/useDeviceMode.test.js package.json package-lock.json
git commit -m "feat(hooks): add useDeviceMode for mobile/desktop branching

matchMedia('(pointer: coarse)') is the most reliable input-modality
detector — correctly classifies iPhones, iPads, hybrid devices.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.2: Implement the Stage route — QR + waiting state

**Files:** Create `src/phases/Stage.jsx`

The Stage is the desktop's view of the session. It shows:
1. QR code + session ID until phone connects
2. "Phone connected — rite in progress" ambient while phone is in phases 0–7
3. Cosmos canvas once phone enters Orchestra (phase 8)

Step 5 wires (1) and (2). Step 7 wires (3) using the cosmos canvas.

- [ ] **Step 1: Create `src/phases/Stage.jsx`**

```jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import RelayClient from '../lib/relayClient.js'
import { generateSessionId } from '../lib/sessionId.js'

/**
 * Stage — desktop landing for QR-paired conducting sessions.
 *
 * Three states:
 *   'waiting'  — QR code visible, no conductor connected
 *   'rite'     — phone connected, in phases 0..7 (pre-orchestra)
 *   'orchestra' — phone in Orchestra phase, cosmos canvas active (Step 7 wires this)
 */
export default function Stage() {
  const [stage, setStage] = useState('waiting')
  const sessionId = useMemo(() => generateSessionId(), [])
  const relayRef = useRef(null)
  // Latest conductor phase tracked in a ref — needed by onMessage callback
  // which closes over the initial render's state. State is for rendering;
  // ref is for the closure's latest-value reads.
  const conductorPhaseRef = useRef(null)

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_RELAY_URL || 'wss://localhost:8443'
    const client = new RelayClient({
      baseUrl,
      sessionId,
      role: 'viewer',
      onMessage: (msg) => {
        if (!msg || typeof msg !== 'object') return
        if (msg.type === 'phase') {
          conductorPhaseRef.current = msg.phase
          setStage(msg.phase === 'orchestra' ? 'orchestra' : 'rite')
        } else if (msg.type === 'conductor:lost') {
          setStage('waiting')
          conductorPhaseRef.current = null
        } else if (msg.type === 'conductor:resumed') {
          // Re-derive stage from last known conductor phase via the ref
          // (NOT the stale state captured at first render).
          setStage(conductorPhaseRef.current === 'orchestra' ? 'orchestra' : 'rite')
        } else if (msg.type === 'session:end') {
          // Normal rite completion — return to waiting state.
          setStage('waiting')
          conductorPhaseRef.current = null
        }
      },
    })
    client.start()
    relayRef.current = client
    return () => client.stop()
  }, [sessionId])

  const joinUrl = useMemo(() => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://post-listner.com'
    return `${origin}/?s=${sessionId}`
  }, [sessionId])

  return (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{ background: '#F2EBD8' }}
    >
      <AnimatePresence mode="wait">
        {stage === 'waiting' && (
          <motion.div
            key="waiting"
            className="flex flex-col items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p
              className="font-serif italic"
              style={{
                fontSize: '28px',
                color: '#1C1814',
                marginBottom: 32,
                letterSpacing: '0.01em',
              }}
            >
              scan with your phone
            </p>
            <div
              style={{
                padding: 24,
                background: '#FFFFFF',
                borderRadius: 4,
                boxShadow: '0 8px 32px rgba(28, 24, 20, 0.08)',
              }}
            >
              <QRCodeSVG
                value={joinUrl}
                size={280}
                bgColor="#FFFFFF"
                fgColor="#1C1814"
                level="M"
              />
            </div>
            <p
              className="font-mono"
              style={{
                fontSize: '13px',
                color: '#1C1814',
                opacity: 0.55,
                marginTop: 32,
                letterSpacing: '0.08em',
              }}
            >
              {sessionId}
            </p>
          </motion.div>
        )}

        {stage === 'rite' && (
          <motion.div
            key="rite"
            className="flex flex-col items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          >
            <motion.div
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 12, height: 12, borderRadius: '50%',
                background: '#1C1814',
                marginBottom: 24,
              }}
            />
            <p
              className="font-serif italic"
              style={{ fontSize: '22px', color: '#1C1814', opacity: 0.7 }}
            >
              your conductor is in the rite
            </p>
          </motion.div>
        )}

        {stage === 'orchestra' && (
          <motion.div
            key="orchestra"
            className="h-full w-full flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
          >
            <p
              className="font-serif italic"
              style={{ fontSize: '20px', color: '#1C1814', opacity: 0.6 }}
            >
              (cosmos canvas — Step 7 wires this)
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds**

```bash
npm run build
```
Expected: clean build. Stage isn't routed yet (Task 5.3 wires it into main.jsx) but it must compile.

- [ ] **Step 3: Commit**

```bash
git add src/phases/Stage.jsx
git commit -m "feat(stage): add desktop Stage route — QR + waiting + orchestra placeholder

Three states: 'waiting' (QR code + session ID), 'rite' (phone in
phases 0-7, ambient breath visual), 'orchestra' (cosmos placeholder for
Step 7). Joins the relay as 'viewer'. Listens for {type:'phase'} +
{type:'conductor:lost|resumed'} from the relay.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.3: Wire device detection + Stage into `src/main.jsx`

**Files:** `src/main.jsx`

- [ ] **Step 1: Update `src/main.jsx`**

```js
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Stage from './phases/Stage.jsx'
import ConductorView from './conductor/ConductorView.jsx'
import ConductCodex from './conductor-codex/ConductCodex.jsx'
import ConductGlb from './conductor-glb/ConductGlb.jsx'

const ROUTES = {
  '/conduct': ConductorView,
  '/conduct-codex': ConductCodex,
  '/conduct-glb': ConductGlb,
}

// Device + session detection at the root:
//   1. Explicit /conduct-* routes → existing dev/experimental views
//   2. Desktop with no ?s= param → Stage (QR pairing screen)
//   3. Desktop with ?s= or mobile with ?s= → App (existing rite, possibly session-joined)
//   4. Mobile without ?s= → App (existing solo experience, no desktop)
function pickRoot() {
  const explicit = ROUTES[window.location.pathname]
  if (explicit) return explicit

  const isDesktop = !window.matchMedia('(pointer: coarse)').matches
  const hasSession = new URLSearchParams(window.location.search).has('s')

  if (isDesktop && !hasSession) return Stage
  return App
}

const Root = pickRoot()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

In desktop browser: navigate to `https://localhost:5173/` → should show the Stage (QR code visible).
Refresh with `https://localhost:5173/?s=ABCD1234` → should show the App (existing rite).
On iPhone: `https://<lan-ip>:5173/` → should show the App (solo, no desktop).
On iPhone: `https://<lan-ip>:5173/?s=ABCD1234` → should show the App (rite, session-joined — wiring in Step 6).

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat(routing): Stage on desktop, App on mobile / session-joined

Root-level routing decision:
  - /conduct, /conduct-codex, /conduct-glb → explicit dev routes
  - Desktop without ?s= → Stage (QR pairing)
  - Anything with ?s= → App (rite)
  - Mobile without ?s= → App (existing solo experience)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Step 6 — Phone-side session join + phase signaling

### Task 6.1: App reads `?s=` param and creates RelayClient

**Files:** `src/App.jsx`

- [ ] **Step 1: Read the current App.jsx top portion**

We need to know where to inject the relay client. Approximate current location is at the top of the `App()` component.

- [ ] **Step 2: Add the relay client + phase emit at the top of App()**

Find the start of the `App()` function in `src/App.jsx`. Right after the `const [phase, setPhase] = useState(...)` and `const [sessionData, setSessionData] = useState({})` lines, add:

```js
  // ─── Relay client (only active when ?s= is present and we're paired) ────
  const relayRef = useRef(null)
  const sessionIdRef = useRef(null)
  // Tracks the current phase so the relay's onOpen callback can emit it
  // immediately (the relay opens async, so the first phase change may have
  // happened before the socket is ready).
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // Tracks whether we've been in 'orchestra' this session so we can detect
  // the "completed and looped back to entry" terminal transition and emit
  // session:end to the relay.
  const sawOrchestraRef = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('s')
    if (!s) return  // solo mode, no relay

    // Lazy-load RelayClient + isValidSessionId so the solo path doesn't pay the cost
    import('./lib/relayClient.js').then(({ default: RelayClient }) => {
      import('./lib/sessionId.js').then(({ isValidSessionId }) => {
        if (!isValidSessionId(s)) return
        sessionIdRef.current = s

        const baseUrl = import.meta.env.VITE_RELAY_URL || 'wss://localhost:8443'
        const client = new RelayClient({
          baseUrl,
          sessionId: s,
          role: 'conductor',
          onOpen: () => {
            // Send the current phase immediately on (re)connect — the very
            // first phase change may have happened before the socket opened,
            // and reconnects need to re-sync viewers to current state.
            console.log(`[relay] paired to session ${s}`)
            client.send({ type: 'phase', phase: phaseRef.current })
          },
        })
        client.start()
        relayRef.current = client
      })
    })

    return () => {
      if (relayRef.current) relayRef.current.stop()
    }
  }, [])

  // Emit phase changes to the relay so the Stage can update its UI.
  // Also detect rite completion (orchestra → entry transition) and emit
  // session:end so viewers return to their waiting state cleanly.
  useEffect(() => {
    if (!relayRef.current) return
    if (phase === 'orchestra') sawOrchestraRef.current = true
    relayRef.current.send({ type: 'phase', phase })
    if (phase === 'entry' && sawOrchestraRef.current) {
      relayRef.current.send({ type: 'session:end' })
      sawOrchestraRef.current = false
    }
  }, [phase])
```

`useEffect` and `useRef` are already imported at the top of App.jsx — no new imports needed.

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Open two browser windows:
1. Desktop: `https://localhost:5173/` — see Stage with QR code. Note the session ID displayed (e.g. `ABCD1234`).
2. Phone (use Chrome devtools mobile emulation, or a real phone): `https://localhost:5173/?s=ABCD1234`.
3. As you progress through phases on the phone, the desktop's Stage should transition from "waiting" → "rite" (when phone phase ≠ orchestra).
4. Reach Orchestra on the phone — desktop should show the "(cosmos canvas — Step 7 wires this)" placeholder.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): join relay as conductor when ?s= is present; emit phase changes

App now reads the session ID from the URL on mount. If present + valid,
creates a RelayClient as 'conductor' and emits {type:'phase'} on every
phase transition. The current phase is also emitted in onOpen so the very
first phase isn't lost to the async socket connect. On rite completion
(orchestra → entry transition), emits {type:'session:end'} so viewers
return to their waiting state cleanly.

Solo path (no ?s=) pays no overhead — RelayClient is lazy-imported.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Step 7 — Cosmos canvas integration

### Task 7.1: Phone sends FFT samples during Orchestra phase

**Files:** `src/phases/Orchestra.jsx`

- [ ] **Step 1: Add FFT extraction + relay send to the Orchestra rAF loop**

The current Orchestra component has a `tick(timestamp)` function inside `handleBriefingComplete` (around line 164). Inside that function, we need to:
1. Get the AudioContext + create an AnalyserNode tap if not already created
2. Read frequency data every ~30fps
3. Send via the relay (which lives in App.jsx — we need to pass it down, or re-read it from a context, or send via a global event)

Easiest: pass a `relayClient` prop down to Orchestra. Update the props in App.jsx where `<Orchestra ... />` is rendered:

In `src/App.jsx`, find the line:
```js
orchestra: <Orchestra avd={avdEngine} revealAudioRef={revealAudioRef} goToPhase={goToPhase} getAudioCtx={getAudioCtx} />,
```

Change to:
```js
orchestra: <Orchestra avd={avdEngine} revealAudioRef={revealAudioRef} goToPhase={goToPhase} getAudioCtx={getAudioCtx} relayRef={relayRef} />,
```

(`relayRef` is the same ref we created in Task 6.1.)

- [ ] **Step 2: Modify `src/phases/Orchestra.jsx` to set up AnalyserNode + emit FFT**

In Orchestra.jsx, add `relayRef` to the props destructure on line 17:

```js
export default function Orchestra({ avd, revealAudioRef, goToPhase, getAudioCtx, relayRef }) {
```

In the `handleBriefingComplete` callback, right after the line `if (conducting) conducting.start()`, add:

```js
    // Set up an AnalyserNode tap for sharing audio with desktop viewers via WS.
    const analyserNode = audioCtxRef.current.createAnalyser()
    analyserNode.fftSize = 256  // → 128 frequency bins
    analyserNode.smoothingTimeConstant = 0.8
    // Tap the directBus (the engine's pre-compressor sum). connecting an analyser
    // doesn't affect the audio path — analyser is a passthrough on its output side.
    if (engine.directBus) engine.directBus.connect(analyserNode)
    const freqBuf = new Uint8Array(analyserNode.frequencyBinCount)
    let lastFftSent = 0
```

Then inside the existing `tick(timestamp)` function, near the `engine.tick(t, songDuration)` line, add the FFT emit:

```js
      // Stream FFT samples to viewers at ~30 fps (33ms cadence)
      if (relayRef?.current && timestamp - lastFftSent > 33) {
        analyserNode.getByteFrequencyData(freqBuf)
        relayRef.current.send({
          type: 'audio',
          freq: Array.from(freqBuf),  // 128 numbers, 0..255
        })
        lastFftSent = timestamp
      }
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```
Open desktop + phone as before. When phone reaches Orchestra phase:
- Open desktop devtools → Network → WS → find the relay connection → inspect frames. You should see `{"type":"audio","freq":[...]}` messages arriving at ~30 Hz.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/phases/Orchestra.jsx
git commit -m "feat(orchestra): stream FFT samples to relay during Throne phase

Orchestra creates an AnalyserNode tap on directBus, reads frequencyBinCount
(128 bins from fftSize 256) at 30Hz, sends {type:'audio',freq:[...]} via
the relay client. Desktop viewers can drive their own visualization without
needing to play the audio themselves — guarantees what user hears matches
what desktop visualizes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7.2: Cosmos canvas component consumes WS audio + gesture

**Files:**
- Create: `src/phases/StageCosmos.jsx` — thin wrapper that adapts /conduct-glb's canvas for WS-driven audio

The existing `ConductorCelestialField` consumes:
- `usePhone()` for gesture data — already works via `usePhoneConductor(sessionId)`
- `useAmbientAudio()` for FFT data via `audio.freqDataRef` — needs replacement with WS-driven data

We'll create a new adapter component that wraps `ConductorCelestialField` but feeds it WS-sourced FFT instead of local audio.

- [ ] **Step 0: INSPECT before refactoring (Codex flagged: scope risk)**

Before touching anything, run:

```bash
grep -n "usePhone\|PhoneContext" src/conductor-glb/ConductorCelestialField.jsx src/conductor-glb/ConductGlb.jsx
grep -rn "PhoneContext\|usePhone" src/ --include="*.jsx" --include="*.js"
```

This tells you:
1. How many call sites in `ConductorCelestialField` read `usePhone()` (likely 1 — at the top — but verify).
2. Whether anything outside `ConductGlb.jsx` consumes `PhoneContext` (it shouldn't, but verify).
3. Whether `ConductorCelestialField` has child components that also call `usePhone()` (those would need to be refactored too, or the refactor needs a different approach — e.g. exporting `PhoneContext` from a shared module instead).

If the inspection reveals more than ~3 call sites or context consumers outside the route file, **stop and escalate** — the prop refactor scales linearly with call sites. The alternative (extract `PhoneContext` to its own module, import from both `ConductGlb` and `StageCosmos`) is then the right move. Pick the path that touches fewer call sites.

- [ ] **Step 1: Read the existing `useAmbientAudio` shape**

Find: `src/conductor-glb/useAmbientAudio.js` — returns `{ needsGesture, playing, error, tryStart, pause, pollFrequency, freqDataRef }`. The relevant bits are `freqDataRef` (a `useRef` to a `Uint8Array(128)`).

`ConductorCelestialField` only reads `audio.freqDataRef`. The other fields are for the local audio control UI.

- [ ] **Step 2: Create `src/phases/StageCosmos.jsx`**

```jsx
import { useRef, useEffect } from 'react'
import ConductorCelestialField from '../conductor-glb/ConductorCelestialField'
import { usePhoneConductor } from '../conductor-codex/usePhoneConductor'

/**
 * StageCosmos — desktop cosmos canvas driven by WS-streamed phone signals.
 *
 * Replaces /conduct-glb's local-MP3 + AnalyserNode + usePhoneConductor with:
 *   - WS-sourced FFT (passed in via prop from Stage)
 *   - WS-sourced gesture data via usePhoneConductor(sessionId)
 *
 * The ConductorCelestialField only reads {freqDataRef: {current: Uint8Array(128)}}
 * for audio, so we synthesize a matching shape.
 */
export default function StageCosmos({ sessionId, latestFreq }) {
  const freqDataRef = useRef(new Uint8Array(128))

  useEffect(() => {
    if (latestFreq && latestFreq.length === 128) {
      freqDataRef.current.set(latestFreq)
    }
  }, [latestFreq])

  const phone = usePhoneConductor(sessionId)

  return (
    <ConductorCelestialField
      audio={{ freqDataRef, playing: true, needsGesture: false }}
      phone={phone}
    />
  )
}
```

- [ ] **Step 3: Verify ConductorCelestialField accepts the audio + phone shapes**

```bash
grep -n "audio\.\|phone\." src/conductor-glb/ConductorCelestialField.jsx | head -10
```
You'll see how it reads `audio.freqDataRef`, `phone.snapshot.controls`, etc. If the existing component reads from React context (via `usePhone()` and similar) instead of props, you'll need to adapt. Specifically:

Look at `src/conductor-glb/ConductGlb.jsx` — it sets up a `PhoneProvider` and `usePhone()` context. `ConductorCelestialField` reads from that context. Replicate the context provider pattern in `StageCosmos` instead:

```jsx
import { useRef, useEffect, createContext, useContext } from 'react'
import ConductorCelestialField from '../conductor-glb/ConductorCelestialField'
import { usePhoneConductor } from '../conductor-codex/usePhoneConductor'

// Phone context shape that ConductorCelestialField expects (see ConductGlb.jsx)
const PhoneContext = createContext(null)
export function usePhoneFromStage() {
  const ctx = useContext(PhoneContext)
  if (!ctx) throw new Error('usePhoneFromStage outside StageCosmos')
  return ctx
}

export default function StageCosmos({ sessionId, latestFreq }) {
  const freqDataRef = useRef(new Uint8Array(128))

  useEffect(() => {
    if (latestFreq && latestFreq.length === 128) {
      freqDataRef.current.set(latestFreq)
    }
  }, [latestFreq])

  const phone = usePhoneConductor(sessionId)
  const audio = { freqDataRef, playing: true, needsGesture: false }

  return (
    <PhoneContext.Provider value={phone}>
      <ConductorCelestialField audio={audio} />
    </PhoneContext.Provider>
  )
}
```

**Note:** if `ConductorCelestialField` imports `usePhone` from `ConductGlb.jsx`, you'll need to either (a) refactor `ConductorCelestialField` to take `phone` as a prop, or (b) export a shared `PhoneContext` from a common module. Option (a) is cleaner — make the refactor as part of this step:

In `src/conductor-glb/ConductorCelestialField.jsx`: change the `usePhone()` import line at the top from `import { usePhone } from './ConductGlb'` to take `phone` from props:

```jsx
export default function ConductorCelestialField({ audio, phone }) {
  // ... use `phone` directly instead of `const phone = usePhone()`
```

Then in `ConductGlb.jsx`, pass `phone` as a prop:
```jsx
const phone = usePhoneConductor('DEV00000')
return <ConductorCelestialField audio={audio} phone={phone} />
```

And in `StageCosmos.jsx`, pass `phone` directly — no PhoneContext needed:

```jsx
export default function StageCosmos({ sessionId, latestFreq }) {
  const freqDataRef = useRef(new Uint8Array(128))
  useEffect(() => {
    if (latestFreq && latestFreq.length === 128) {
      freqDataRef.current.set(latestFreq)
    }
  }, [latestFreq])
  const phone = usePhoneConductor(sessionId)
  const audio = { freqDataRef, playing: true, needsGesture: false }
  return <ConductorCelestialField audio={audio} phone={phone} />
}
```

- [ ] **Step 4: Build to verify nothing's broken**

```bash
npm run build
```
Expected: clean build. The /conduct-glb route still works because we kept the prop-based pattern in ConductorCelestialField + ConductGlb.

- [ ] **Step 5: Commit**

```bash
git add src/phases/StageCosmos.jsx src/conductor-glb/ConductorCelestialField.jsx src/conductor-glb/ConductGlb.jsx
git commit -m "refactor(conductor-glb): pass phone as prop instead of context

Frees ConductorCelestialField from coupling to ConductGlb.jsx so it can be
reused by StageCosmos with WS-driven phone + FFT data.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7.3: Wire StageCosmos into Stage's 'orchestra' branch

**Files:** `src/phases/Stage.jsx`

- [ ] **Step 1: Update Stage.jsx to track latest FFT + render StageCosmos**

At the top, add `StageCosmos` import:
```jsx
import StageCosmos from './StageCosmos.jsx'
```

Add state for latest FFT samples in the Stage component:
```jsx
  const [latestFreq, setLatestFreq] = useState(null)
```

In the existing `onMessage` callback inside the `useEffect`, add handling for `audio` messages:
```jsx
        } else if (msg.type === 'audio' && Array.isArray(msg.freq)) {
          setLatestFreq(msg.freq)
        }
```

Replace the placeholder content of the `'orchestra'` branch:

```jsx
        {stage === 'orchestra' && (
          <motion.div
            key="orchestra"
            className="h-full w-full"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
          >
            <StageCosmos sessionId={sessionId} latestFreq={latestFreq} />
          </motion.div>
        )}
```

- [ ] **Step 2: Smoke-test in browser**

```bash
npm run dev
```

1. Desktop: open `https://localhost:5173/` → see QR
2. Phone: scan QR, complete rite, reach Orchestra phase
3. Once phone enters Orchestra, desktop transitions to the cosmos canvas
4. Phone gestures should produce visible cursor + star activation on desktop
5. Bass beats in the song should pulse the Metatron geometry on desktop

- [ ] **Step 3: Commit**

```bash
git add src/phases/Stage.jsx
git commit -m "feat(stage): render StageCosmos when conductor enters Orchestra phase

Stage now tracks latest FFT samples from {type:'audio'} messages and
passes them to StageCosmos. Cosmos canvas reacts to both gesture data
(via usePhoneConductor) and audio FFT (via the WS-relayed freq array).
No local audio playback on desktop — perfectly synced to what phone plays.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Step 8 — End-to-end smoke test + docs

### Task 8.1: Production smoke test

**Files:** none

Prerequisite: push to main, Vercel auto-deploys.

- [ ] **Step 1: Verify Vercel preview/prod deploy completed**

After `git push origin <branch>`, check Vercel dashboard for deploy status.

- [ ] **Step 2: Open prod URL on desktop**

On a real desktop computer (NOT mobile emulation): visit `https://post-listner.vercel.app/`. Should see the Stage with QR code.

- [ ] **Step 3: Scan QR with phone**

Use any QR scanner app on iPhone/Android. Should open `https://post-listner.vercel.app/?s=<ID>`.

- [ ] **Step 4: Walk through the full rite + conducting**

Verify:
- [ ] Phone shows the existing rite (entry → spectrum → ... → reveal → orchestra)
- [ ] Desktop transitions to "your conductor is in the rite" when phone starts
- [ ] Desktop transitions to cosmos canvas when phone reaches Orchestra
- [ ] Phone gestures visible on desktop cosmos
- [ ] Audio FFT visible on desktop cosmos (bass beats pulse Metatron geometry)
- [ ] Closing card on phone → desktop returns to "waiting" state

- [ ] **Step 5: Multi-viewer test**

Open a SECOND desktop browser to `https://post-listner.vercel.app/?s=<same-ID>`. The session ID has to match — paste the URL from the first desktop. Both desktops should show the same canvas.

- [ ] **Step 6: Reconnect test**

While conducting, briefly toggle phone airplane mode (5 seconds). Desktop should NOT show "conductor lost" if reconnect is within 5s. Toggle off — conducting resumes.

Toggle airplane mode for >10s. Desktop should show whatever the `{type:'conductor:lost'}` UI is — in v1 just returning to "waiting" is fine.

- [ ] **Step 7: No commit (verification only)**

---

### Task 8.2: Update CLAUDE.md

**Files:** `CLAUDE.md`

- [ ] **Step 1: Document the relay infrastructure**

Find the "Architecture" section in CLAUDE.md. Add a new subsection after the existing Audio + Orchestra ones:

```markdown
### QR-paired desktop canvas (added 2026-05-13)

Optional flow: desktop visitor sees a QR code, scans with phone, runs the rite on phone, desktop becomes the cosmos canvas during Orchestra.

- **Routing**: `src/main.jsx` picks the root at runtime — desktop without `?s=` → `Stage`; everything else → `App`.
- **Session ID**: 8-char Crockford base32 from `src/lib/sessionId.js`, generated client-side on desktop, embedded in QR URL.
- **Relay**: Cloudflare Worker + Durable Object at `relay.post-listner.com`. One DO instance per session. Conductor messages broadcast to all viewers. Local dev uses `conduct-relay/server.cjs` at `wss://localhost:8443` with the same protocol.
- **WS protocol**: see `src/lib/relayProtocol.js`. 4 message types: `hello`, `gesture`, `phase`, `audio`.
- **Phone bundle**: `conduct-relay/src/phone.js` builds via esbuild to `conduct-relay/public/phone.bundle.js` and imports `GestureCore` + `RelayClient` from the main project. Session ID via `?s=` URL param.
- **Cosmos audio**: phone sends FFT samples at 30Hz over WS during Orchestra phase. Desktop reads them into a `Uint8Array(128)` and feeds the existing `ConductorCelestialField` canvas as if it were a local AnalyserNode.
```

Also add a row to the Environment vars table:

```markdown
| `VITE_RELAY_URL` | Runtime (`relayClient.js`, `phone.js`) | WebSocket relay endpoint. Dev: `wss://localhost:8443`. Prod: `wss://relay.post-listner.com`. |
```

- [ ] **Step 2: Document the new commands**

In the "Commands" section, add:

```bash
cd relay && npm run dev               # Run Cloudflare Worker locally (wrangler dev)
cd relay && npm run deploy            # Deploy Worker to prod
cd relay && npm run tail              # Live-tail Worker logs
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document QR-paired desktop canvas infrastructure

New section on the relay (Cloudflare Worker + DO), session ID protocol,
phone bundle integration, and cosmos audio streaming. Adds VITE_RELAY_URL
to the env vars table and the wrangler commands to the script reference.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Verification checklist (end of plan)

Run through these once everything is committed:

- [ ] `npm test` — all tests pass (200+ total, +18 new tests for session/protocol/device hook)
- [ ] `npm run lint` — clean
- [ ] `npm run build` — clean
- [ ] `cd relay && npx wrangler deploy` — succeeds
- [ ] `curl https://relay.post-listner.com/healthz` → 200 ok
- [ ] Desktop `https://post-listner.vercel.app/` shows Stage with QR
- [ ] Phone scans QR → opens app with session
- [ ] Phone in Orchestra phase → desktop shows cosmos canvas
- [ ] Two desktops with same session ID both show synced cosmos
- [ ] Conductor offline > 5s → viewers see "waiting" again

## Rollback procedure

If something breaks in production:

1. **Revert the relay deploy** — `cd relay && npx wrangler rollback` (rolls to previous deployment)
2. **Revert the Vercel deploy** — promote the previous deployment in the Vercel dashboard
3. **Hot-fix flag**: set `VITE_RELAY_URL=` (empty) in Vercel — `RelayClient` will fail to construct URLs and Stage/App fall back to solo mode

Solo phone mode (no `?s=`) is unaffected by this entire feature; only the QR-paired flow needs the relay. If the relay is down, the solo experience continues to work.
