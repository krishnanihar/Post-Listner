import { useEffect, useRef } from 'react'
import { compositeScene, lampColor, clamp01 } from './lightField.js'
import { getScene, getStrikes, getTrace, getPoolTip, getLiveBreadth, pruneStrikes, strike as enqueueStrike } from './worldStore.js'
import { getConducting } from './conductingBridge.js'
import { drawTrace } from './traceModel.js'
import { strike as strikeVerb, strikeAlive, swellApproach, swellRate } from '../lib/motionGrammar.js'
import { prefersReducedMotion } from '../lib/reducedMotion.js'

// Nocturne WorldStage — one fullscreen 2D canvas that paints the light field
// behind everything. Light is the material of the living instrument (canon §2):
// the intimate lamp pool of Act I opens into the hall of Act II, all on one
// continuous dark stage.
//
// Mounted in App.jsx as a sibling of ReflectionSurface, OUTSIDE the phase-swap
// AnimatePresence, so a phase change never unmounts it and the light is truly
// continuous across the seam. It reads worldStore.getWorldState() each frame
// (it does NOT re-render on store changes — same discipline as BackgroundGlyph
// mirroring its release ratio into a ref); phases command the store.
//
// Perf (BackgroundGlyph discipline): DPR capped at 2 (recomputed on resize, so
// it tracks a display change without a remount); reduced motion re-read live
// via a cached matchMedia list (see below) instead of a once-at-mount read;
// strike scratch + the render loop allocate nothing per frame beyond the
// gradient objects the 2D API forces. Idle target < 2ms/frame.

const MAX_DPR = 2
const STRIKE_MAX_AGE_MS = 1200
// Time-constants for the painted-scene ease (the `swell` verb, canon §3/§7).
// Engage is snappy — conducting should feel immediate. Release is slower so
// the light's collapse at song end reads on the same order as the audio's own
// END_FADE_DURATION (4s) fade, not in a single frame.
const TAU_ENGAGE = 0.5
const TAU_RELEASE = 1.3

