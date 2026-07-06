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
// LIVE CHANNELS (canon §6 — Act-I light coupling): two per-frame, zero-alloc
// setters for the hand-driven correlate WorldStage layers on top of the resting
// scene. `tipPool(dx)` nudges the pool horizontally (dx normalized -1..1,
// mutated in place — no object churn); `setLiveBreadth(t)` overrides the pool's
// breadth live (0..1, or null to release back to the scene's resting breadth).
// Both are read off getWorldState() as `poolTip` / `liveBreadth`. Neither calls
// notify() — they're driven every animation frame by a gesture overlay, and
// WorldStage polls them on its own rAF loop the same way it polls getScene().
//
// Canon: docs/superpowers/specs/2026-07-06-nocturne-design-canon.md §4, §6, §7.

import { makeScene, mergeScene, MAX_SOURCES } from './lightField.js'

const STRIKE_RING = 16 // cap the live strike list; older strikes are decoration

let scene = makeScene()
let strikes = []       // { x, y, intensity, start }  — start is a caller clock
let trace = []         // { x, y, size, kind, beat }  — Act-I committed strokes
let poolTip = 0        // live channel: -1..1 horizontal pool nudge
let liveBreadth = null // live channel: 0..1 breadth override, or null = released
const listeners = new Set()

// Subscribers are notified with no payload — they pull the current snapshot
// via getWorldState() themselves if they care. This avoids allocating a fresh
// snapshot object per command when no one reads it (there is no live
// subscribeWorld consumer today; WorldStage polls getScene()/getStrikes()/
// getTrace() directly on its own rAF loop instead).
function notify() {
  for (const l of listeners) l()
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
// clock (performance.now()) and is REQUIRED — a caller that omits it (or passes
// something non-finite) gets silently ignored rather than birthing a strike
// dated to epoch 0 that WorldStage would immediately prune as ancient. Same
// non-finite-guard posture as clamp01 elsewhere in this store.
export function strike(x, y, intensity = 0.5, start) {
  if (!Number.isFinite(start)) return
  strikes.push({ x: clamp01(x), y: clamp01(y), intensity: clamp01(intensity), start })
  // Compact in place (splice, not slice-reassign) so a reader holding the
  // array reference from getStrikes() sees the trimmed list too — the same
  // in-place discipline pruneStrikes already uses below.
  if (strikes.length > STRIKE_RING) strikes.splice(0, strikes.length - STRIKE_RING)
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

// ── Live channels (canon §6 — Act-I light coupling) ─────────────────────────
// Per-frame, zero-alloc, no notify(): a gesture overlay (LeanLift, Rise, …)
// mutates these fields directly every animation frame; WorldStage reads them
// off getWorldState() on its own loop the same way it reads getScene().

// Nudge the pool horizontally: dx normalized -1..1 (clamped). Intended as a
// SMALL sway on top of the resting pool position, not a full-range pan — call
// sites keep the magnitude modest (e.g. ±0.12) by design.
export function tipPool(dx) {
  poolTip = clampSigned(dx)
}

// Override the pool's breadth live: t ∈ [0,1], or null to release back to the
// scene's own resting breadth (set via setScene/openHall).
export function setLiveBreadth(t) {
  liveBreadth = t == null ? null : clamp01(t)
}

// Alloc-free reads for the WorldStage rAF loop (getWorldState() builds a
// snapshot object — fine for commands, not for a per-frame read).
export function getPoolTip() {
  return poolTip
}

export function getLiveBreadth() {
  return liveBreadth
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
  listener() // initial call, same no-payload contract as every notify()
  return () => listeners.delete(listener)
}

export function getWorldState() {
  return { scene, strikes, trace, poolTip, liveBreadth }
}

// Re-arm for a fresh rite (Overture mount). Clears strikes + trace; resets the
// scene to the neutral resting pool and releases the live channels.
export function resetWorld() {
  scene = makeScene()
  strikes = []
  trace = []
  poolTip = 0
  liveBreadth = null
  notify()
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function clampSigned(v) {
  if (!Number.isFinite(v)) return 0
  return v < -1 ? -1 : v > 1 ? 1 : v
}

export { MAX_SOURCES }
