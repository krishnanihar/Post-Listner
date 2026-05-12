// Visual capture for /conduct-glb — sends a range of poses and saves
// screenshots so we can inspect what the figure actually looks like.
import { chromium } from 'playwright'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const URL = 'http://localhost:5173/conduct-glb'
const OUT = path.resolve(process.cwd(), 'tmp/conduct-glb-screens')
try { rmSync(OUT, { recursive: true, force: true }) } catch {}
mkdirSync(OUT, { recursive: true })

const POSES = [
  { label: '01-rest',          alpha: 0, beta: 0,    gamma: 0   },
  { label: '02-pitch-fwd-15',  alpha: 0, beta: -15,  gamma: 0   },
  { label: '03-pitch-fwd-30',  alpha: 0, beta: -30,  gamma: 0   },
  { label: '04-pitch-back-15', alpha: 0, beta: +15,  gamma: 0   },
  { label: '05-pitch-back-30', alpha: 0, beta: +30,  gamma: 0   },
  { label: '06-roll-right-15', alpha: 0, beta: 0,    gamma: +15 },
  { label: '07-roll-right-30', alpha: 0, beta: 0,    gamma: +30 },
  { label: '08-roll-left-15',  alpha: 0, beta: 0,    gamma: -15 },
  { label: '09-roll-left-30',  alpha: 0, beta: 0,    gamma: -30 },
  { label: '10-fwd-right',     alpha: 0, beta: -20,  gamma: +20 },
  { label: '11-back-left',     alpha: 0, beta: +20,  gamma: -20 },
]

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1080 } })
const page = await ctx.newPage()

let ws = null
await page.routeWebSocket(/^wss:\/\//, w => { ws = w })

page.on('console', m => {
  const text = m.text()
  if (text.startsWith('[conduct-glb]') || m.type() === 'error') console.log(`[browser:${m.type()}]`, text)
})
page.on('pageerror', err => console.log('[pageerror]', err.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000) // wait for GLB to load

// First send a rest-pose burst so rawZero calibrates.
for (let i = 0; i < 20; i++) {
  if (ws) ws.send(JSON.stringify({
    type: 'orientation',
    q: [0, 0, 0, 1],
    raw: { alpha: 0, beta: 0, gamma: 0 },
    gestureGain: 0.7,
    articulation: 0.5,
    rotationRate: { alpha: 0, beta: 0, gamma: 0, mag: 250 },
    calibrated: true,
    t: performance.now(),
  }))
  await page.waitForTimeout(20)
}

// Probe the pose's bone state through window.__conductGlbDebug if exposed.
// Otherwise just screenshot.
function qFromEulerZXY(aDeg, bDeg, gDeg) {
  const DEG = Math.PI / 180
  const a = aDeg * DEG / 2, b = bDeg * DEG / 2, g = gDeg * DEG / 2
  const cZ = Math.cos(a), sZ = Math.sin(a)
  const cX = Math.cos(b), sX = Math.sin(b)
  const cY = Math.cos(g), sY = Math.sin(g)
  return [
    cZ*sX*cY - sZ*cX*sY,
    sZ*sX*cY + cZ*cX*sY,
    sZ*cX*cY + cZ*sX*sY,
    cZ*cX*cY - sZ*sX*sY,
  ]
}

for (const pose of POSES) {
  const q = qFromEulerZXY(pose.alpha, pose.beta, pose.gamma)
  const includeDownbeat = pose.label === '04-pitch-back-15'
  for (let i = 0; i < 30; i++) {
    if (ws) ws.send(JSON.stringify({
      type: 'orientation',
      q,
      raw: { alpha: pose.alpha, beta: pose.beta, gamma: pose.gamma },
      gestureGain: 0.7,
      articulation: 0.5,
      rotationRate: { alpha: 0, beta: 0, gamma: 0, mag: 250 },
      calibrated: true,
      downbeat: includeDownbeat ? { fired: true, intensity: 0.9 } : null,
      t: performance.now(),
    }))
    await page.waitForTimeout(16)
  }
  const debug = await page.evaluate(() => window.__conductGlbDebug)
  console.log(pose.label, JSON.stringify(debug))
  const file = path.join(OUT, `${pose.label}.png`)
  await page.screenshot({ path: file })
}

// Also capture a downbeat impulse mid-pose.
for (let i = 0; i < 5; i++) {
  if (ws) ws.send(JSON.stringify({
    type: 'orientation',
    q: [0, 0, 0, 1],
    raw: { alpha: 0, beta: -25, gamma: 0 },
    gestureGain: 0.7,
    articulation: 0.5,
    rotationRate: { alpha: 0, beta: 0, gamma: 0, mag: 250 },
    calibrated: true,
    downbeat: { fired: true, intensity: 0.9 },
    t: performance.now(),
  }))
  await page.waitForTimeout(40)
}
await page.screenshot({ path: path.join(OUT, '12-downbeat-pulse.png') })

await browser.close()
console.log('done')
