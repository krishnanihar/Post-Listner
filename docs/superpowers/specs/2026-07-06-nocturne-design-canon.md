# Nocturne — the design canon

**Status:** CANON. The single source of truth for the PostListener "opera for one listener" re-forming.
Implements the plan `docs/superpowers/plans/2026-07-06-medialab-nocturne-plan.md`. Where this doc and the plan
disagree, this doc wins for values; the plan wins for orchestration. Invariants live in the plan §2 — sacred.

---

## 1. Position (defend verbatim)

PostListener is a **hyperinstrument for listening** — a chamber opera for an audience of one. The listener is the
performer: their natural gestures (lean, tilt, swell, strike, turn) are read as musical expression, first to *write*
a taste-coordinate (Act I) and then to *conduct* the music that coordinate summons (Act II). The machine generates
every sound; one thing remains human-authored by hand — the mapping from a person's response to its meaning to a
coordinate in Arousal·Valence·Depth space. That single authored layer is the instrument's soul and the thesis's
hinge: taste is the living residue of craft, and this is the instrument that lets you play it. Practiced ten minutes
at a time over months, the work is not any session but the accumulated record of a taste changing — an opera whose
season is a life.

**Standing subtitle:** *PostListener — an opera for one listener.*
**Arc names:** Overture (entry) · Act I — The Attunement Room · Act II — The Orchestra · Coda (settle). The
longitudinal journal is **the Season**.
**The voice:** the Admirer → **the Prompter** (the hidden opera role who attends to the performer and never performs).

---

## 2. Materials (the one rule)

**Light is the material of the living instrument. Paper is the material of the record.**

- **Light** (the WorldStage canvas) carries everything alive and in-the-moment: the Overture, all of Act I inside the
  lamp pool, Act II's hall, the constellation. It breathes, swells, and strikes; it never shows chrome.
- **Paper** (`<Paper>` DOM surfaces, ink type) is reserved for what persists: the name-slip in the Overture, the
  ClosingCard's Forer sentence, the Coda record, the Season journal, the `/statement` page. Paper does not animate
  beyond a settle; it is still, like a printed page.

The two never blend on one surface. A screen is either lamplit (light) or a page (paper). The seam between them is
the Overture's name-slip sliding away (paper → dark) and the Coda's card arriving (dark → paper).

---

## 3. Tokens (final values — Phase 1 adds these to `src/score/tokens.js` as `NOCTURNE`)

```
NOCTURNE = {
  stageBlack:   '#0B0908',   // warm near-black; the empty stage (reuses COLORS.paperDark)
  ember:        '#8C5A28',   // lamplight, coldest/dimmest end
  candle:       '#D4A053',   // lamplight, nominal — the heritage amber (COLORS.scoreAmber), continuity
  whiteGold:    '#F0E3C8',   // lamplight, hottest/brightest end (strike peaks, bloom center)
  moonSilver:   '#AEB4BD',   // RESERVED for the Prompter's presence only — never decorative
  paper:        '#F2EBD8',   // record surfaces only (= COLORS.paperCream)
  paperInk:     '#1C1814',   // ink on paper (= COLORS.inkCream)
}
```

**Lamplight gradient** (warmth `w ∈ [0,1]`): `ember → candle → whiteGold`. `w` is driven by pitch/filter in Act II
(closed filter = cooler/dimmer), by beat state in Act I, and pinned to `candle` at rest.

**Type.** Serif (`FONTS.serif`) stays; italic remains the Prompter's register. One line on screen at a time is the
norm — larger, sparser, no headers, no UI-chrome type. Mono (`FONTS.mono`) only for system whispers (timestamp,
days-of-practice) at low opacity.

**Motion grammar — three verbs, nothing else** (`src/lib/motionGrammar.js`):
- **breath** — idle presence. ~0.1 Hz sine, amplitude from a reduced-motion-aware token (→ 0 when reduced). Signature:
  `breath(tMs, { hz=0.1, amp=1, phase=0 }) → [-amp, +amp]`.
