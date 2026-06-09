# Slice 5 — Longitudinal Mechanics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Read the Slice-4 archive to give the practice a longitudinal shape — a pure engine for the additive "days of practice" count, Bilderatlas milestone detection (30/100/365/1000), unlock + anniversary state — and a quiet humane surface on the close-of-session card (days of practice + the milestone announcement). Anti-dark-pattern by construction (no streaks, no loss framing).

**Architecture:** One pure module (`longitudinal.js`) over `SessionRecord[]`, consumed by `Settle.jsx`. No phase-flow change (Orchestra cadence deferred); no Bilderatlas *moment* UI (deferred, asset-blocked).

**Design spec:** `docs/superpowers/specs/2026-06-09-slice5-longitudinal-mechanics-design.md`.

---

## File Structure
- **Create** `src/lib/longitudinal.js` (+ test) — the pure engine.
- **Modify** `src/phases/Settle.jsx` — the humane surface.

---

## Task 1: `longitudinal.js` — the engine

**Files:** Create `src/lib/longitudinal.js`, `src/lib/__tests__/longitudinal.test.js`.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/__tests__/longitudinal.test.js
import { describe, it, expect } from 'vitest'
import {
  MILESTONES, MILESTONE_MEANING, daysOfPractice, isMilestone, nextMilestone,
  bilderatlasUnlocked, anniversaryYear,
} from '../longitudinal.js'

const DAY = 86400000
const rec = (startedAt) => ({ startedAt })

describe('longitudinal — constants', () => {
  it('milestones + meanings', () => {
    expect(MILESTONES).toEqual([30, 100, 365, 1000])
    expect(MILESTONE_MEANING[30]).toBeTruthy()
    expect(MILESTONE_MEANING[1000]).toBeTruthy()
  })
})

describe('daysOfPractice — additive distinct days', () => {
  it('is 0 for no records', () => {
    expect(daysOfPractice([])).toBe(0)
  })
  it('collapses multiple same-day sessions to one day', () => {
    const t = 1_000_000_000_000
    expect(daysOfPractice([rec(t), rec(t + 3600_000), rec(t + 7200_000)])).toBe(1)
  })
  it('counts distinct calendar days', () => {
    const t = 1_000_000_000_000
    expect(daysOfPractice([rec(t), rec(t + DAY), rec(t + 2 * DAY)])).toBe(3)
  })
})

describe('milestones', () => {
  it('isMilestone', () => {
    expect(isMilestone(30)).toBe(true)
    expect(isMilestone(31)).toBe(false)
    expect(isMilestone(1000)).toBe(true)
  })
  it('nextMilestone announces the upcoming milestone at the prior close', () => {
    expect(nextMilestone(29)).toBe(30)
    expect(nextMilestone(30)).toBeNull()
    expect(nextMilestone(99)).toBe(100)
    expect(nextMilestone(5)).toBeNull()
  })
  it('bilderatlasUnlocked at >=30', () => {
    expect(bilderatlasUnlocked(29)).toBe(false)
    expect(bilderatlasUnlocked(30)).toBe(true)
  })
})

