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
