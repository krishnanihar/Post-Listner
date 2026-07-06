// Nocturne motion grammar — THREE verbs, nothing else. Every animated thing in
// both acts (UI + WorldStage canvas) must reduce to one of these. Anything that
// can't is cut. Pure: no DOM, no time source of its own — callers pass the clock
// (tMs / ageMs / dt) so the functions are deterministic and testable, and the
// rAF loops that use them allocate nothing.
//
// Canon: docs/superpowers/specs/2026-07-06-nocturne-design-canon.md §3.
//
//   breath — idle presence. Slow sine, amplitude reduced-motion-aware.
//   swell  — gesture-coupled ease toward a target (EASE.settle feel).
//   strike — instant attack, exponential decay (~600ms).

import { EASE } from '../score/tokens.js'

// ── breath ────────────────────────────────────────────────────────────────
// A slow sine in [-amp, +amp]. hz≈0.1 → one full breath per 10s. Deterministic
// in tMs so two surfaces sharing a phase stay locked. When `reduced`, amp folds
// to 0 (a still light) per the a11y floor.
export function breath(tMs, opts = {}) {
  const { hz = 0.1, amp = 1, phase = 0, reduced = false } = opts
  if (reduced || amp === 0) return 0
  return amp * Math.sin(2 * Math.PI * hz * (tMs / 1000) + phase)
}

// ── swell ───────────────────────────────────────────────────────────────────
// Ease a value from → to by an eased blend factor k ∈ [0,1]. k is clamped; k=0
// returns `from`, k=1 returns `to`. The easing is EASE.settle (out-expo) applied
// to k so a linearly-growing k still reads as a decisive glide.
export function swell(from, to, k) {
  const kk = k < 0 ? 0 : k > 1 ? 1 : k
  return from + (to - from) * easeSettle(kk)
}

// A frame-rate-independent blend factor for exponential approach toward a
// target with time-constant tauSec: newValue = swellApproach(value, target,
// swellRate(dt, tau)). At dt=tau, ~63% of the remaining distance is covered.
export function swellRate(dtSec, tauSec) {
  if (tauSec <= 0) return 1
  const r = 1 - Math.exp(-Math.max(0, dtSec) / tauSec)
  return r < 0 ? 0 : r > 1 ? 1 : r
}

// Linear approach by rate k (already frame-rate-independent via swellRate). No
// easing curve — use when the caller wants a plain exponential smoother.
export function swellApproach(value, target, k) {
  const kk = k < 0 ? 0 : k > 1 ? 1 : k
  return value + (target - value) * kk
}

// ── strike ────────────────────────────────────────────────────────────────
// Instant attack then exponential decay. Returns `peak` at ageMs<=0 and decays
// toward 0 with the given decayMs time-constant. When `reduced`, a strike is a
// single flash: full `peak` for the first frame-ish (<= ~1 frame at 60fps) then
// 0 — no animated tail.
export function strike(ageMs, opts = {}) {
  const { decayMs = 600, peak = 1, reduced = false } = opts
  if (ageMs <= 0) return peak
  if (reduced) return ageMs <= 16 ? peak : 0
  if (ageMs >= decayMs * 6) return 0 // ~e^-6 ≈ 0.0025, treat as done
  return peak * Math.exp(-ageMs / decayMs)
}

// Whether a strike started at `startMs` is still visibly alive at `nowMs`.
export function strikeAlive(startMs, nowMs, opts = {}) {
  const { decayMs = 600, reduced = false } = opts
  const age = nowMs - startMs
  if (age < 0) return false
  return reduced ? age <= 16 : age < decayMs * 6
}

// EASE.settle is a cubic-bezier control-point array [x1,y1,x2,y2]; evaluate it
// at t via Newton's method on x, then read y. Small fixed iteration count keeps
// it allocation-free and cheap enough for a per-frame call.
function easeSettle(t) {
  const [x1, y1, x2, y2] = EASE.settle
  if (t <= 0) return 0
  if (t >= 1) return 1
  // Find parameter u such that bezierX(u) = t.
  let u = t
  for (let i = 0; i < 5; i++) {
    const x = bezier1(u, x1, x2)
    const dx = bezier1d(u, x1, x2)
    if (dx < 1e-6) break
    u -= (x - t) / dx
    if (u < 0) u = 0
    else if (u > 1) u = 1
  }
  return bezier1(u, y1, y2)
}

// Cubic bezier with P0=0, P3=1: 3(1-u)²u·p1 + 3(1-u)u²·p2 + u³.
function bezier1(u, p1, p2) {
  const mu = 1 - u
  return 3 * mu * mu * u * p1 + 3 * mu * u * u * p2 + u * u * u
}
function bezier1d(u, p1, p2) {
  const mu = 1 - u
  return 3 * mu * mu * p1 + 6 * mu * u * (p2 - p1) + 3 * u * u * (1 - p2)
}
