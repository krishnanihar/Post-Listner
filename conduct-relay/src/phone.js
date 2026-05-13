import {
  createState, processMotion, processOrientation, calibrate as coreCalibrate, read,
  activeParams,
} from '../../src/conducting/index.js'
import { quatFromEulerZXY, quatMul, quatConj } from '../../src/conducting/quaternion.js'

const startBtn = document.getElementById('start')
const calibrateBtn = document.getElementById('calibrate')
const statusEl = document.getElementById('status')
const dataEl = document.getElementById('data')

const SEND_INTERVAL_MS = 16  // ~60 Hz cap

const state = createState({ params: activeParams() })

let ws = null
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

function connectWS() {
  const url = `wss://${location.host}/?role=phone`
  ws = new WebSocket(url)
  ws.addEventListener('open',  () => setStatus('Connected. Move the phone.'))
  ws.addEventListener('close', () => setStatus('Disconnected.'))
  ws.addEventListener('error', () => setStatus('WebSocket error.'))
}

function onMotion(e) {
  processMotion(state, e, performance.now())
}

function onOrientation(e) {
  const now = performance.now()
  processOrientation(state, e, now)

  // Build absolute + relative quats for the WS payload
  const qAbs = quatFromEulerZXY(e.alpha, e.beta, e.gamma)
  lastAbsQuat = qAbs
  if (!hasSample) {
    hasSample = true
    calibrateBtn.disabled = false
  }
  const qRel = quatMul(quatConj(zeroQuat), qAbs)

  if (now - lastSentAt < SEND_INTERVAL_MS) {
    updateDataReadout(e, qRel)
    return
  }
  lastSentAt = now

  const snap = read(state, now)

  // WS message shape stays identical to the pre-refactor format so the
  // desktop motion.js decoder works unchanged.
  const msg = {
    type: 'gesture',
    q: qRel,
    raw: { alpha: e.alpha, beta: e.beta, gamma: e.gamma },
    downbeat: snap.downbeat.fired
      ? { fired: true, intensity: snap.downbeat.intensity, t: snap.downbeat.detectedAt }
      : null,
    gestureGain: snap.gestureGain,
    articulation: snap.articulation,
    rotationRate: snap.rotationRate,
    accel: snap.accel,
    calibrated,
    t: now,
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
  // Haptic on phone for downbeats (Personal Orchestra: diegetic feedback)
  if (snap.downbeat.fired && typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(15) } catch { /* tolerate denied */ }
  }
  updateDataReadout(e, qRel, snap)
}

function updateDataReadout(e, qRel, snap = null) {
  dataEl.textContent =
    `α: ${fmt(e.alpha)}°  β: ${fmt(e.beta)}°  γ: ${fmt(e.gamma)}°\n` +
    `q: [${fmt(qRel[0], 6, 3)}, ${fmt(qRel[1], 6, 3)}, ${fmt(qRel[2], 6, 3)}, ${fmt(qRel[3], 6, 3)}]\n` +
    (snap ? `gain: ${fmt(snap.gestureGain, 5, 2)}  artic: ${fmt(snap.articulation, 5, 2)}  ` : '') +
    `calibrated: ${calibrated ? 'yes' : 'no'}`
}

function calibrate() {
  zeroQuat = lastAbsQuat.slice()
  coreCalibrate(state)
  calibrated = true
  calibrateBtn.classList.add('flash')
  setTimeout(() => calibrateBtn.classList.remove('flash'), 220)
}

async function start() {
  startBtn.disabled = true
  setStatus('Starting…')
  try {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      const r = await DeviceOrientationEvent.requestPermission()
      if (r !== 'granted') {
        setStatus('Permission denied.')
        startBtn.disabled = false
        return
      }
    }
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      try {
        const r = await DeviceMotionEvent.requestPermission()
        if (r !== 'granted') {
          setStatus('Motion permission denied — downbeats disabled.')
        }
      } catch { /* tolerate */ }
    }
    if (!('DeviceOrientationEvent' in window)) {
      setStatus('DeviceOrientationEvent not supported in this browser.')
      startBtn.disabled = false
      return
    }
    connectWS()
    window.addEventListener('deviceorientation', onOrientation)
    if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', onMotion)
    }
    startBtn.textContent = 'Streaming'
  } catch (err) {
    setStatus('Error: ' + (err && err.message ? err.message : String(err)))
    startBtn.disabled = false
  }
}

startBtn.addEventListener('click', start)
calibrateBtn.addEventListener('click', calibrate)
