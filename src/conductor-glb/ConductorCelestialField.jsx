/* /conduct-glb — celestial field system.
 *
 * Port of post_listener_orchestra_celestial_field.html into a React
 * component. The conductor's gesture is rendered NOT by animating a
 * figure but by drawing through the space around them:
 *
 *   - Static parchment backdrop with zodiac glyphs + faint hint
 *     constellations + concentric circles.
 *   - A scattered field of stars on the parchment.
 *   - The phone-driven "baton tip" (cur.x, cur.y) traces a tapered ink
 *     ribbon (wide when slow, thin when fast, fades over ~3.8s).
 *   - Stars near the tip activate (gold glow). Two stars activated in
 *     sequence within 240px get linked by an inscribed constellation
 *     line that lives 9s before fading.
 *   - Idle 1.5s → auto-demos a Lissajous figure so the field looks
 *     alive even before the phone is connected.
 *
 * Phone integration: pitch/roll from usePhone() drive (cur.x, cur.y)
 * around the center of the canvas. The figure (silhouette body) is
 * intentionally not drawn here — that's a later phase. Right now this
 * is the conducting *experience*, full-screen.
 */
import { useEffect, useRef } from 'react'
import { computeMetatronNodes, computeMetatronEdges } from './metatronGeometry.js'
import { bandAverage, detectBassBeat } from './audioBands.js'

// Logical canvas dimensions — the same coords the original HTML uses.
// Everything inside is laid out in this space; the canvas elements are
// scaled to fit the actual viewport while preserving aspect ratio.
const SW = 680
const SH = 600

const INK = [38, 22, 14]
const INK_WET = [18, 10, 5]
const GLOW = [198, 148, 82]

const TRACE_LIFE = 3800       // ms
const LINE_LIFE = 9000        // ms
const W_MIN = 1.2
const W_MAX = 14
const V_SAT = 620             // px/s — saturating velocity for ribbon width
const STAR_HIT = 32           // px — proximity for activation
const STAR_LINK = 240         // px — max distance to link sequential stars

const BASS_BIN_START = 0
const BASS_BIN_END = 3
const BEAT_THRESHOLD = 0.55              // bass band level that triggers a beat
const BREATH_AMPLITUDE = 0.05            // ±5% global opacity breath on inscribed

const STAR_POSITIONS = [
  [60,68],[110,105],[160,80],[55,160],[120,180],[78,220],
  [575,75],[620,110],[580,165],[635,195],[600,240],
  [50,290],[95,340],[42,395],[85,440],
  [625,295],[582,345],[638,395],[598,442],
  [60,490],[110,520],[45,560],
  [610,490],[570,525],[635,560],
  [280,40],[395,45],[340,18],
  [305,575],[378,580],
]

const BRIGHT_INDICES = [1, 5, 8, 11, 17, 20, 26]

const HINT_CONSTELLATIONS = [
  [[60,68],[110,105],[160,80],[120,180]],
  [[575,75],[620,110],[580,165]],
  [[60,490],[110,520],[45,560]],
  [[625,295],[582,345],[638,395]],
]

// Metatron geometry — drawn into the same viewBox the stars live in.
// Center at (SW/2, SH/2 + 10). Inner hex radius 110, outer hex at 220.
// Drawn as a faint watermark behind the stars + a foreground layer of
// nodes that activate when the trail tip passes near them.
const METATRON_CX = SW / 2
const METATRON_CY = SH / 2 + 10           // matches the existing background-circle center
const METATRON_INNER_RADIUS = 110
const NODE_HIT_PX = 20                    // proximity for node activation
const NODE_DEFAULT_RADIUS = 4             // resting node visual size
const NODE_ACTIVE_RADIUS_BOOST = 7        // additional radius when fully activated
const WATERMARK_RGBA = 'rgba(70,46,24,0.07)'   // faint amber, slightly darker than dust

