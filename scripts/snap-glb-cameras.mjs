// Capture /conduct-glb at two camera angles for comparison.
// Mutates the live camera via window.__conductGlbCamera (exposed in dev).
import { chromium } from 'playwright'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const URL = 'http://localhost:5173/conduct-glb'
const OUT = path.resolve(process.cwd(), 'tmp/conduct-glb-cameras')
try { rmSync(OUT, { recursive: true, force: true }) } catch {}
mkdirSync(OUT, { recursive: true })

const POSES = [
  { label: 'rest',         alpha: 0, beta: 0,   gamma: 0   },
  { label: 'pitch-fwd',    alpha: 0, beta: -25, gamma: 0   },
  { label: 'pitch-back',   alpha: 0, beta: +25, gamma: 0   },
  { label: 'roll-right',   alpha: 0, beta: 0,   gamma: +25 },
  { label: 'roll-left',    alpha: 0, beta: 0,   gamma: -25 },
  { label: 'fwd-right',    alpha: 0, beta: -20, gamma: +20 },
]

const CAMERAS = [
  { label: 'A-back',   pos: [0,    1.55, 1.5], lookAt: [0, 1.55, 0] },
  { label: 'B-3quart', pos: [1.15, 1.55, 1.2], lookAt: [0, 1.45, 0] },
]

function qFromEulerZXY(aDeg, bDeg, gDeg) {
  const D = Math.PI / 180
  const a = aDeg * D / 2, b = bDeg * D / 2, g = gDeg * D / 2
  const cZ = Math.cos(a), sZ = Math.sin(a)
  const cX = Math.cos(b), sX = Math.sin(b)
  const cY = Math.cos(g), sY = Math.sin(g)
  return [cZ*sX*cY - sZ*cX*sY, sZ*sX*cY + cZ*cX*sY, sZ*cX*cY + cZ*sX*sY, cZ*cX*cY - sZ*sX*sY]
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 } })
const page = await ctx.newPage()
let ws = null
await page.routeWebSocket(/^wss:\/\//, w => { ws = w })
page.on('pageerror', err => console.log('[pageerror]', err.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)

// Calibrate at rest.
for (let i = 0; i < 20; i++) {
  if (ws) ws.send(JSON.stringify({ type: 'orientation',
    q: qFromEulerZXY(0, 0, 0), raw: { alpha: 0, beta: 0, gamma: 0 },
    calibrated: true, t: performance.now() }))
  await page.waitForTimeout(20)
}

for (const cam of CAMERAS) {
  await page.evaluate(({ pos, lookAt }) => {
    if (window.__conductGlbCamera) {
      window.__conductGlbCamera.position.set(pos[0], pos[1], pos[2])
      window.__conductGlbCamera.lookAt(lookAt[0], lookAt[1], lookAt[2])
    }
  }, cam)
  await page.waitForTimeout(150)

  for (const pose of POSES) {
    const q = qFromEulerZXY(pose.alpha, pose.beta, pose.gamma)
    for (let i = 0; i < 24; i++) {
      if (ws) ws.send(JSON.stringify({ type: 'orientation', q,
        raw: { alpha: pose.alpha, beta: pose.beta, gamma: pose.gamma },
        calibrated: true, t: performance.now() }))
      await page.waitForTimeout(16)
    }
    const file = path.join(OUT, `${cam.label}-${pose.label}.png`)
    await page.screenshot({ path: file })
    console.log('saved', file)
  }
}

await browser.close()
