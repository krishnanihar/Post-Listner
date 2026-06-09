# Slice 6 — Ship-Blocker Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Three safe runtime-hygiene wins from the Ship-Blockers spec: `latencyHint:'interactive'` on the rite audio context, `prefers-reduced-motion` respect (Framer + ambient Admirer sway), and Orchestra-scoped pause-on-hidden. Other §2/§4/§5 items (consent copy, CI/size budgets, AVIF) are deferred.

**Architecture:** A one-line context option; a pure `reducedMotion.js` util applied via `MotionConfig` + an Admirer-scene tilt gate; a small `useVisibilityAudioPause` hook used only in Orchestra. No new behavior in the conversational hot path.

**Design spec:** `docs/superpowers/specs/2026-06-09-slice6-ship-hardening-design.md`.

---

## File Structure
- **Modify** `src/engine/audio.js` — `latencyHint`.
- **Create** `src/lib/reducedMotion.js` (+ test).
- **Modify** `src/App.jsx` — wrap in `MotionConfig`.
- **Modify** `src/phases/admirer-scene/AdmirerScene3D.jsx` — gate ambient tilt.
- **Create** `src/hooks/useVisibilityAudioPause.js` (+ test).
- **Modify** `src/phases/Orchestra.jsx` — use the pause hook.

---

## Task 1: `latencyHint: 'interactive'`

**Files:** Modify `src/engine/audio.js`.

- [ ] **Step 1:** Read `src/engine/audio.js` around the constructor. Change the context creation line from:

```js
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()
```
to:
```js
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' })
```

- [ ] **Step 2: Verify the existing audio test still passes** — `npx vitest run src/lib/__tests__/audioEngine.drone.test.js` → PASS (the AudioContext mock ignores the option). If the test constructs a real/mocked context that rejects an options arg, report it rather than reverting.

- [ ] **Step 3: Commit**

```bash
git add src/engine/audio.js
git commit -m "feat(audio): latencyHint interactive on the rite context (tighter A/V sync)"
```

---

## Task 2: `prefers-reduced-motion` util + applications

**Files:** Create `src/lib/reducedMotion.js`, `src/lib/__tests__/reducedMotion.test.js`; modify `src/App.jsx`, `src/phases/admirer-scene/AdmirerScene3D.jsx`.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/reducedMotion.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prefersReducedMotion } from '../reducedMotion.js'

