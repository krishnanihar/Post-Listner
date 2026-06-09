# Slice 6 — Ship-Blocker Hardening (Design Spec)

**Date:** 2026-06-09 · **Author:** Knih + Claude · **Status:** Approved scope, pre-plan.
**Program context:** Sixth and final planned slice of the `new-research` spec integration (memory `project_spec_integration`). Source: the Ship-Blockers spec §2 (audio/perf), §4 (battery/a11y), §5 (legal). The spec's spine items (AVD, local-first, EWMA) landed in Slices 1–5. Slice 6 is the **runtime-hygiene floor**.

## 1. Scope decisions (locked with the user)

Slice 6 is a *menu* of independent hardening items. We build the **three safe, applicable, code-shaped wins** and defer the rest.

**Build now:**
1. **`latencyHint: 'interactive'`** on the rite's AudioContext (Chris Wilson / Ship-Blockers §2 — the context "coincides with visual cues").
2. **`prefers-reduced-motion` a11y floor** — respect the OS setting: all Framer Motion animations via `MotionConfig reducedMotion="user"`, plus gating the Admirer scene's *ambient* phone-motion sway (the vestibular trigger).
3. **Battery: pause-on-hidden, Orchestra-scoped** — suspend/resume the audio context on `visibilitychange` **only in the Orchestra phase**.

**Audit (already done, no work):** DPR capped `[1,2]` on every Canvas; tilt **touch fallback** exists (`GestureCore`/`ConductingEngine`).

**Deferred / needs-you (out of this slice):**
- **DPDP/GDPR consent notice** — needs *legal copy* (English **+ Hindi**, per DPDP Rules 2025). Substance is Knih's; deferred until the copy exists.
- **`size-limit` CI + ≤125 KB-above-fold** — **no CI exists** (`.github/workflows` absent) and the budget needs lazy-loading R3F/Three after the intro (a code-splitting refactor). Its own follow-up effort.
- **AVIF/WebP assets** — tied to the deferred Option-2 visual scene deck.
- **AnalyserNode→band uniforms on the three-plane** — a feature (audio-reactive visuals), not hardening; the three-plane is tilt/AVD-driven by design.

## 2. Why these three are safe

- **`latencyHint`** is a constructor option on the one shared rite context (`src/engine/audio.js`, surfaced as `getAudioCtx()`); it tightens audio-visual sync with zero behavioral risk.
- **Reduced-motion** respects an explicit user accessibility preference. We reduce *ambient* motion (the Admirer's phone-tilt camera/particle sway) but **keep the Orchestra conducting motion** — that's user-driven *essential* interaction (WCAG 2.5.4's "essential" exception, which the spec cites). Disabling conducting would break the experience, not harden it.
- **Pause-on-hidden is Orchestra-scoped on purpose.** Suspending the context during the **live Admirer conversation** would break ElevenLabs voice capture. By the Orchestra phase the agent is finished and the same context only drives stem playback, so `suspend()`/`resume()` is safe there. Render-loop rAF already throttles in hidden tabs by default.

## 3. Implementation

### 3.1 `latencyHint` — `src/engine/audio.js`
The `AudioEngine` constructor creates `this.ctx = new (window.AudioContext || window.webkitAudioContext)()`. Add the option: `({ latencyHint: 'interactive' })`. This is the single context used across the whole rite (Admirer voice room → stems → Orchestra). Verify the existing `audioEngine.drone.test.js` still passes (the test's AudioContext mock ignores the option).

### 3.2 Reduced motion — `src/lib/reducedMotion.js` (pure, tested) + two applications
- **`prefersReducedMotion()`** — reads `matchMedia('(prefers-reduced-motion: reduce)').matches`, guarded for environments without `matchMedia` (returns `false`). Mirrors the `useDeviceMode` matchMedia idiom; unit-tested with a `matchMedia` mock.
- **Application A — Framer Motion:** wrap App's returned tree in `<MotionConfig reducedMotion="user">` (from `framer-motion`). Every motion component then respects the OS setting (transforms collapse, opacity-only).
- **Application B — Admirer ambient sway:** in `AdmirerScene3D`, read `prefersReducedMotion()` once at mount; when true, **don't feed phone tilt** into `tiltRef` (keep it neutral), so the camera/particles don't sway with device motion. The geometry still forms; only the vestibular motion coupling is removed.

### 3.3 Pause-on-hidden — `src/hooks/useVisibilityAudioPause.js` + Orchestra
- **`useVisibilityAudioPause(getCtx, enabled)`** — a hook: while `enabled`, attaches a `visibilitychange` listener that calls `getCtx()?.suspend()` when `document.hidden` and `getCtx()?.resume()` when visible. Cleans up the listener on unmount; tolerant of a null context / no `document`.
- **Apply in `Orchestra.jsx`:** `useVisibilityAudioPause(() => audioCtxRef.current, true)`. Orchestra already manages this context (`audioCtxRef`, and an existing `if (state==='suspended') resume()`), so the hook composes cleanly. **Not used in Admirer** (live agent).

## 4. Testing
- `reducedMotion.js` — Vitest with a `matchMedia` mock (mirrors `useDeviceMode.test.js`): returns the query's `matches`, returns `false` when `matchMedia` is absent.
- `useVisibilityAudioPause` — a light Vitest/jsdom test: define `document.hidden` + dispatch `visibilitychange`, assert `suspend`/`resume` called on a stub ctx; no-ops on a null ctx; removes the listener on unmount.
- `latencyHint` + the App/AdmirerScene/Orchestra wiring are verified by `npm run build` + `npm run lint` + the existing suites (no regressions).
- Gate: `npm test`, `npm run build`, `npm run lint` ≤ ~149 baseline (no new errors).

## 5. Out of scope / follow-ons
- DPDP/GDPR consent notice (legal copy, EN+HI) — when copy exists.
- `size-limit` CI + ≤125 KB code-splitting — its own infra effort (no CI today).
- AVIF assets, audio-reactive three-plane — deferred / not-hardening.
- This is the last *planned* slice; remaining program items (Orchestra cadence C1, Bilderatlas moment + Option-2 scene deck, collective layer C5, notifications) are deferred as recorded in `project_spec_integration`.