export default function ConductorCelestialField({ audio, phone }) {
  const rootRef = useRef(null)
  const bgRef = useRef(null)
  const fgRef = useRef(null)
  const trailRef = useRef(null)
  const { stateRef } = phone
  // Stable ref so the rAF closure always sees the latest audio object
  // without re-running the effect when audio's render-object identity changes.
  const audioRef = useRef(audio)
  useEffect(() => { audioRef.current = audio })

  useEffect(() => {
    const root = rootRef.current
    const bg = bgRef.current
    const fg = fgRef.current
    const trail = trailRef.current
    if (!root || !bg || !fg || !trail) return

    const dpr = window.devicePixelRatio || 1

    // Phone-driven cursor target + smoothed render position. Initialized
    // to canvas center so the first frames don't snap from origin.
    const cur = { x: SW / 2, y: SH / 2 }
    const sm = { x: SW / 2, y: SH / 2 }
    let lastAct = 0

    const trace = []
    const inscribed = []
    let lastActStar = null

    const inscribedMetatronEdges = new Set()  // 'i,j' string keys for inscribed edges
    let lastActMetatronNodeIdx = -1

    // Downbeat tracking for burst events
    let lastConsumedBeat = 0
    const BURST_RADIUS = 180   // viewBox px around cursor

    // Star field — randomized slightly per mount so it doesn't feel
    // identical to the demo. Seed with the fixed positions then jitter.
    const stars = STAR_POSITIONS.map(([x, y]) => ({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      base: 0.22 + Math.random() * 0.20,
      r: 0.7 + Math.random() * 1.6,
      act: 0,
    }))
    for (const i of BRIGHT_INDICES) {
      if (stars[i]) {
        stars[i].r *= 1.7
        stars[i].base += 0.18
      }
    }

    // Compute Metatron nodes once. Scaled into viewBox coords.
    const metatronNodesLocal = computeMetatronNodes(METATRON_INNER_RADIUS).map((n) => ({
      x: METATRON_CX + n.x,
      y: METATRON_CY + n.y,
      act: 0,                                  // activation 0..1, same pattern as stars
    }))
    const metatronEdgesLocal = computeMetatronEdges(13)

    // O(1) lookup set for canonical Metatron edges — built after
    // metatronEdgesLocal is available (const TDZ would fire earlier).
    const canonicalEdgeKeys = new Set(
      metatronEdgesLocal.map(([i, j]) => `${i},${j}`),
    )

    // Audio-reactive state — hoisted so update() and drawFg() share them.
    let prevBass = 0
    let beatRefractoryEnd = 0
    let expectedNextNodeIdx = -1
    let expectedPulseT = 0
    let bass = 0    // hoisted so drawFg() can read what update() computed
    let completionFlashT = 0     // 0..1 one-shot envelope, decays after firing
    let isComplete = false

    function recomputeExpectedNext() {
      for (const [i, j] of metatronEdgesLocal) {
        const key = `${i},${j}`
        if (!inscribedMetatronEdges.has(key)) {
          expectedNextNodeIdx = i
          return
        }
      }
      expectedNextNodeIdx = -1
    }

    // Viewport scaling — fit the logical SW×SH inside the available
    // root rectangle, preserving aspect.
    let cw = 0, ch = 0, sc = 1, ox = 0, oy = 0
    let bCtx = bg.getContext('2d')
    let fCtx = fg.getContext('2d')
    let tCtx = trail.getContext('2d')

    // Energy smoothing for glow halo response
    let energySmoothed = 0
    // Articulation smoothing for ink wet/dry character
    let articulationSmoothed = 0
    // Angular speed smoothing for trail width (direct gyro, no lag)
    let angularSpeedSmoothed = 0

    function applyT(ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      ctx.translate(ox, oy)
      ctx.scale(sc, sc)
    }

    function wid(v) {
      const n = Math.min(1, v / V_SAT)
      const e = Math.pow(n, 0.55)
      return W_MAX - (W_MAX - W_MIN) * e
    }

    function drawBg() {
      bCtx.save()
      bCtx.setTransform(1, 0, 0, 1, 0, 0)
      bCtx.clearRect(0, 0, bg.width, bg.height)
      bCtx.restore()
      applyT(bCtx)
      const g = bCtx.createRadialGradient(SW / 2, SH / 2, 80, SW / 2, SH / 2, 500)
      g.addColorStop(0, '#e8d8b3')
      g.addColorStop(0.6, '#dac6a0')
      g.addColorStop(1, '#c2ad84')
      bCtx.fillStyle = g
      bCtx.fillRect(0, 0, SW, SH)
      bCtx.strokeStyle = 'rgba(80,52,28,0.08)'
      bCtx.lineWidth = 0.5
      bCtx.beginPath()
      bCtx.arc(SW / 2, SH / 2 + 10, 290, 0, Math.PI * 2)
      bCtx.stroke()
      bCtx.beginPath()
      bCtx.arc(SW / 2, SH / 2 + 10, 240, 0, Math.PI * 2)
      bCtx.stroke()
      bCtx.save()
      bCtx.setLineDash([3, 5])
      bCtx.strokeStyle = 'rgba(80,52,28,0.06)'
      bCtx.beginPath()
      bCtx.arc(SW / 2, SH / 2 + 10, 330, 0, Math.PI * 2)
      bCtx.stroke()
      bCtx.restore()
      // Metatron watermark — faint amber lines connecting every node pair.
      // Painted into bg once at resize, so it sits under the stars + glyphs
      // like a structural chalk trace under the parchment.
      bCtx.strokeStyle = WATERMARK_RGBA
      bCtx.lineWidth = 0.4
      for (const [i, j] of metatronEdgesLocal) {
        const a = metatronNodesLocal[i]
        const b = metatronNodesLocal[j]
        bCtx.beginPath()
        bCtx.moveTo(a.x, a.y)
        bCtx.lineTo(b.x, b.y)
        bCtx.stroke()
      }
      bCtx.strokeStyle = 'rgba(70,46,24,0.18)'
      bCtx.lineWidth = 0.55
      for (const c of HINT_CONSTELLATIONS) {
        bCtx.beginPath()
        bCtx.moveTo(c[0][0], c[0][1])
        for (let i = 1; i < c.length; i++) bCtx.lineTo(c[i][0], c[i][1])
        bCtx.stroke()
      }
      bCtx.fillStyle = 'rgba(50,32,16,0.06)'
      for (let i = 0; i < 300; i++) {
        bCtx.fillRect(Math.random() * SW, Math.random() * SH, 1, 1)
      }
      bCtx.font = 'italic 18px Georgia, serif'
      bCtx.fillStyle = 'rgba(80,52,28,0.42)'
      bCtx.fillText('☉', 22, 38)
      bCtx.fillText('☽', 640, 38)
      bCtx.fillText('♃', 22, 580)
      bCtx.fillText('♄', 640, 580)
      bCtx.font = 'italic 14px Georgia, serif'
      bCtx.fillStyle = 'rgba(80,52,28,0.32)'
      bCtx.fillText('♂', 24, 310)
      bCtx.fillText('♀', 640, 310)
      bCtx.font = 'italic 11px Georgia, serif'
      bCtx.fillStyle = 'rgba(80,52,28,0.22)'
      bCtx.fillText('aries', 38, 260)
      bCtx.fillText('libra', 610, 360)
    }

    function resize() {
      const r = root.getBoundingClientRect()
      if (r.width < 10 || r.height < 10) return
      cw = r.width
      ch = r.height
      sc = Math.min(cw / SW, ch / SH)
      ox = (cw - SW * sc) / 2
      oy = (ch - SH * sc) / 2
      for (const c of [bg, fg, trail]) {
        c.width = Math.round(cw * dpr)
        c.height = Math.round(ch * dpr)
      }
      bCtx = bg.getContext('2d')
      fCtx = fg.getContext('2d')
      tCtx = trail.getContext('2d')
      applyT(bCtx)
      applyT(fCtx)
      applyT(tCtx)
      drawBg()
    }

    function update(dt, t) {
      audioRef.current.pollFrequency()
      const freq = audioRef.current.freqDataRef.current
      bass = bandAverage(freq, BASS_BIN_START, BASS_BIN_END)
      const beat = detectBassBeat(bass, prevBass, BEAT_THRESHOLD, beatRefractoryEnd, performance.now())
      beatRefractoryEnd = beat.nextRefractoryEnd
      if (beat.fired && expectedNextNodeIdx >= 0) {
        expectedPulseT = 1
      }
      prevBass = bass
      expectedPulseT = Math.max(0, expectedPulseT - dt * 1.8)
      completionFlashT = Math.max(0, completionFlashT - dt * 0.4)   // ~2.5 s fade-out

      // Phone-driven target: pitch/roll map cur to a point centered on
      // the canvas. Full deflection (±1) reaches ~35% of canvas extent
      // in each axis, so the baton tip can sweep most of the field.
      const state = stateRef.current
      const controls = state.controls
      const calibrated = state.calibrated
      const pitch = calibrated ? controls.pitch : 0
      const roll = calibrated ? controls.roll : 0
      const energy = controls.energy || 0
      const phoneActive = calibrated && (Math.abs(pitch) > 0.02 || Math.abs(roll) > 0.02)

      // Smooth energy for halo glow response
      energySmoothed += (energy - energySmoothed) * 0.22

      // Smooth articulation for ink wet/dry character
      const articulation = controls.articulation || 0
      articulationSmoothed += (articulation - articulationSmoothed) * 0.18

      // Smooth angular speed for ribbon width — gyro is direct, no lag
      const angularSpeed = controls.angularSpeed || 0
      angularSpeedSmoothed += (angularSpeed - angularSpeedSmoothed) * 0.30

      if (phoneActive) {
        cur.x = SW / 2 + roll * SW * 0.40
        cur.y = SH / 2 + pitch * SH * 0.40
        lastAct = performance.now()
      } else if (performance.now() - lastAct > 1500) {
        // Idle: Lissajous so the field stays alive between gestures.
        const tt = t * 0.42
        cur.x = SW * 0.5 + Math.sin(tt) * SW * 0.34
        cur.y = SH * 0.5 + Math.sin(tt * 1.8) * SH * 0.28
      }

      // Directional momentum from phone-frame acceleration. Subtle — adds
      // physicality without overpowering the orientation-driven cursor.
      const accel = controls.accel || { x: 0, y: 0, z: 0 }
      cur.x += accel.x * 40  // viewBox px per (1g normalized) push
      cur.y -= accel.y * 40  // phone +Y is up; SVG Y grows down → invert

      sm.x += (cur.x - sm.x) * 0.22
      sm.y += (cur.y - sm.y) * 0.22

      const now = performance.now()
      const last = trace[trace.length - 1]
      let vel = 0
      if (last) {
        const dx = sm.x - last.x
        const dy = sm.y - last.y
        const dist = Math.hypot(dx, dy)
        const tdt = Math.max(0.001, (now - last.t) / 1000)
        vel = dist / tdt
      }
      if (!last || Math.hypot(sm.x - last.x, sm.y - last.y) > 0.9) {
        // Width source: blend phone-gyro angular speed (direct, no lag) with
        // screen-cursor velocity (fallback when gyro data unavailable, e.g.
        // on browsers without rotationRate). angularSpeed is 0..1; scale to
        // the existing px/s domain of the original wid() function.
        const widthSignal = Math.max(vel, angularSpeedSmoothed * V_SAT)
        trace.push({ x: sm.x, y: sm.y, t: now, v: widthSignal })
      }
      while (trace.length && now - trace[0].t > TRACE_LIFE) trace.shift()
      if (trace.length > 240) trace.splice(0, trace.length - 240)

      // Detect new downbeat event
      const beatAt = controls.lastDownbeatAt || 0
      const beatNew = beatAt && beatAt !== lastConsumedBeat
      if (beatNew) {
        lastConsumedBeat = beatAt
        const intensity = controls.downbeatIntensity || 1
        // Burst: any star within BURST_RADIUS of the cursor activates to full.
        // Pick the two closest to inscribe a constellation line.
        const near = []
        for (const s of stars) {
          const d = Math.hypot(s.x - sm.x, s.y - sm.y)
          if (d < BURST_RADIUS) {
            s.act = Math.min(1, s.act + 0.6 * intensity)
            near.push({ s, d })
          }
        }
        near.sort((a, b) => a.d - b.d)
        if (near.length >= 2) {
          inscribed.push({
            x1: near[0].s.x, y1: near[0].s.y,
            x2: near[1].s.x, y2: near[1].s.y,
            t: now,
          })
        }
      }

      for (const s of stars) {
        const d = Math.hypot(s.x - sm.x, s.y - sm.y)
        if (d < STAR_HIT) {
          if (s.act < 0.4 && lastActStar !== s) {
            if (lastActStar) {
              const d2 = Math.hypot(s.x - lastActStar.x, s.y - lastActStar.y)
              if (d2 < STAR_LINK) {
                inscribed.push({
                  x1: lastActStar.x, y1: lastActStar.y,
                  x2: s.x, y2: s.y, t: now,
                })
              }
            }
            lastActStar = s
          }
          s.act = Math.min(1, s.act + dt * 5)
        }
        s.act = Math.max(0, s.act - dt * 0.55)
      }
      // Metatron node activation — same pattern as stars. Trail tip
      // proximity within NODE_HIT_PX bumps activation; otherwise decay.
      for (let i = 0; i < metatronNodesLocal.length; i++) {
        const n = metatronNodesLocal[i]
        const d = Math.hypot(n.x - sm.x, n.y - sm.y)
        if (d < NODE_HIT_PX) {
          if (n.act < 0.4 && lastActMetatronNodeIdx !== i) {
            // Activation transition — check if the edge from the previous
            // node to this one is a canonical edge we haven't inscribed yet.
            if (lastActMetatronNodeIdx >= 0) {
              const a = Math.min(lastActMetatronNodeIdx, i)
              const b = Math.max(lastActMetatronNodeIdx, i)
              const key = `${a},${b}`
              if (canonicalEdgeKeys.has(key) && !inscribedMetatronEdges.has(key)) {
                inscribedMetatronEdges.add(key)
                recomputeExpectedNext()
                if (!isComplete && inscribedMetatronEdges.size === metatronEdgesLocal.length) {
                  isComplete = true
                  completionFlashT = 1
                }
              }
            }
            lastActMetatronNodeIdx = i
          }
          n.act = Math.min(1, n.act + dt * 5)
        }
        n.act = Math.max(0, n.act - dt * 0.55)
      }

      while (inscribed.length && now - inscribed[0].t > LINE_LIFE) inscribed.shift()
      if (inscribed.length > 60) inscribed.splice(0, inscribed.length - 60)

    }

    function buildRibbon() {
      const n = trace.length
      if (n < 2) return false
      for (let i = 0; i < n; i++) trace[i].hwRaw = wid(trace[i].v) / 2
      for (let i = 0; i < n; i++) {
        let s = 0, c = 0
        for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) {
          s += trace[j].hwRaw
          c++
        }
        trace[i].hw = s / c
      }
      for (let i = 0; i < n; i++) {
        let tx, ty
        if (i === 0) { tx = trace[1].x - trace[0].x; ty = trace[1].y - trace[0].y }
        else if (i === n - 1) { tx = trace[n - 1].x - trace[n - 2].x; ty = trace[n - 1].y - trace[n - 2].y }
        else { tx = trace[i + 1].x - trace[i - 1].x; ty = trace[i + 1].y - trace[i - 1].y }
        const L = Math.hypot(tx, ty) || 1
        trace[i].nx = -ty / L
        trace[i].ny = tx / L
      }
      if (n > 4) {
        for (let k = 0; k < Math.min(4, n); k++) {
          const tail = Math.min(1, k / 3)
          trace[k].hw *= 0.35 + 0.65 * tail
        }
      }
      return true
    }

    function drawFg() {
      fCtx.save()
      fCtx.setTransform(1, 0, 0, 1, 0, 0)
      fCtx.clearRect(0, 0, fg.width, fg.height)
      fCtx.restore()
      applyT(fCtx)
      const now = performance.now()
      for (const ln of inscribed) {
        const age = now - ln.t
        const lf = 1 - age / LINE_LIFE
        if (lf <= 0) continue
        fCtx.strokeStyle = `rgba(60,38,20,${lf * 0.55})`
        fCtx.lineWidth = 0.8
        fCtx.beginPath()
        fCtx.moveTo(ln.x1, ln.y1)
        fCtx.lineTo(ln.x2, ln.y2)
        fCtx.stroke()
      }
      for (const s of stars) {
        const br = s.base + s.act * 0.65
        const sz = s.r * (1 + s.act * 0.45)
        if (s.act > 0.08) {
          fCtx.fillStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},${s.act * 0.32})`
          fCtx.beginPath()
          fCtx.arc(s.x, s.y, sz * 5, 0, Math.PI * 2)
          fCtx.fill()
        }
        fCtx.fillStyle = `rgba(45,28,15,${br})`
        fCtx.beginPath()
        fCtx.arc(s.x, s.y, sz, 0, Math.PI * 2)
        fCtx.fill()
        if (s.act > 0.3) {
          fCtx.fillStyle = `rgba(245,210,150,${s.act * 0.85})`
          fCtx.beginPath()
          fCtx.arc(s.x, s.y, sz * 0.5, 0, Math.PI * 2)
          fCtx.fill()
        }
      }
      // Inscribed Metatron edges — bright gold with a subtle bass-driven
      // breath. Audio absent → opacity ~0.85; full bass kick → ~0.95.
      // On completion, flash brightens to peak gold + thickens stroke.
      const breathOpacity = 0.85 + (bass - 0.5) * BREATH_AMPLITUDE * 2
      const completionBoost = completionFlashT * 0.15
      const finalEdgeOpacity = Math.max(0.6, Math.min(1, breathOpacity + completionBoost))
      const finalEdgeWidth = 1.6 + completionFlashT * 2.5
      fCtx.strokeStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},${finalEdgeOpacity})`
      fCtx.lineWidth = finalEdgeWidth
      for (const key of inscribedMetatronEdges) {
        const [i, j] = key.split(',').map(Number)
        const a = metatronNodesLocal[i]
        const b = metatronNodesLocal[j]
        fCtx.beginPath()
        fCtx.moveTo(a.x, a.y)
        fCtx.lineTo(b.x, b.y)
        fCtx.stroke()
      }

      // Metatron nodes — faint dots at the 13 Fruit-of-Life positions.
      // The expected-next node (first endpoint of first uninscribed canonical
      // edge) gets an extra brightness pulse on each detected bass beat.
      for (let nodeIdx = 0; nodeIdx < metatronNodesLocal.length; nodeIdx++) {
        const n = metatronNodesLocal[nodeIdx]
        const pulseBoost = (nodeIdx === expectedNextNodeIdx ? expectedPulseT : 0)
        const baseOpacity = 0.25 + n.act * 0.65 + pulseBoost * 0.45
        const radius = NODE_DEFAULT_RADIUS + n.act * NODE_ACTIVE_RADIUS_BOOST + pulseBoost * 4
        fCtx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},${Math.min(1, baseOpacity)})`
        fCtx.beginPath()
        fCtx.arc(n.x, n.y, radius, 0, Math.PI * 2)
        fCtx.fill()
        const glowAmount = n.act * 0.6 + pulseBoost * 0.5
        if (glowAmount > 0.18) {
          fCtx.fillStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},${Math.min(1, glowAmount)})`
          fCtx.beginPath()
          fCtx.arc(n.x, n.y, radius * 1.8, 0, Math.PI * 2)
          fCtx.fill()
        }
      }
    }

    function drawTrail() {
      tCtx.save()
      tCtx.setTransform(1, 0, 0, 1, 0, 0)
      tCtx.clearRect(0, 0, trail.width, trail.height)
      tCtx.restore()
      applyT(tCtx)
      if (!buildRibbon()) return
      const now = performance.now()
      // Glow halo pass.
      for (let i = 0; i < trace.length - 1; i++) {
        const p0 = trace[i], p1 = trace[i + 1]
        const age = now - (p0.t + p1.t) / 2
        const lf = 1 - age / TRACE_LIFE
        if (lf <= 0) continue
        const hw0 = p0.hw * 2.6, hw1 = p1.hw * 2.6
        const haloOpacity = 0.10 + energySmoothed * 0.28
        tCtx.fillStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},${lf * haloOpacity})`
        tCtx.beginPath()
        tCtx.moveTo(p0.x + p0.nx * hw0, p0.y + p0.ny * hw0)
        tCtx.lineTo(p1.x + p1.nx * hw1, p1.y + p1.ny * hw1)
        tCtx.lineTo(p1.x - p1.nx * hw1, p1.y - p1.ny * hw1)
        tCtx.lineTo(p0.x - p0.nx * hw0, p0.y - p0.ny * hw0)
        tCtx.closePath()
        tCtx.fill()
      }
      // Ink core pass.
      for (let i = 0; i < trace.length - 1; i++) {
        const p0 = trace[i], p1 = trace[i + 1]
        const age = now - (p0.t + p1.t) / 2
        const lf = 1 - age / TRACE_LIFE
        if (lf <= 0) continue
        const wetRaw = Math.max(0, 1 - age / 450)
        // Articulation biases drying: a snappy stroke (high jerk) drops wet fast.
        const wet = wetRaw * (1 - articulationSmoothed * 0.7)
        const r = INK[0] * (1 - wet) + INK_WET[0] * wet
        const gC = INK[1] * (1 - wet) + INK_WET[1] * wet
        const b = INK[2] * (1 - wet) + INK_WET[2] * wet
        const a = lf * (0.62 + wet * 0.28 + articulationSmoothed * 0.10)
        tCtx.fillStyle = `rgba(${r | 0},${gC | 0},${b | 0},${a})`
        tCtx.beginPath()
        tCtx.moveTo(p0.x + p0.nx * p0.hw, p0.y + p0.ny * p0.hw)
        tCtx.lineTo(p1.x + p1.nx * p1.hw, p1.y + p1.ny * p1.hw)
        tCtx.lineTo(p1.x - p1.nx * p1.hw, p1.y - p1.ny * p1.hw)
        tCtx.lineTo(p0.x - p0.nx * p0.hw, p0.y - p0.ny * p0.hw)
        tCtx.closePath()
        tCtx.fill()
      }
      if (trace.length >= 2) {
        const tip = trace[trace.length - 1]
        tCtx.fillStyle = `rgba(${INK_WET[0]},${INK_WET[1]},${INK_WET[2]},0.92)`
        tCtx.beginPath()
        tCtx.arc(tip.x, tip.y, Math.max(1.5, tip.hw * 0.55), 0, Math.PI * 2)
        tCtx.fill()
        tCtx.fillStyle = `rgba(${GLOW[0]},${GLOW[1]},${GLOW[2]},0.28)`
        tCtx.beginPath()
        tCtx.arc(tip.x, tip.y, tip.hw * 2.2, 0, Math.PI * 2)
        tCtx.fill()
      }
      if (trace.length >= 2) {
        // Ink-blob "pen" at the leading tip — the source the trail flows from.
        // Slight wobble on a slow sine so it feels organic. Size scales with
        // current ribbon width so a fast stroke gives a small drop; a held
        // stroke gives a fat blob ready to dispense more ink.
        const tip = trace[trace.length - 1]
        const wob = Math.sin(performance.now() * 0.012)
        const blobR = Math.max(4, tip.hw * 1.3 + wob * 0.8)
        // Two-layer ink-blob: a saturated dark core + a slightly softer halo.
        tCtx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},0.85)`
        tCtx.beginPath()
        tCtx.arc(tip.x, tip.y, blobR, 0, Math.PI * 2)
        tCtx.fill()
        tCtx.fillStyle = `rgba(${INK_WET[0]},${INK_WET[1]},${INK_WET[2]},0.55)`
        tCtx.beginPath()
        tCtx.arc(tip.x + wob * 1.2, tip.y - wob * 0.9, blobR * 0.55, 0, Math.PI * 2)
        tCtx.fill()
      }
    }

    recomputeExpectedNext()

    const ro = new ResizeObserver(resize)
    ro.observe(root)
    resize()

    let lt = performance.now()
    let raf = 0
    let mounted = true
    function frame() {
      if (!mounted) return
      const now = performance.now()
      const dt = Math.min(0.05, (now - lt) / 1000)
      lt = now
      const t = now / 1000
      update(dt, t)
      drawFg()
      drawTrail()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      mounted = false
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [stateRef])

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute',
        inset: 0,
        background: '#d8c5a0',
        overflow: 'hidden',
        fontFamily: "Georgia, 'Iowan Old Style', serif",
      }}
    >
      <canvas
        ref={bgRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      <canvas
        ref={fgRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}
      />
      <canvas
        ref={trailRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }}
      />
      <div
        style={{
          position: 'absolute', top: 14, left: 18,
          fontSize: 10, letterSpacing: '0.2em', color: '#5a4830',
          fontStyle: 'italic', pointerEvents: 'none', zIndex: 4,
        }}
      >
        the orchestra
      </div>
      <div
        style={{
          position: 'absolute', bottom: 14, left: 18, right: 18,
          display: 'flex', justifyContent: 'space-between',
          fontSize: 9, letterSpacing: '0.15em', color: '#7a6342',
          pointerEvents: 'none', zIndex: 4,
        }}
      >
        <span>tilt phone to conduct · play stars by sweeping through them</span>
        <span>idle → auto demo</span>
      </div>
    </div>
  )
}
