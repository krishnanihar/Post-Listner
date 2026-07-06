// Nocturne WorldStage — the command store. momentBus idiom: a subscribable
// imperative store the phases command and WorldStage renders. Phases call
// setScene / strike / openHall / pushTraceStroke; the WorldStage rAF loop reads
// the current state each frame via getWorldState() (it does NOT re-render on
// every command — same discipline as BackgroundGlyph mirroring the release
// ratio into a ref). React components that need to react to a scene change (a
// transition trigger) can subscribeWorld.
//
// TIME: this store never reads a clock itself (keeps it deterministic + test-
// able, like momentBus). Callers pass timestamps (performance.now()) to strike;
// the WorldStage loop computes strike age against its own clock and prunes dead
// ones via pruneStrikes.
//
// TRACE: the accumulating Act-I trace (one stroke per committed gesture) lives
// here so it survives the Act-I → Act-II phase swap — the same "mount outside
// AnimatePresence" trick ReflectionSurface uses, but for data.
//
// Canon: docs/superpowers/specs/2026-07-06-nocturne-design-canon.md §4, §7.

import { makeScene, mergeScene, MAX_SOURCES } from './lightField.js'

const STRIKE_RING = 16 // cap the live strike list; older strikes are decoration

let scene = makeScene()
let strikes = []       // { x, y, intensity, start }  — start is a caller clock
let trace = []         // { x, y, size, kind, beat }  — Act-I committed strokes
const listeners = new Set()

function notify() {
  const snap = getWorldState()
  for (const l of listeners) l(snap)
}

// Merge a partial scene (pool/warmth/breadth/intensity/sources) into the target.
export function setScene(partial) {
  scene = mergeScene(scene, partial || {})
  notify()
}

// Set the whole scene at once (used on phase entry to establish a beat's stage).
export function replaceScene(next) {
  scene = makeScene(next || {})
  notify()
}

export function getScene() {
  return scene
}

// Enqueue a one-shot strike ring at a normalized point. `start` is the caller's
// clock (performance.now()); WorldStage decays it via motionGrammar.strike.
export function strike(x, y, intensity = 0.5, start = 0) {
  strikes.push({ x: clamp01(x), y: clamp01(y), intensity: clamp01(intensity), start })
  if (strikes.length > STRIKE_RING) strikes = strikes.slice(-STRIKE_RING)
  notify()
}

export function getStrikes() {
  return strikes
}

// Drop strikes older than maxAgeMs relative to nowMs. WorldStage calls this each
// frame so the list stays bounded without the store owning a clock. In-place
// compaction (no new array) so a per-frame call in the render loop allocates
// nothing in the steady state.
export function pruneStrikes(nowMs, maxAgeMs = 3600) {
  if (strikes.length === 0) return
  let w = 0
  for (let i = 0; i < strikes.length; i++) {
    if (nowMs - strikes[i].start < maxAgeMs) {
      if (w !== i) strikes[w] = strikes[i]
      w += 1
    }
  }
  strikes.length = w
}

// Bloom coupling: set breadth ∈ [0,1] (visual only — driven off Orchestra's
// existing timeline, never driving audio).
export function openHall(t) {
  setScene({ breadth: clamp01(t) })
}

// ── The Act-I trace (survives the phase swap) ───────────────────────────────
// A stroke: { x, y, size, kind, beat }. x,y normalized correlate of the
// committed gesture; size is glow; kind/beat name the origin for the reflect
// replay + the Act-II contraction.
export function pushTraceStroke(stroke) {
  trace.push({
    x: clamp01(stroke.x),
    y: clamp01(stroke.y),
    size: Number.isFinite(stroke.size) ? stroke.size : 0.5,
    kind: stroke.kind || 'commit',
    beat: stroke.beat || null,
  })
  notify()
}

export function getTrace() {
  return trace
}

export function resetTrace() {
  trace = []
  notify()
}

// ── subscription + lifecycle ────────────────────────────────────────────────
export function subscribeWorld(listener) {
  listeners.add(listener)
  listener(getWorldState())
  return () => listeners.delete(listener)
}

export function getWorldState() {
  return { scene, strikes, trace }
}

// Re-arm for a fresh rite (Overture mount). Clears strikes + trace; resets the
// scene to the neutral resting pool.
export function resetWorld() {
  scene = makeScene()
  strikes = []
  trace = []
  notify()
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export { MAX_SOURCES }
