# Slice 5 — Longitudinal Mechanics (Design Spec)

**Date:** 2026-06-09 · **Author:** Knih + Claude · **Status:** Approved scope, pre-plan.
**Program context:** Fifth slice of the `new-research` spec integration (memory `project_spec_integration`). Slice 4 made the session record local-first (IndexedDB, with the AVD trajectory). **Slice 5 reads that archive to give the practice a longitudinal shape** — the additive "days of practice" frame, milestone detection (Bilderatlas triggers), and Bilderatlas-unlock/anniversary state — and surfaces the humane part on the close-of-session card.

Source: the Longitudinal Practice spec (Cluster C) — C2 (cadence), C3 (anti-dark-pattern return mechanics), C4 (Bilderatlas triggers).

## 1. Scope decisions (locked with the user)

- **Build now:** a pure **longitudinal-state engine** over the archive + a **modest humane surface** on the Settle card.
- **Defer — Orchestra cadence (C1):** the spec's "Orchestra = session 1 + monthly invitation" model is a phase-flow change and, per the spec itself (C8.2), a **reversible bet to test on a real device**. Bundling it with the engine muddies both. Orchestra stays every-session this slice; the cadence change is a focused follow-up.
- **Defer — the Bilderatlas *moment* UI (C4.4):** the navigable cosmos of *visited scenes* is blocked on the **Option-2 visual scene deck** (only one back-plane composition exists). We build the *trigger + detection + announcement*; the immersive moment lands when scene art exists. (Same staging as `selectScene` in Slice 1.)
- **Out — notifications / opt-in ritual reminder (C3.3):** a web-push feature; the spec's Slice-5 commitment is mostly the *absence* of dark patterns, which we already satisfy. No notifications exist and none are added.

## 2. The engine — `src/lib/longitudinal.js` (pure, tested)

All functions are pure over a `records` array (the `SessionRecord[]` from `sessionStore.getEntries()` / the archive). No DOM, no storage.

- **`MILESTONES = [30, 100, 365, 1000]`** — the Bilderatlas session-count thresholds (C4.3).
- **`MILESTONE_MEANING`** — editable copy data: `{30:'one month of practice', 100:'a body of work', 365:'one year', 1000:'a thousand'}` (the spec's glosses; wording is Knih's to edit).
- **`daysOfPractice(records)`** — count of **distinct local calendar days** with ≥1 session. The C3.3 anti-dark-pattern number: additive, cumulative, **cannot break, only grow** (NOT a streak / "days in a row").
- **`isMilestone(count)`** — is this exact session count one of `MILESTONES`.
- **`nextMilestone(count)`** — at the close of a session (where `count = records.length` *includes* the just-finished session), returns the milestone number if the **next** session would be a milestone (`count+1 ∈ MILESTONES`), else `null`. This drives the "announced at the prior session's close" trigger (C4.3).
- **`bilderatlasUnlocked(count)`** — `count >= 30`; the practitioner-initiated buried entry becomes available (staged for the deferred moment UI).
- **`anniversaryYear(records, now, windowDays = 3)`** — the integer year(s) since the first session when `now` falls within ±`windowDays` of the yearly anniversary of `records[0].startedAt` (the C4.3 "week surrounding the date" calendar trigger; autoethnographic, not solstice). Returns the year number or `null`. (Fixed 365-day years; leap drift stays within the window.)

## 3. The surface — `src/phases/Settle.jsx`

The close-of-session card already reads `getEntries()` and computes `isFirst`. By the time Settle renders, Slice 4 has persisted the just-finished session (written at `Admirer.onCommitEntry`, before Orchestra), so `getEntries()` includes it.

Add a **quiet, peripheral** longitudinal frame beneath the existing "settling" line, in the same cream-paper register (low opacity, italic serif, secondary ink):

- **Days of practice** — an additive line, e.g. *"{n} days of practice"* (singular handled for n=1). Never a streak, never "in a row", no loss framing (C3.3).
- **Milestone announcement** — when `nextMilestone(getEntries().length)` is non-null, a single line in the spec's register: *"Next time, if you choose, the room opens."* (C4.3 — the moment is announced at the prior session's close; the practitioner can defer; it never expires.)

Copy lives in the component (UI text); the numeric engine is the tested part. The announcement is **visual only** this slice — having the closing *Admirer voice* speak it (a dynamic-variable/contextual-update to the closing agent) is a follow-on that depends on the Slice 2 device-spike path.

No new chrome, no buttons, no count-up animation, no "summary" — the Bilderatlas "is the panels on the wall," not a summary (C4.4). The surface is deliberately understated.

## 4. Testing

`longitudinal.js` — Vitest unit tests over fixture records: distinct-day counting (same-day collapses to 1; multi-day counts), milestone boundaries (`isMilestone`/`nextMilestone` at 29→30, 30, 99→100, arbitrary), `bilderatlasUnlocked` at 30, `anniversaryYear` (inside/outside the window, multi-year). The Settle surface is UI glue (build + lint + manual), per the repo posture. Gate: `npm test`, `npm run build`, no new lint errors.

## 5. Out of scope / follow-ons
- Orchestra cadence change (C1) — reversible bet; focused follow-up after device testing.
- The Bilderatlas moment UI (C4.4) — blocked on the Option-2 visual scene deck.
- Spoken milestone announcement by the closing Admirer — depends on the Slice 2 device-spike path.
- Notifications / opt-in ritual reminder (C3.3) — web-push feature, later.
- The collective layer (C5) — separate concern, ties to the Supabase collective sky.
