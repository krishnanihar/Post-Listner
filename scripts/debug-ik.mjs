// Diagnostic: confirm whether the IK actually rotates the upper-arm /
// forearm bones when a non-trivial phone quaternion is injected.
// Reads bone quaternions before any gesture is sent vs after, prints both.

import { chromium } from 'playwright'

const URL = 'http://localhost:5174/conduct'
const DEG = Math.PI / 180

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
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2],
  ]
}
function quatConj(q) { return [-q[0], -q[1], -q[2], q[3]] }
const Q_CAL = quatFromEulerZXY(0, 90, 0)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1080, height: 1080 } })
const page = await context.newPage()

let ws = null
await page.routeWebSocket(/^wss:\/\//, (w) => { ws = w })

page.on('console', m => console.log(`[browser ${m.type()}]`, m.text()))
page.on('pageerror', e => console.log('[pageerror]', e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__conductorBonesLogged, null, { timeout: 8000 })

// Expose bones for reading
await page.evaluate(() => {
  // Walk through the React Three Fiber root to find the GLB scene
  window.__readBone = (name) => {
    const sanitize = (n) => n.replace(/[.:[\]]/g, '')
    const wanted = sanitize(name)
    let found = null
    function walk(o) {
      if (!o || found) return
      if (o.isBone && (o.name === wanted || o.name === name)) { found = o; return }
      if (o.children) for (const c of o.children) walk(c)
    }
    // Three.js global scene? Try the renderer's scene if accessible.
    // Otherwise walk all canvases.
    const canvases = document.querySelectorAll('canvas')
    for (const c of canvases) {
      const r = c.__threeRenderer || null
      if (r && r.scene) walk(r.scene)
    }
    // Fallback: search via Three's internal registry if available
    if (!found && window.THREE) {
      // No global registry — try via document inspection
    }
    if (!found) return null
    const q = found.quaternion
    const p = new (Object.getPrototypeOf(found).constructor.prototype.getWorldPosition ? found.getWorldPosition.constructor : Object)()
    return { name: found.name, q: [q.x, q.y, q.z, q.w] }
  }
})

// Wait for socket
let waited = 0
while (!ws && waited < 3000) {
  await page.waitForTimeout(50); waited += 50
}
console.log('socket intercepted:', !!ws)

async function snapshot(label) {
  const data = await page.evaluate(() => {
    const dbg = window.__conductorDebug
    if (!dbg) return null
    const out = {}
    function walkAll(o) {
      if (!o) return
      if (o.isBone) out[o.name] = [
        +o.quaternion.x.toFixed(4), +o.quaternion.y.toFixed(4),
        +o.quaternion.z.toFixed(4), +o.quaternion.w.toFixed(4),
      ]
      if (o.children) for (const c of o.children) walkAll(c)
    }
    walkAll(dbg.scene)
    // Also include target's world position
    const ik = dbg.getIKState()
    if (ik) {
      const p = ik.targetBone.position
      out['__target_local'] = [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)]
      const w = ik.targetBone.getWorldPosition(new (Object.getPrototypeOf(p).constructor)())
      out['__target_world'] = [+w.x.toFixed(3), +w.y.toFixed(3), +w.z.toFixed(3)]
      out['__rest_world'] = [+ik.restTargetWorld.x.toFixed(3), +ik.restTargetWorld.y.toFixed(3), +ik.restTargetWorld.z.toFixed(3)]
    }
    return out
  })
  if (!data) { console.log('NO DEBUG STATE'); return }
  const interesting = ['DEF-upper_armR', 'DEF-forearmR', 'DEF-handR', 'MCH-hand_ikparentR', 'DEF-spine006', 'DEF-spine004']
  console.log(`\n=== ${label} ===`)
  for (const n of interesting) {
    const sanitized = n.replace(/[.:[\]]/g, '')
    const q = data[sanitized] || data[n]
    console.log(`  ${n.padEnd(22)} ${q ? `[${q.join(', ')}]` : 'NOT FOUND'}`)
  }
  if (data.__target_world) console.log(`  target world : [${data.__target_world.join(', ')}]`)
  if (data.__rest_world) console.log(`  rest   world : [${data.__rest_world.join(', ')}]`)
}

async function send(q) {
  if (!ws) return
  ws.send(JSON.stringify({
    type: 'orientation', q, raw: { alpha: 0, beta: 0, gamma: 0 },
    calibrated: true, t: performance.now(),
  }))
}

// Baseline: send identity 5 times so currentQuat slerps to it
for (let i = 0; i < 30; i++) { await send([0,0,0,1]); await page.waitForTimeout(16) }
await snapshot('AFTER IDENTITY')

// Strong tilt-back gesture
const Q_abs = quatFromEulerZXY(0, 90+30, 0)
const qRel = quatMul(quatConj(Q_CAL), Q_abs)
console.log('\nsending qRel:', qRel)
for (let i = 0; i < 60; i++) { await send(qRel); await page.waitForTimeout(16) }
await snapshot('AFTER TILT-BACK 30°')

// Tilt-right
const Q_abs2 = quatFromEulerZXY(0, 90, 30)
const qRel2 = quatMul(quatConj(Q_CAL), Q_abs2)
console.log('\nsending qRel:', qRel2)
for (let i = 0; i < 60; i++) { await send(qRel2); await page.waitForTimeout(16) }
await snapshot('AFTER TILT-RIGHT 30°')

await browser.close()
