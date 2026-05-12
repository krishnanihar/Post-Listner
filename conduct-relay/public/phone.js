const startBtn = document.getElementById('start');
const calibrateBtn = document.getElementById('calibrate');
const statusEl = document.getElementById('status');
const dataEl = document.getElementById('data');

const SEND_INTERVAL_MS = 16; // ~60Hz cap
const DEG = Math.PI / 180;

// Downbeat detection — mirrors src/orchestra/ConductingEngine.js:95-117 so
// the conductor figure responds to the same gesture model the Orchestra
// audio engine uses. Negative-Y zero-crossing with peak-magnitude scoring,
// 250ms refractory, 150ms sliding window, 2.0 m/s² threshold.
const DOWNBEAT_ACCEL_THRESHOLD = 2.0;
const DOWNBEAT_MIN_INTERVAL_MS = 250;
const DOWNBEAT_WINDOW_MS = 150;
const GESTURE_SIZE_WINDOW_MS = 2000;
const GESTURE_SIZE_RANGE = 5.0;

let ws = null;
let lastSentAt = 0;
let zeroQuat = [0, 0, 0, 1];
let lastAbsQuat = [0, 0, 0, 1];
let calibrated = false;
let hasSample = false;

// Motion / downbeat state
let prevY = 0;
let lastDownbeatTime = 0;
let yBuffer = []; // [{y, t}]
let magBuffer = []; // [{mag, t}]
let prevRms = 0;
let pendingDownbeat = null; // {fired:true, intensity, t}
let gestureGain = 0;
let articulation = 0;
let rotationRateAlpha = 0;
let rotationRateBeta = 0;
let rotationRateGamma = 0;
let rotationRateMag = 0;

function setStatus(s) {
  statusEl.textContent = s;
}

function quatFromEulerZXY(aDeg, bDeg, gDeg) {
  const a = (aDeg || 0) * DEG;
  const b = (bDeg || 0) * DEG;
  const g = (gDeg || 0) * DEG;
  const cZ = Math.cos(a / 2),
    sZ = Math.sin(a / 2);
  const cX = Math.cos(b / 2),
    sX = Math.sin(b / 2);
  const cY = Math.cos(g / 2),
    sY = Math.sin(g / 2);
  return [
    cZ * sX * cY - sZ * cX * sY,
    sZ * sX * cY + cZ * cX * sY,
    sZ * cX * cY + cZ * sX * sY,
    cZ * cX * cY - sZ * sX * sY,
  ];
}

function quatMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function quatConj(q) {
  return [-q[0], -q[1], -q[2], q[3]];
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function connectWS() {
  const url = `wss://${location.host}/?role=phone`;
  ws = new WebSocket(url);
  ws.addEventListener('open', () => setStatus('Connected. Move the phone.'));
  ws.addEventListener('close', () => setStatus('Disconnected.'));
  ws.addEventListener('error', () => setStatus('WebSocket error.'));
}

function fmt(n, w = 7, p = 2) {
  if (n == null || Number.isNaN(n)) return '   —  '.padStart(w, ' ');
  return n.toFixed(p).padStart(w, ' ');
}

function onMotion(e) {
  // Use linear acceleration if available (gravity removed), otherwise fall
  // back to acceleration-including-gravity. The downbeat detector wants the
  // gravity-free signal so a still phone reports near zero, but on browsers
  // where e.acceleration is null we tolerate the gravity bias — a typical
  // conducting downbeat is well above the gravity-baseline noise floor.
  const a = e.acceleration && e.acceleration.x != null
    ? e.acceleration
    : e.accelerationIncludingGravity || {};
  const ax = a.x || 0;
  const ay = a.y || 0;
  const az = a.z || 0;

  const rms = Math.sqrt(ax * ax + ay * ay + az * az);
  const jerk = Math.abs(rms - prevRms);
  prevRms = rms;

  const rr = e.rotationRate || {};
  rotationRateAlpha = rr.alpha || 0;
  rotationRateBeta  = rr.beta  || 0;
  rotationRateGamma = rr.gamma || 0;
  rotationRateMag = Math.hypot(rotationRateAlpha, rotationRateBeta, rotationRateGamma);

  const now = performance.now();

  // Negative-Y zero-crossing: the canonical downbeat signal — phone moving
  // down (-Y) then transitioning to up (≥0) is the ictus.
  yBuffer.push({ y: ay, t: now });
  const windowCutoff = now - DOWNBEAT_WINDOW_MS;
  while (yBuffer.length && yBuffer[0].t < windowCutoff) yBuffer.shift();

  if (prevY < 0 && ay >= 0) {
    let peakNegY = 0;
    for (let i = 0; i < yBuffer.length; i++) {
      if (yBuffer[i].y < peakNegY) peakNegY = yBuffer[i].y;
    }
    const peakMag = Math.abs(peakNegY);
    if (
      peakMag >= DOWNBEAT_ACCEL_THRESHOLD &&
      now - lastDownbeatTime >= DOWNBEAT_MIN_INTERVAL_MS
    ) {
      pendingDownbeat = {
        fired: true,
        intensity: clamp(peakMag / (DOWNBEAT_ACCEL_THRESHOLD * 3), 0, 1),
        t: now,
      };
      lastDownbeatTime = now;
      // Tactile confirmation on the phone — Personal Orchestra found
      // diegetic feedback enhances felt agency.
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(15); } catch {}
      }
    }
  }
  prevY = ay;

  // Gesture size: peak-to-peak RMS in a rolling window → 0..1.
  magBuffer.push({ mag: rms, t: now });
  const magCutoff = now - GESTURE_SIZE_WINDOW_MS;
  while (magBuffer.length && magBuffer[0].t < magCutoff) magBuffer.shift();
  let minMag = Infinity, maxMag = -Infinity;
  for (let i = 0; i < magBuffer.length; i++) {
    const m = magBuffer[i].mag;
    if (m < minMag) minMag = m;
    if (m > maxMag) maxMag = m;
  }
  gestureGain = magBuffer.length > 0
    ? clamp((maxMag - minMag) / GESTURE_SIZE_RANGE, 0, 1)
    : 0;

  // Articulation: jerk normalized to 3 m/s³.
  articulation = clamp(jerk / 3, 0, 1);
}

