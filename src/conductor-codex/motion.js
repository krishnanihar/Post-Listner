export const RELAY_URL = 'wss://localhost:8443/?role=desktop'

const DEFAULT_CONTROLS = {
  pitch: 0,
  roll: 0,
  yaw: 0,
  energy: 0.08,
  articulation: 0,
  downbeatIntensity: 0,
  lastDownbeatAt: 0,
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function clamp(value, min, max) {
  if (!finiteNumber(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function shortAngleDegrees(value) {
  if (!finiteNumber(value)) return 0
  return ((((value + 180) % 360) + 360) % 360) - 180
}

function normalizedQuat(q) {
  if (!Array.isArray(q) || q.length < 4) return null
  const x = Number(q[0])
  const y = Number(q[1])
  const z = Number(q[2])
  const w = Number(q[3])
  if (![x, y, z, w].every(Number.isFinite)) return null

  const length = Math.hypot(x, y, z, w)
  if (length < 0.00001) return null
  return [x / length, y / length, z / length, w / length]
}

function sanitizedRaw(raw) {
  if (!raw || typeof raw !== 'object') return null
  const alpha = Number(raw.alpha)
  const beta = Number(raw.beta)
  const gamma = Number(raw.gamma)
  if (![alpha, beta, gamma].every(Number.isFinite)) return null
  return { alpha, beta, gamma }
}

function readDownbeat(message) {
  const downbeat = message.downbeat
  if (downbeat === true) return 1
  if (typeof downbeat === 'number') return clamp(downbeat, 0, 1)
  if (downbeat && typeof downbeat === 'object') {
    if (downbeat.fired === false) return 0
    if (downbeat.fired || finiteNumber(downbeat.intensity)) {
      return clamp(downbeat.intensity ?? 0.85, 0.25, 1)
    }
  }
  return 0
}

function isNearRest(q) {
  return q && Math.abs(q[0]) + Math.abs(q[1]) + Math.abs(q[2]) < 0.08
}

export function createConductorState() {
  return {
    controls: { ...DEFAULT_CONTROLS },
    connected: false,
    status: 'idle',
    messageCount: 0,
    lastMessageAt: 0,
    lastType: 'none',
    calibrated: false,
    rawZero: null,
    lastError: '',
  }
}

export function mapRelayMessage(message, rawZero) {
  const q = normalizedQuat(message.q)
  const raw = sanitizedRaw(message.raw)
  let nextRawZero = rawZero

  if (raw && (!nextRawZero || (message.calibrated && isNearRest(q)))) {
    nextRawZero = raw
  }

  const qPitch = q ? clamp(-q[0] * 3.85, -1, 1) : 0
  const qLateral = q ? clamp(q[1] * 3.85, -1, 1) : 0

  let pitch = qPitch
  let roll = qLateral
  let yaw = 0

  if (raw && nextRawZero) {
    const betaDelta = raw.beta - nextRawZero.beta
    const gammaDelta = raw.gamma - nextRawZero.gamma
    const alphaDelta = shortAngleDegrees(raw.alpha - nextRawZero.alpha)

    const rawPitchActive = Math.abs(betaDelta) > 0.75
    const rawRollActive = Math.abs(gammaDelta) > 0.75
    const rawYawActive = Math.abs(alphaDelta) > 0.75

    if (rawPitchActive) pitch = clamp(-betaDelta / 30, -1, 1)
    if (rawRollActive) roll = clamp(gammaDelta / 30, -1, 1)
    if (rawYawActive) {
      yaw = clamp(alphaDelta / 35, -1, 1)
      if (!rawRollActive) roll = 0
    }
  }

  return {
    rawZero: nextRawZero,
    controls: {
      pitch,
      roll,
      yaw,
      energy: clamp(message.gestureGain ?? 0.08, 0, 1),
      articulation: clamp(message.articulation ?? 0, 0, 1),
    },
    downbeatIntensity: readDownbeat(message),
    calibrated: Boolean(message.calibrated),
  }
}

export function applyRelayMessage(state, message, now = performance.now()) {
  const mapped = mapRelayMessage(message, state.rawZero)

  state.rawZero = mapped.rawZero
  state.connected = true
  state.status = 'connected'
  state.messageCount += 1
  state.lastMessageAt = now
  state.lastType = message.type || 'message'
  state.calibrated = mapped.calibrated
  state.lastError = ''

  Object.assign(state.controls, mapped.controls)

  if (mapped.downbeatIntensity > 0) {
    state.controls.downbeatIntensity = mapped.downbeatIntensity
    state.controls.lastDownbeatAt = now
  }
}

export function snapshotFromState(state, now = performance.now()) {
  return {
    controls: { ...state.controls },
    connected: state.connected,
    status: state.status,
    messageCount: state.messageCount,
    lastMessageAgeMs: state.lastMessageAt ? now - state.lastMessageAt : Infinity,
    lastType: state.lastType,
    calibrated: state.calibrated,
    lastError: state.lastError,
  }
}