export default function WorldStage() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    let w = 0
    let h = 0

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Reduced motion, re-read live (a11y floor) — a cached matchMedia list +
    // 'change' listener, same idiom as useDeviceMode, rather than a value read
    // once at mount that could go stale for a WorldStage instance that never
    // remounts across the whole session.
    let reduced = prefersReducedMotion()
    const reducedMql = (typeof window !== 'undefined' && window.matchMedia)
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    const onReducedChange = (e) => { reduced = e.matches; renderOpts.reduced = reduced }
    reducedMql?.addEventListener?.('change', onReducedChange)

    let raf = 0
    let mounted = true
    let lastDownbeatSeq = 0
    let wasActive = false
    let lastFrameTs = 0

    // Hoisted scratch scene + beam source + render-opts — the Act-II live
    // correlate is applied by MUTATING these each frame (base scene ⊕ conducting
    // bridge), so the loop allocates nothing. The base (resting) scene lives in
    // worldStore (stable module refs read via getScene/getStrikes — no wrapper
    // object per frame). The fast hand-driven overlay never touches the store.
    //
    // `target` holds this frame's destination (the live conducting-derived
    // values when active, the resting scene when not); `painted` is what's
    // actually drawn, eased toward `target` via swellApproach so activation and
    // deactivation both read as a glide rather than a hard cut. The yaw beam is
    // only ever a source while active (matches the shipped on/off cut — it's a
    // faint decoration, not part of what needs to collapse gracefully); when
    // inactive the resting scene's own (typically empty) sources render instead.
    const beam = { x: 0.5, y: 0.4, radius: 0.14, warmth: 0.5, intensity: 0 }
    const beamSources = [beam]
    const target = { pool: { x: 0.5, y: 0.5, radius: 0.28 }, warmth: 0.5, breadth: 0, intensity: 1 }
    const painted = { pool: { x: 0.5, y: 0.5, radius: 0.28 }, warmth: 0.5, breadth: 0, intensity: 1, sources: [] }
    const renderOpts = { reduced, glow: 0 }
    const strikeRgb = { r: 0, g: 0, b: 0 } // hoisted scratch for the ring color

    const frame = (now) => {
      if (!mounted) return
      const scene = getScene()
      const strikes = getStrikes()
      const cond = getConducting()

      const dt = lastFrameTs ? (now - lastFrameTs) / 1000 : 0
      lastFrameTs = now

      // Choose what to paint toward: the plain resting scene, or — during Act
      // II — the resting scene overlaid with the live conducting correlate
      // ("I did that" legibility, canon §7). All reads are of values the sacred
      // loop already wrote to the bridge; no engine taps, no work added to
      // that loop.
      let glow = 0
      if (cond.active) {
        // First active frame of a run — re-sync the downbeat baseline. The
        // bridge resets its seq to 0 on activate but WorldStage never unmounts
        // across phases, so without this the first frame of a *second* rite
        // would see 0 !== the prior run's final seq and fire a phantom ring.
        if (!wasActive) lastDownbeatSeq = cond.downbeatSeq
        // roll → pool azimuth; pitch → warmth (falter cools); size → glow;
        // bloom → breadth (light widens with the reverb); falter → dim.
        const falterCool = 1 - cond.falter * 0.8
        const falterDim = 1 - cond.falter * 0.9
        target.pool.x = clamp01(scene.pool.x + (cond.pan - 0.5) * 0.35)
        target.pool.y = scene.pool.y
        target.pool.radius = scene.pool.radius
        target.warmth = clamp01(cond.filterNorm * falterCool)
        target.breadth = clamp01(cond.breadth)
        target.intensity = clamp01(scene.intensity * falterDim)
        // Yaw beam — a faint light toward the boosted quadrant. yaw is a compass
        // heading (0..360) or −180..180; sin maps it to a horizontal sweep.
        beam.x = clamp01(0.5 + Math.sin((cond.yaw * Math.PI) / 180) * 0.42)
        beam.y = 0.4
        beam.warmth = clamp01(cond.filterNorm)
        beam.intensity = 0.12 + cond.glow * 0.1
        glow = cond.glow

        // Downbeat → strike ring at the correlate position (enqueued on the
        // store; the strike pass below renders it). One strike per new downbeat.
        if (cond.downbeatSeq !== lastDownbeatSeq) {
          lastDownbeatSeq = cond.downbeatSeq
          enqueueStrike(target.pool.x, target.pool.y, cond.downbeatIntensity, now)
        }
      } else {
        // Conducting has stopped (or never started) — ease back toward the
        // resting scene instead of snapping to it, layered with the Act-I live
        // channels (canon §6): LeanLift tips the pool horizontally (poolTip,
        // already scaled ~±0.12), Rise's energy meter can widen the breadth
        // (liveBreadth, null = released). Alloc-free reads.
        const tip = getPoolTip()
        target.pool.x = clamp01(scene.pool.x + (Number.isFinite(tip) ? tip : 0))
        target.pool.y = scene.pool.y
        target.pool.radius = scene.pool.radius
        target.warmth = scene.warmth
        const lb = getLiveBreadth()
        target.breadth = Number.isFinite(lb)
          ? Math.max(scene.breadth, lb)
          : scene.breadth
        target.intensity = scene.intensity
      }
      painted.sources = cond.active ? beamSources : scene.sources
      wasActive = cond.active

      if (reduced) {
        painted.pool.x = target.pool.x
        painted.pool.y = target.pool.y
        painted.pool.radius = target.pool.radius
        painted.warmth = target.warmth
        painted.breadth = target.breadth
        painted.intensity = target.intensity
      } else {
        const tau = cond.active ? TAU_ENGAGE : TAU_RELEASE
        const k = dt > 0 ? swellRate(dt, tau) : 1
        painted.pool.x = swellApproach(painted.pool.x, target.pool.x, k)
        painted.pool.y = swellApproach(painted.pool.y, target.pool.y, k)
        painted.pool.radius = swellApproach(painted.pool.radius, target.pool.radius, k)
        painted.warmth = swellApproach(painted.warmth, target.warmth, k)
        painted.breadth = swellApproach(painted.breadth, target.breadth, k)
        painted.intensity = swellApproach(painted.intensity, target.intensity, k)
      }

      renderOpts.glow = glow
      compositeScene(ctx, painted, w * dpr, h * dpr, now, renderOpts)

      // Strike rings — one-shot expanding rings, decayed by the strike verb.
      // Drawn in device pixels (compositeScene left transform at identity). Skip
      // the whole pass (and the lampColor alloc) when nothing is live — the
      // common case, so the steady-state frame allocates nothing.
      if (strikes.length) {
        ctx.globalCompositeOperation = 'screen'
        const { r, g, b } = lampColor(Math.min(1, painted.warmth + 0.3), strikeRgb)
        for (let i = 0; i < strikes.length; i++) {
          const s = strikes[i]
          if (!strikeAlive(s.start, now, { decayMs: 300, reduced })) continue
          const age = now - s.start
          const a = strikeVerb(age, { decayMs: 300, peak: 0.4 * (0.4 + s.intensity), reduced })
          if (a <= 0.003) continue
          const prog = Math.min(1, age / STRIKE_MAX_AGE_MS)
          const radius = (20 + prog * (80 + s.intensity * 160)) * dpr
          ctx.beginPath()
          ctx.arc(s.x * w * dpr, s.y * h * dpr, radius, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${r},${g},${b},${a})`
          ctx.lineWidth = 1.5 * dpr
          ctx.stroke()
        }
        ctx.globalCompositeOperation = 'source-over'
        pruneStrikes(now, STRIKE_MAX_AGE_MS)
      }

      // The Trace — the persistent marks Act I wrote in light (canon §7). Drawn
      // faint over the scene; dimmer during Act II so the live correlate leads
      // ("you conduct with what you wrote"). Only when strokes exist — the
      // resting/Act-I-pre-first-commit frame stays allocation-free.
      const trace = getTrace()
      if (trace.length) {
        ctx.globalCompositeOperation = 'screen'
        drawTrace(ctx, trace, w * dpr, h * dpr, { reveal: 1, alpha: cond.active ? 0.14 : 0.38, dpr })
        ctx.globalCompositeOperation = 'source-over'
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      mounted = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      reducedMql?.removeEventListener?.('change', onReducedChange)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