function onOrientation(e) {
  const q = quatFromEulerZXY(e.alpha, e.beta, e.gamma);
  lastAbsQuat = q;
  if (!hasSample) {
    hasSample = true;
    calibrateBtn.disabled = false;
  }
  const qRel = quatMul(quatConj(zeroQuat), q);

  const now = performance.now();
  if (now - lastSentAt >= SEND_INTERVAL_MS) {
    lastSentAt = now;
    const msg = {
      type: 'gesture',
      q: qRel,
      raw: { alpha: e.alpha, beta: e.beta, gamma: e.gamma },
      downbeat: pendingDownbeat,
      gestureGain,
      articulation,
      rotationRate: {
        alpha: rotationRateAlpha,
        beta: rotationRateBeta,
        gamma: rotationRateGamma,
        mag: rotationRateMag,
      },
      calibrated,
      t: now,
    };
    pendingDownbeat = null; // consume the one-shot
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  dataEl.textContent =
    `α: ${fmt(e.alpha)}°  β: ${fmt(e.beta)}°  γ: ${fmt(e.gamma)}°\n` +
    `q: [${fmt(qRel[0], 6, 3)}, ${fmt(qRel[1], 6, 3)}, ${fmt(qRel[2], 6, 3)}, ${fmt(qRel[3], 6, 3)}]\n` +
    `gain: ${fmt(gestureGain, 5, 2)}  artic: ${fmt(articulation, 5, 2)}  ` +
    `calibrated: ${calibrated ? 'yes' : 'no'}`;
}

function calibrate() {
  zeroQuat = lastAbsQuat.slice();
  calibrated = true;
  calibrateBtn.classList.add('flash');
  setTimeout(() => calibrateBtn.classList.remove('flash'), 220);
}

async function start() {
  startBtn.disabled = true;
  setStatus('Starting…');
  try {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') {
        setStatus('Permission denied.');
        startBtn.disabled = false;
        return;
      }
    }
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      try {
        const r = await DeviceMotionEvent.requestPermission();
        if (r !== 'granted') {
          setStatus('Motion permission denied — downbeats disabled.');
        }
      } catch {
        // Some browsers throw if called outside a user gesture; tolerate it.
      }
    }
    if (!('DeviceOrientationEvent' in window)) {
      setStatus('DeviceOrientationEvent not supported in this browser.');
      startBtn.disabled = false;
      return;
    }
    connectWS();
    window.addEventListener('deviceorientation', onOrientation);
    if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', onMotion);
    }
    startBtn.textContent = 'Streaming';
  } catch (err) {
    setStatus('Error: ' + (err && err.message ? err.message : String(err)));
    startBtn.disabled = false;
  }
}

startBtn.addEventListener('click', start);
calibrateBtn.addEventListener('click', calibrate);
