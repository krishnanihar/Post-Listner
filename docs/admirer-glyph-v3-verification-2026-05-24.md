# BackgroundGlyph v3 — manual verification (2026-05-24)

Manual Chrome DevTools walkthrough of the four release stages, with
side-by-side comparison to the assigned source tile.

## Setup

- Branch: `musicking`
- Most recent commit at verification: `b073d95`
- Dev server: `npm run dev` at `https://localhost:5173/?s=ABCDEFGH` (the
  `?s=` query forces the phone-app root)
- Chrome DevTools MCP driving a 390×844 mobile viewport
- localStorage cleared at run start

## Stage 1 — Scatter (release = 0.08)

Screenshot: `tmp/qa-screenshots/v3-1-scatter.png`

- [x] Particles visible as scattered dots
- [x] Hint of shape barely perceptible at 8% (mount pre-release)
- [x] SVG overlay at opacity 0 (release ratio below SVG_FADE_IN_START = 0.7)
- [x] State label "arriving" — Admirer SDK still connecting

## Stage 2 — Mid-form (release = 0.88, after simulated 4-turn conversation)

Screenshot: `tmp/qa-screenshots/v3-2-midform.png`

- [x] Geometry recognisable as Layer_8 — hexagonal mandala
- [x] Particles clustered along source-tile features
- [x] SVG overlay appearing (release > 0.7, opacity easing toward target)
- [x] Active question displayed: "what about question 4?"

## Stage 3 — Fully formed (release = 1.0 via startGeneration)

Screenshot: `tmp/qa-screenshots/v3-3-fully-formed.png`

- Assigned tile: **Layer_8** (viewBox centre 68, 169 matches the lookup table)
- [x] SVG opacity = 1 (fully visible)
- [x] Particles fully transparent (faded out)
- [x] 25 paths from Layer_8 all rendered with original fills

## Stage 4 — Source comparison

Source screenshot: `tmp/qa-screenshots/v3-4-source-comparison.png` (Layer_8 cropped to bbox 30 127 74 84 at 390×390)

- [x] Filled regions render — thick hexagon outline, thick central circle
- [x] Internal triangle / X pattern matches
- [x] Smaller circles inside central circle present
- [x] Overall shape unmistakably matches the source

### Observations

At the phone-viewport scale (geometry fits in a 62vmin block ~250×250),
fine source details are present in the rendered SVG but may be sub-pixel:

- The "double-walled" outer hexagon in the source (two parallel paths
  forming a thick frame) may visually merge into a single thicker line
  at smaller scale.
- Corner dots (4-6 small filled dots) and edge tick marks ARE rendered
  (every path from Layer_8 is in the SVG overlay's `pathElements`) but
  may not be perceptible without zoom.
- The vertical center line and other fine accents are similarly present
  in the rendered SVG but small at this scale.

These are scale artefacts, not rendering correctness issues. The final
state literally IS the source SVG (with original fills) at full opacity.
Fidelity is guaranteed by construction.

## Phone-movement reactivity

Not exercised in this run (Chrome DevTools MCP does not synthesise
DeviceOrientation events). The physics math is verified by unit tests
(`glyphPhysics.test.js` — 10 tests including the settled-particle
motion-coupling check). Phone-side movement verification is deferred to
the real-device walkthrough.

## Verdict

**PASS** — v3 produces a fully-formed visual that matches the source
tile (Layer_8 in this run), with editorial-moment bursts driving the
release schedule discretely:

- Mount: +0.08 (`'mount'`)
- 5 agent questions seen: +0.60 (`'question:0..4'`, +0.12 each — note
  the welcome message contains '?', so it counts as the first question)
- 4 user turns seen: +0.20 (`'user:1..7'`, +0.05 each on odd indices)
- startGeneration: +remainder to 1.0 (`'startGeneration'`)

Total: 0.08 + 0.60 + 0.20 + (snap to 1.0) = 0.88 → 1.0 ✓

The dual-clock dark-gap bug (canvas instant fade vs Motion 500ms tween)
flagged in the Task 4 review was fixed in `ca71a36` — both layers now
ease together via the single `animatedSvgOpacityRef` in the rAF loop.
No visible dark window observed during the 0.88 → 1.0 transition in
this verification.

## Manual-phone follow-up (deferred from this run)

Out of scope for the Chrome DevTools verification:
- Phone-tilt movement reactivity on un-settled particles
- Settled particles' weak motion coupling (subtle sway)
- Real microphone + agent speech driving the transcript (we simulated
  via direct `liveSession.addTranscriptLine` calls)
- The Admirer SDK's tentative→final dedupe behaviour (Task 5's
  index-keyed Set bookkeeping was designed for this but exercising it
  needs real SDK traffic)

These get verified during the real-device walkthrough scheduled as the
post-plan QA pass.
