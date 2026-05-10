// Visual test: opens /conduct in headless chromium, injects fake phone
// orientation messages by intercepting the WebSocket, and saves
// screenshots showing the conductor figure at rest + responding to known
// gesture quaternions.
//
// Run: node scripts/visual-conductor-test.mjs
// Output: tmp/conductor-screens/*.png

import { chromium } from 'playwright'
import path from 'node:path'
import { mkdirSync } from 'node:fs'

const URL = 'http://localhost:5174/conduct'
const OUT_DIR = path.resolve(process.cwd(), 'tmp/conductor-screens')
mkdirSync(OUT_DIR, { recursive: true })

const DEG = Math.PI / 180

// Same ZXY composition phone.js uses, copied here so we can synthesize
// realistic phone quaternions in the test.
function quatFromEulerZXY(aDeg, bDeg, gDeg) {
  const a = (aDeg || 0) * DEG, b = (bDeg || 0) * DEG, g = (gDeg || 0) * DEG
  const cZ = Math.cos(a / 2), sZ = Math.sin(a / 2)
  const cX = Math.cos(b / 2), sX = Math.sin(b / 2)
  const cY = Math.cos(g / 2), sY = Math.sin(g / 2)
  return [
    cZ * sX * cY - sZ * cX * sY,
    sZ * sX * cY + cZ * cX * sY,
    sZ * cX * cY + cZ * sX * sY,
    cZ * cX * cY - sZ * sX * sY,
  ]
}

function quatMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}

function quatConj(q) { return [-q[0], -q[1], -q[2], q[3]] }

// Phone calibrated in portrait (beta=90°, alpha=0°, gamma=0°).
const Q_CAL = quatFromEulerZXY(0, 90, 0)

function syntheticPhoneRel(alphaDelta, betaDelta, gammaDelta) {
  const Q_abs = quatFromEulerZXY(alphaDelta, 90 + betaDelta, gammaDelta)
  return quatMul(quatConj(Q_CAL), Q_abs)
}

// Test poses: each one is a {label, qRel} tuple to apply via the fake WS.
const POSES = [
  { label: '01-rest',          q: syntheticPhoneRel(0, 0, 0) },
  { label: '02-tilt-forward',  q: syntheticPhoneRel(0, -30, 0) },  // beta-30 = forward
  { label: '03-tilt-back',     q: syntheticPhoneRel(0, +30, 0) },
  { label: '04-tilt-right',    q: syntheticPhoneRel(0, 0, +30) },
  { label: '05-tilt-left',     q: syntheticPhoneRel(0, 0, -30) },
  { label: '06-yaw-right',     q: syntheticPhoneRel(+30, 0, 0) },
  { label: '07-yaw-left',      q: syntheticPhoneRel(-30, 0, 0) },
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1080, height: 1080 } })
const page = await context.newPage()

// Intercept the relay WebSocket the page tries to open. Playwright's
// routeWebSocket lets us be the server.
let outboundWS = null
await page.routeWebSocket(/^wss:\/\//, ws => {
  outboundWS = ws
  // Don't connect to a real server — pretend we are it.
})

const consoleMsgs = []
page.on('console', msg => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`))
page.on('pageerror', err => consoleMsgs.push(`[pageerror] ${err.message}`))

console.log('Loading', URL)
await page.goto(URL, { waitUntil: 'networkidle' })

// Wait for the conductor scene to mount and the WebSocket to be intercepted.
const waited = await page.waitForFunction(() => !!window.__conductorBonesLogged, null, { timeout: 8000 })
  .catch(() => null)
console.log('conductorBonesLogged:', !!waited)

// At this point outboundWS should be set (the page opened a WS).
if (!outboundWS) {
  console.warn('WARNING: page never opened a WebSocket — the route did not match')
}

async function sendPhone(q, calibrated = true) {
  if (!outboundWS) return
  const msg = {
    type: 'orientation',
    q,
    raw: { alpha: 0, beta: 0, gamma: 0 },
    calibrated,
    t: performance.now(),
  }
  outboundWS.send(JSON.stringify(msg))
}

// Stream the same pose for ~600ms so the SLERP smoothing settles.
async function holdPose(q) {
  const start = Date.now()
  while (Date.now() - start < 600) {
    await sendPhone(q, true)
    await page.waitForTimeout(16)
  }
}

for (const pose of POSES) {
  await holdPose(pose.q)
  const file = path.join(OUT_DIR, `${pose.label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log('saved', file)
}

console.log('\n===== console output during test =====')
for (const m of consoleMsgs) console.log(m)

await browser.close()
console.log('\nDone. Screenshots in', OUT_DIR)