describe('anniversaryYear', () => {
  const first = 1_000_000_000_000
  const YEAR = 365 * DAY
  it('null before the first year', () => {
    expect(anniversaryYear([rec(first)], first + 100 * DAY)).toBeNull()
  })
  it('returns 1 within the window of the first anniversary', () => {
    expect(anniversaryYear([rec(first)], first + YEAR)).toBe(1)
    expect(anniversaryYear([rec(first)], first + YEAR + 2 * DAY)).toBe(1)
  })
  it('null outside the window', () => {
    expect(anniversaryYear([rec(first)], first + YEAR + 10 * DAY)).toBeNull()
  })
  it('returns 2 at the second anniversary', () => {
    expect(anniversaryYear([rec(first)], first + 2 * YEAR)).toBe(2)
  })
  it('null for empty records', () => {
    expect(anniversaryYear([], 12345)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/__tests__/longitudinal.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js
// src/lib/longitudinal.js
// Pure longitudinal derivations over the session archive (SessionRecord[]).
// The anti-dark-pattern frame (Longitudinal spec C3): the only count shown is
// "days of practice" — additive, cumulative, it cannot break, only grow. No
// streaks. Milestones drive the Bilderatlas triggers (C4). Slice 5.

export const MILESTONES = [30, 100, 365, 1000]

// Editable copy data (the spec's glosses; Knih's to revise).
export const MILESTONE_MEANING = {
  30: 'one month of practice',
  100: 'a body of work',
  365: 'one year',
  1000: 'a thousand',
}

// Distinct LOCAL calendar days with at least one session — additive, never a
// streak. Cannot break, only grow.
export function daysOfPractice(records) {
  const days = new Set()
  for (const r of records || []) {
    const d = new Date(r.startedAt || 0)
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  }
  return days.size
}

export function isMilestone(count) {
  return MILESTONES.includes(count)
}

// At a session's close (count = records.length, INCLUDING the just-finished
// session), returns the milestone the NEXT session would hit, else null — the
// "announced at the prior session's close" trigger (C4.3).
export function nextMilestone(count) {
  return MILESTONES.includes(count + 1) ? count + 1 : null
}

// The practitioner-initiated buried Bilderatlas entry unlocks at session 30.
export function bilderatlasUnlocked(count) {
  return count >= 30
}

const YEAR_MS = 365 * 86400000

// The integer year(s) since the first session when `now` falls within
// ±windowDays of the yearly anniversary of records[0].startedAt (the C4.3
// "week surrounding the date" calendar trigger). Returns the year or null.
export function anniversaryYear(records, now, windowDays = 3) {
  if (!records || records.length === 0) return null
  const first = records[0].startedAt || 0
  const elapsed = now - first
  if (elapsed < YEAR_MS - windowDays * 86400000) return null
  const years = Math.round(elapsed / YEAR_MS)
  if (years < 1) return null
  const anniversaryTs = first + years * YEAR_MS
  return Math.abs(now - anniversaryTs) <= windowDays * 86400000 ? years : null
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/lib/__tests__/longitudinal.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/longitudinal.js src/lib/__tests__/longitudinal.test.js
git commit -m "feat(longitudinal): days-of-practice + Bilderatlas milestone engine"
```

---

## Task 2: The humane surface on `Settle.jsx`

**Files:** Modify `src/phases/Settle.jsx`. UI glue — verified by build + lint.

- [ ] **Step 1: Add the import** (alongside the existing `getEntries` import):

```jsx
import { daysOfPractice, nextMilestone } from '../lib/longitudinal.js'
```

- [ ] **Step 2: Compute the longitudinal state in `SettleInner`** (near the existing `isFirst` line):

```jsx
  const entries = getEntries()
  const days = daysOfPractice(entries)
  const milestone = nextMilestone(entries.length)
```

- [ ] **Step 3: Render the quiet frame** beneath the existing "settling" `AnimatePresence` block, still inside the centered column `div`. Match the cream-paper register (italic serif, secondary ink, low opacity). Insert after the closing `</AnimatePresence>`:

```jsx
          <div style={{
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 11,
            letterSpacing: 0.3,
            color: COLORS.inkCreamSecondary,
            opacity: 0.45,
            textAlign: 'center',
          }}>
            {days <= 1 ? 'your first day of practice' : `${days} days of practice`}
          </div>
          {milestone && (
            <div style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 12,
              letterSpacing: 0.3,
              color: COLORS.inkCreamSecondary,
              opacity: 0.55,
              textAlign: 'center',
              maxWidth: 280,
            }}>
              Next time, if you choose, the room opens.
            </div>
          )}
```

(No count-up animation, no buttons, no chrome — the frame is deliberately understated per C4.4.)

- [ ] **Step 4: Verify** — `npm run build` succeeds; `npx eslint src/phases/Settle.jsx` reports no NEW errors (the file already imports `FONTS`/`COLORS`/`getEntries`).

- [ ] **Step 5: Commit**

```bash
git add src/phases/Settle.jsx
git commit -m "feat(longitudinal): quiet days-of-practice + milestone announcement on Settle"
```

---

## Task 3: Full gate + docs

- [ ] **Step 1: Full gate** — `npm test` (no regressions; the new `longitudinal` suite passes), `npm run build` (clean), `npm run lint` (≤ ~149 baseline, no new errors).

- [ ] **Step 2: Update `CLAUDE.md`** — add `longitudinal.js` to the lib list (days-of-practice + milestone engine, reads the Slice-4 archive); note the Settle card now shows the additive days-of-practice + the milestone announcement; update the Slice status line: Slice 5 (longitudinal engine + humane surface) done — Orchestra cadence (C1) + the Bilderatlas moment UI deferred; Slice 6 (ship-blocker hardening) next.

- [ ] **Step 3: Update memory** `project_spec_integration.md` — Slice 5 done (engine + surface; cadence + moment-UI deferred), Slice 6 next.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: longitudinal mechanics engine + humane surface (Slice 5)"
```

---

## Self-Review

**Spec coverage:** days-of-practice additive count (Task 1, `daysOfPractice`) ✓; no streaks / no loss framing (by construction — only `daysOfPractice` is surfaced, no "in a row") ✓; Bilderatlas milestone thresholds 30/100/365/1000 (`MILESTONES`) ✓; "announced at prior close" trigger (`nextMilestone`) ✓; unlock-at-30 + anniversary state (`bilderatlasUnlocked`, `anniversaryYear`) — built + tested, staged for the deferred moment UI ✓; humane surface on the close card (Task 2) ✓. Orchestra cadence (C1), the Bilderatlas moment UI (C4.4), spoken announcement, notifications, collective layer — all explicitly deferred per the spec §1/§5.

**Placeholder scan:** every code step complete; the announcement copy is the spec's line (editable in the component); test expectations hand-checked against the year/window math.

**Type/name consistency:** `daysOfPractice`, `nextMilestone`, `MILESTONES`, `MILESTONE_MEANING`, `isMilestone`, `bilderatlasUnlocked`, `anniversaryYear` (Task 1) are consumed with matching names in the test and in `Settle.jsx` (Task 2 uses `daysOfPractice` + `nextMilestone`); records use the `SessionRecord` shape (`startedAt`) produced by Slice 4's `buildSessionRecord` and returned by `sessionStore.getEntries()`.