- **swell** — gesture-coupled ease toward a target. Uses `EASE.settle`. Signature:
  `swell(from, to, k) → value` where `k ∈ [0,1]` is an eased blend factor; `swellRate(dt, tauSec)` gives a
  frame-rate-independent `k`.
- **strike** — instant attack, exponential decay ~600ms. Signature: `strike(ageMs, { decayMs=600, peak=1 }) → [0,peak]`
  returning `peak` at `ageMs=0`, decaying to ~0.

Every animated thing in both acts must reduce to one of these three. Anything that can't is cut.

**Sound grammar.** Every state change is diegetic — a sound *from the room*, never a UI blip. See §5 palette.

---

## 4. The WorldStage (light model — Phase 1 implements)

One fullscreen 2D canvas, `src/world/WorldStage.jsx`, mounted in `App.jsx` as a sibling of `ReflectionSurface`
(outside the phase-swap `AnimatePresence`, below DOM content, `zIndex` under content but over background). No WebGL.

**Light field** (`src/world/lightField.js`, pure): a scene is a primary lamp + up to 6 secondary sources.
```
Source = { x, y, radius, warmth, intensity }   // x,y in 0..1 screen-normalized; warmth 0..1; intensity 0..1
Scene  = { pool: {x,y,radius}, warmth, breadth, sources: Source[] }
```
- `lampGradientStops(warmth)` → the 3-stop rgba array (ember→candle→whiteGold graded by warmth) for a radial fill.
- `compositeScene(ctx, scene, w, h, tMs)` → paints stage-black, then each source as an additive (`screen`) radial
  gradient; `breadth ∈ [0,1]` scales the primary pool radius from intimate (small, centered) to hall (fills frame).
  Pure of React; takes a 2D context. Deterministic given `tMs` (breath phase) — no `Math.random`, no `Date.now`.