function mockMatchMedia(matches) {
  return vi.fn((query) => ({
    matches: query.includes('reduce') ? matches : !matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('prefersReducedMotion', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('is true when the reduce-motion query matches', () => {
    window.matchMedia = mockMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
  })
  it('is false when the query does not match', () => {
    window.matchMedia = mockMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })
  it('is false when matchMedia is unavailable', () => {
    const orig = window.matchMedia
    window.matchMedia = undefined
    expect(prefersReducedMotion()).toBe(false)
    window.matchMedia = orig
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/reducedMotion.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js
// src/lib/reducedMotion.js
// Respect the OS "reduce motion" accessibility setting (Ship-Blockers §4 a11y
// floor). Pure read of the media query, guarded for environments without
// matchMedia (returns false). Used to gate AMBIENT (non-essential) motion;
// essential interactive motion (Orchestra conducting) is left alone per
// WCAG 2.5.4. Mirrors the useDeviceMode matchMedia idiom.

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lib/__tests__/reducedMotion.test.js` → PASS.

- [ ] **Step 5: Apply A — wrap App in `MotionConfig`.** In `src/App.jsx`, the import is `import { AnimatePresence, motion } from 'framer-motion'`. Add `MotionConfig`:

```jsx
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
```

Read App's top-level `return (` (around line 174). Wrap the entire returned JSX tree in `<MotionConfig reducedMotion="user"> … </MotionConfig>` (it's a context provider with no DOM of its own, so it can wrap the existing outermost element without layout impact).

- [ ] **Step 6: Apply B — gate the Admirer ambient sway.** In `src/phases/admirer-scene/AdmirerScene3D.jsx`, add the import:

```jsx
import { prefersReducedMotion } from '../../lib/reducedMotion.js'
```

In `AdmirerScene3D`, read the preference once (alongside the other `useState` initializers, e.g. near `const [supported] = useState(() => hasWebGPU())`):

```jsx
  const [reducedMotion] = useState(() => prefersReducedMotion())
```

In the motion `useEffect` (the rAF `tick` that reads `readMotion()` and writes `tiltRef.current`), short-circuit when reduced so phone tilt never feeds the camera/particles (they stay at the neutral init `{ x: 0, y: 0, gamma: 0, beta: 0 }`). Change the effect guard from:

```js
    if (!supported) return undefined
```
to:
```js
    if (!supported || reducedMotion) return undefined
```

and add `reducedMotion` to that effect's dependency array (alongside `readMotion`, `supported`).

- [ ] **Step 7: Verify** — `npm run build` succeeds; `npx eslint src/App.jsx src/phases/admirer-scene/AdmirerScene3D.jsx src/lib/reducedMotion.js` → no NEW errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/reducedMotion.js src/lib/__tests__/reducedMotion.test.js src/App.jsx src/phases/admirer-scene/AdmirerScene3D.jsx
git commit -m "feat(a11y): prefers-reduced-motion — MotionConfig + gate Admirer ambient sway"
```

---

## Task 3: Orchestra-scoped pause-on-hidden

**Files:** Create `src/hooks/useVisibilityAudioPause.js`, `src/hooks/__tests__/useVisibilityAudioPause.test.js`; modify `src/phases/Orchestra.jsx`.

- [ ] **Step 1: Write the failing test**

```js
// src/hooks/__tests__/useVisibilityAudioPause.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVisibilityAudioPause } from '../useVisibilityAudioPause.js'

function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useVisibilityAudioPause', () => {
  afterEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  })

  it('suspends when hidden and resumes when visible', () => {
    const ctx = {
      state: 'running',
      suspend: vi.fn(() => { ctx.state = 'suspended' }),
      resume: vi.fn(() => { ctx.state = 'running' }),
    }
    renderHook(() => useVisibilityAudioPause(() => ctx, true))
    setHidden(true)
    expect(ctx.suspend).toHaveBeenCalled()
    setHidden(false)
    expect(ctx.resume).toHaveBeenCalled()
  })

  it('no-ops when the context is null', () => {
    renderHook(() => useVisibilityAudioPause(() => null, true))
    expect(() => setHidden(true)).not.toThrow()
  })

  it('does nothing when disabled', () => {
    const ctx = { state: 'running', suspend: vi.fn(), resume: vi.fn() }
    renderHook(() => useVisibilityAudioPause(() => ctx, false))
    setHidden(true)
    expect(ctx.suspend).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/hooks/__tests__/useVisibilityAudioPause.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js
// src/hooks/useVisibilityAudioPause.js
import { useEffect } from 'react'

// While `enabled`, suspend the audio context when the page is hidden and
// resume it when visible — a battery mitigation (Ship-Blockers §4). `getCtx`
// returns the AudioContext (or null). Tolerant of a null ctx / no document.
//
// Orchestra-scoped: deliberately NOT used during the live Admirer
// conversation, where suspending the context would break ElevenLabs voice
// capture. By the Orchestra phase the agent is done and the same context only
// drives stem playback.
export function useVisibilityAudioPause(getCtx, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined
    const onChange = () => {
      const ctx = getCtx?.()
      if (!ctx) return
      if (document.hidden) {
        if (ctx.state === 'running') ctx.suspend?.()
      } else if (ctx.state === 'suspended') {
        ctx.resume?.()
      }
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [getCtx, enabled])
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/hooks/__tests__/useVisibilityAudioPause.test.js` → PASS.

- [ ] **Step 5: Apply in `Orchestra.jsx`.** Read the file. Add the import:

```jsx
import { useVisibilityAudioPause } from '../hooks/useVisibilityAudioPause.js'
```

Inside the `Orchestra` component (after `audioCtxRef` is declared, around line 24), call the hook:

```jsx
  // Battery: suspend stem playback while the app is backgrounded. Safe here —
  // the live Admirer conversation is already over by the Orchestra phase.
  useVisibilityAudioPause(useCallback(() => audioCtxRef.current, []), true)
```

(`useCallback` is already imported in `Orchestra.jsx`. The stable getter keeps the hook's effect from re-subscribing each render.)

- [ ] **Step 6: Verify** — `npm run build` succeeds; `npx eslint src/phases/Orchestra.jsx src/hooks/useVisibilityAudioPause.js` → no NEW errors.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useVisibilityAudioPause.js src/hooks/__tests__/useVisibilityAudioPause.test.js src/phases/Orchestra.jsx
git commit -m "feat(battery): Orchestra-scoped pause-on-hidden (suspend/resume stem context)"
```

---

## Task 4: Full gate + docs

- [ ] **Step 1: Full gate** — `npm test` (no regressions; new `reducedMotion` + `useVisibilityAudioPause` suites pass), `npm run build` (clean), `npm run lint` (≤ ~149 baseline, no new errors).

- [ ] **Step 2: Update `CLAUDE.md`** — add `src/lib/reducedMotion.js` + `src/hooks/useVisibilityAudioPause.js` to the relevant lists; note `latencyHint:'interactive'` on the rite context, the `MotionConfig reducedMotion="user"` wrap + Admirer ambient-sway gate, and the Orchestra pause-on-hidden. Update the Slice status line: Slice 6 (the three runtime-hygiene wins) done — **all 6 planned slices complete**; remaining program items (consent copy, CI/size budgets, Orchestra cadence, Bilderatlas moment/Option-2, collective layer) are the documented deferrals.

- [ ] **Step 3: Update memory** `project_spec_integration.md` — Slice 6 done; the program's 6 planned slices are complete; list the standing deferrals + the user-run items.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: ship-blocker hardening — latencyHint + reduced-motion + pause-on-hidden (Slice 6)"
```

---

## Self-Review

**Spec coverage:** `latencyHint:'interactive'` (Task 1) ✓; reduced-motion respect — Framer via `MotionConfig` + ambient Admirer sway gated, Orchestra conducting left as essential motion (Task 2) ✓; Orchestra-scoped pause-on-hidden, NOT in the live-agent Admirer phase (Task 3) ✓. DPR/touch-fallback already done (no task). Consent copy, CI/size-limit, AVIF, audio-reactive uniforms — explicitly deferred per spec §1/§5.

**Placeholder scan:** every code step is complete; tests use the repo's existing `matchMedia`-mock + `renderHook` idioms; no invented APIs (`MotionConfig`, `ctx.suspend/resume`, `visibilitychange` are all standard).

**Type/name consistency:** `prefersReducedMotion` (Task 2) is imported the same in App-adjacent code + AdmirerScene3D + its test; `useVisibilityAudioPause(getCtx, enabled)` (Task 3) matches the Orchestra call + the test; the Admirer effect's new `reducedMotion` dep is the `useState`-derived value from Step 6; `audioCtxRef` is the existing Orchestra ref.
