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