**worldStore** (`src/world/worldStore.js`, momentBus idiom — subscribable imperative store):
- `setScene(partial)` — merge into the current scene target (pool/warmth/breadth/sources).
- `strike(x, y, intensity)` — enqueue a one-shot strike ring at a normalized point.
- `openHall(t)` — set breadth to `t ∈ [0,1]` (bloom coupling; visual only, driven off Orchestra's existing timeline).
- `pushTraceStroke(stroke)` / `getTrace()` / `resetTrace()` — the accumulating Act-I trace (survives phase swap).
- `subscribeWorld(fn)` / `getWorldState()` / `resetWorld()` — the WorldStage's read side; `reset` re-arms a rite.

`BackgroundGlyph` is retained and composited *within* the pool during Act I — the lamp illuminates the sacred
geometry rather than replacing it.

**Reduced motion.** When `prefersReducedMotion()`: breath amp → 0, strikes render as a single static flash frame
(no decay animation), scene transitions become instant crossfades. The pure libs take a `reduced` flag; the canvas
loop reads it once at mount (BackgroundGlyph discipline).

**Performance.** DPR cap 2; zero per-frame allocation in the rAF body (hoist the stops array + strike scratch);
`compositeScene` reuses a module-level gradient-stops buffer. Idle target < 2ms/frame.

**Flag.** All Nocturne rendering + theme sits behind `VITE_ENABLE_NOCTURNE` (default off → the shipped cream/dark
theme is byte-identical). When off, WorldStage renders nothing and `phaseTheme.inkForPhase` is unchanged.

---

## 5. SFX palette (Phase 4a generates once → `public/world/sfx/`, via `scripts/generate-world-sfx.js`)

Diegetic, room-sourced, calm. ~12–15 clips. Generation prompts (ElevenLabs SFX):

| id | when | prompt seed |
|---|---|---|
| `threshold` | Overture open | "a distant hall door opening onto a quiet room, soft reverberant air, no music" |
| `lamp-up` | lamp fades up | "a warm practical lamp switching on, faint filament hum settling, intimate" |
| `page-write` | name-slip signed | "a fountain pen writing one word on heavy paper, close and dry" |
| `seat` | take-your-seat | "a single chair settling on a wooden stage, soft, distant" |
| `beat-commit-warm` | leanLift/rise seal | "a low felt mallet on a warm wooden resonator, one soft strike, long decay" |
| `beat-commit-deep` | listen/face seal | "a muted double-bass pizzicato, deep and round, one note" |
| `pool-tip` | leanLift tilt | "cloth and air shifting as a light source moves, very soft, no tone" |
| `world-face` | face beat lights ring | "six faint struck wine glasses in a ring, barely audible, glassy" |
| `lamp-wide` | bloom / openHall | "a small room opening into a large hall, reverb tail lengthening, awe, no music" |
| `ember` | end fade | "a fire settling to embers, one soft collapse, warm" |
| `coda-settle` | Coda card arrives | "a page turning and settling flat on a desk, final, quiet" |
| `constellation-open` | constellation reveal | "night air opening to a wide sky, faint distant wind, spacious" |
| `season-open` | Season door | "a heavy book opening, pages fanning once, library-quiet" |

Wiring rules: each fires **once** per occurrence (idempotent by eventId, momentBus idiom); none strobe or startle;
respect reduced-motion's audio analog (no sudden loud transients — cap peak, soften attack when reduced).

---

## 6. Per-beat staging (shot-level — Phase 2/3 implement)

**Overture (`Entry.score.jsx`).** Dark stage; `lamp-up` as one lamp fades from ember to candle, finding center.
Headphone rite = "take your seat" (`seat`). The intro video is replaced by a 20s light-only overture on WorldStage
scored by the existing `threshold.mp3` swell (breath on the pool, one slow warmth rise). Typed name = **signing the
program**: the name is inked on a small paper slip (the one paper moment here) that slides away into the dark
(`page-write`). The name is never spoken (unchanged). Device-motion permission = "the baton wakes" — the lamp
brightens a notch on grant.

**Act I (overlays in `src/phases/attunement/` + `Admirer.jsx`).** Same choreography; light-native staging. All beats
live inside the lamp pool. `<Paper>` cards → serif line + gesture affordance floating in the pool.
- *arrival* — footsteps cross the dark (existing HRTF); the lamp finds the Prompter's seat (moon-silver glint at rest).
- *leanLift* — the pool itself tips with roll (WorldStage reads the same slider value the score reads); each
  brink-crossing commit leaves a trace stroke + `beat-commit-warm`; sub-round re-poling = the lamp re-centering.
- *listen* — the pool deepens/darkens with pitch (warmth cools inward); commit leaves a stroke + `beat-commit-deep`.
- *rise* — the pool grows with the energy meter (breadth up); the sealing strike whites it for one frame
  (`strike` verb + `beat-commit-warm`).
- *face* — six faint world-lights ring the darkness, **lit by the accumulated trace** (§7); yaw sweeps a beam among
  them (`world-face` on hover); the chosen bearing seals a stroke.
- *era (EraSearch)* — the one paper moment in Act I: a slip of paper in the pool (a remembered song is already a
  record).
- *reflect* — the Prompter speaks from the moon-silver register while the trace replays its strokes.
- *bloom* — `openHall(t)` runs on the same clock as `beginExpansion()`; light breadth and reverb widen together
  (`lamp-wide`). Visual-only coupling — the audio call path is untouched.

**Act II (`Orchestra.jsx`, `BriefingScreen.jsx`, `ClosingCard.jsx`).**
- Briefing — the baton SVG becomes the **Trace contracting to a cursor** over the same silent 12s.
- Bloom — the hall opens; light breadth follows the shipped reverb/gain envelopes (read, don't drive audio).
- Throne — the §7 paired-correlate system on the black stage.
- End fade — lights die to one ember (`ember`).
- ClosingCard — stays **paper**; the Forer sentence is the program's last page (`coda-settle`).

**Coda (`Settle.jsx`).** Paper record surface; keep the shipped closing voice + days-of-practice line. Two quiet
doors: the Season (journal pointer, `season-open`) and the **constellation** (`constellation-open`) — anonymized
taste-lights, own sessions warm-amber from the archive, the collective a dim mock haze, view-only, one honest line
("others are practicing too"), exit by touch. `src/phases/Constellation.jsx` + `src/lib/constellationLayout.js`
(AVD→sky position, seeded, tested) + mock data.

---

## 7. The gesture system — "I did that" (Phase 2a/3 implement)

**The Trace** (`src/world/TraceGlyph.jsx` + pure `src/world/traceModel.js`). Extracted from Orchestra's Throne glyph,
behavior-identical, keeping the isolation-from-the-conducting-loop pattern (never in the audio rAF hot path). Renders
the gesture correlate (roll→x, pitch→y, swell→size, downbeat→rings) in the lamplight color. **It exists in both acts.**
Act I: each committed gesture leaves a persistent stroke (leanLift brink-crossings, listen tilt path, rise sealing
strike, face bearing) — the listener watches their taste written in light. At bloom, the accumulated trace contracts
into the conducting cursor. Trace state lives in `worldStore` so it survives the phase swap.

**The legibility law (Throne pairing rule).** Every audio mapping gets a visual correlate < 100ms, from the same
motion verb, rendered by WorldStage + TraceGlyph — all reads from values `Orchestra.jsx` already extracts:
- roll → the hall's light pool shifts azimuthally with the stem field (swell).
- pitch → light color temperature (warmth cools/warms as the filter closes/opens).
- gesture size → glow amplitude (swell).
- downbeat → strike ring + one-frame hall flash (strike).
- yaw-spotlight → a faint beam toward the boosted quadrant (swell).

**Instrument-introduces-itself** (`VITE_ENABLE_THRONE_INTRO_RAMP`, default off). First ~20s of Throne: visual
correlates always run +30%→nominal; the audio dynamics multiplier ramps too **only behind the flag**. Mirrors Act I's
gain scheduling.

**Diegetic falter** (`VITE_ENABLE_FALTER`, default off). Sustained chaotic articulation (>4s over a jerk threshold)
eases hall reverb send down ~15%; settling restores it. Pure detector `src/lib/falter.js` (tested). Ship dark.

**Latency budget (document for the reviewer):** sensor → gain < 50ms; visual correlate < 100ms. Keep the shipped R2
attunement neutral-calibration and Throne auto-calibration.

---

## 8. Prompter copy (renamed + new lines; Phase 2c regenerates TTS)

The Prompter describes, never diagnoses; never speaks an archetype name or a number (Invariant 3). Voice
`xzZRXG86mSM3naOyL9fa` unchanged; clip filenames are ids and stay.

**Renamed self-reference** (wherever the old copy said "admirer"/named a role): "*think of me as the one who listens
for the orchestra — the prompter, in the box, out of the light.*" (spoken once, in arrival).

**Per-beat transfer lines (new, ~8):**
- leanLift seal: "*the orchestra will remember this lean.*"
- listen seal: "*and this — how far in you went.*"
- rise seal: "*that was the downbeat. it keeps it.*"
- face seal: "*you turned toward that one. it heard you.*"
- reflect open: "*here is what your hands just wrote.*"
- bloom → hall: "*now — the same room, opened. lift your hand.*"
- constellation open (Coda): "*others are practicing too. none of them are named.*"
- Season door (Coda): "*the record is yours, and only yours.*"

All copy is data — editable in `reflectionScript.js` / the first-message + welcome sources. Selection logic keys off
ids, never text.

---

## 9. What's real vs mock
Real: the whole instrument — gestures, AVD writing, generated music (flag-on) + catalog fallback, the seam, the
archive, the trace, all light/sound. Mock: the constellation's other-people data (labeled in-app and in the reel).
Deferred: real collective backend, Bilderatlas moment UI, custom R2 domain, dead-code cleanup.
