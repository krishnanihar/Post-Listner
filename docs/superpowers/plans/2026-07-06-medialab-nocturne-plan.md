# PostListener → "An Opera for One Listener" — the Media Lab re-forming plan

**Status:** PLAN — not executed. Written by Fable for an Opus/Sonnet executor fleet.
**Companion docs:** `FABLE_MEDIALAB_BRIEF.md` (intent), `CLAUDE.md` (architecture, trust it), `docs/generative-music-integration.md` (the generated-music path), `thesis/thesis-gp.html` (the thesis).
**Executor:** you have no Fable follow-up. Every fork is resolved below. If reality contradicts the plan, protect the Invariants (§2) and the smallest-diff interpretation wins.

---

## 1. The concept (the position everything else serves)

**Position (defend this paragraph):** PostListener is a **hyperinstrument for listening** — a chamber opera for an audience of one. The listener is the performer: their natural gestures (lean, tilt, swell, strike, turn) are read as musical expression, first to *write* a taste-coordinate (Act I) and then to *conduct* the music that coordinate summons (Act II). The machine generates every sound; one thing remains human-authored by hand — the mapping from a person's response to its meaning to a coordinate in Arousal·Valence·Depth space. That single authored layer is the instrument's soul and the thesis's hinge: taste is the living residue of craft, and this is the instrument that lets you play it. Practiced ten minutes at a time over months, the work is not any session but the accumulated record of a taste changing — an opera whose season is a life.

**What changes conceptually (each with its one-line why):**

| Call | Decision | Why |
|---|---|---|
| Artifact name | Keep **PostListener**; add the standing subtitle **"an opera for one listener"** | The thesis-tied name stays legible; the subtitle plants it unmistakably in Machover's lineage without claiming it. |
| Arc naming | Frame the four phases as an opera: **Overture** (entry) · **Act I — The Attunement Room** · **Act II — The Orchestra** · **Coda** (settle); the longitudinal journal is **the Season** | The structure already is operatic; naming it makes the OotF resonance explicit and gives the redesign one organizing metaphor. |
| The voice's name | The Admirer becomes **the Prompter** (default; runners-up: *the Tuner*, *the Accompanist*) | An actual opera role — hidden in the box, attends to the performer, never performs — which satisfies the thesis's definition-by-negation and the pending rename (memory: "Admirer" rejected as spoken name). |
| Concept vs. thesis | Evolve the artifact freely; the four sacred claims (§2) are the fixed spine | Per the brief's default — the thesis is submitted; its load-bearing claims are also the lab's values, so they cost nothing to keep. |
| Collective register | **Design fully, build mocked**: an opt-in, view-only "night sky of tastes" constellation reachable from the Coda, fed by the local archive + `src/lib/mockCollective.js`-style anonymized data; real backend deferred | High OotF upside (City Symphonies), zero dark-pattern risk when view-only and opt-in, and mocking keeps this pass honest and in scope. |
| Aesthetic direction | **"Nocturne"** — one continuous dark-stage world where *light is the material of the living instrument and paper is the material of the record* (§3) | It dissolves the cream→dark theme discontinuity by making the sacred seam *visible*: the small lamplit room you attune in IS the hall that opens at bloom — the visual twin of the already-built INTIMATE→EXPANDED acoustic expansion. |
| Gesture language | Unify both acts around one persistent visual instrument-voice, the **Trace** (§4) — what Act I writes, Act II conducts with | "I did that" legibility requires the rehearsal and the performance to share one visible object; today the Throne glyph appears from nowhere. |
| Act-1 choreography | **Do not restructure** the 8-beat arc; re-form only visuals, motion, copy, sound | The arc just shipped (553 tests) and is not yet device-verified — compounding structural risk under a redesign is how seams break. |
| Music path | **Untouched.** No changes to StemPlayer / GenerativePlayer / spectralBands / OrchestraEngine routing / the bloom handoff | Continuity is sacred and just shipped; this pass is the visual/interaction/concept layer above it. |

**User decisions surfaced (defaults chosen; execution proceeds on defaults unless overridden):**
1. **Rename to "the Prompter"** — default YES. Cost: regenerate ~20 TTS clips via `scripts/generate-admirer-voice.js` (cheap). If NO: keep clips, voice stays role-only ("think of me as…"), everything else in this plan stands.
2. **Collective register mocked-now** — default YES (view-only constellation on Coda, mock data). If NO: Phase 4b is dropped cleanly; nothing depends on it.
3. **Spend ceiling** — default: TTS re-record + ~15 ElevenLabs SFX generations only; **no new music assets, no paid reel production** (reel is user-filmed per §8). Raise only by explicit instruction.

---

## 2. Invariants (the executor's constitution — check every diff against these)

1. **The one authored layer.** No agent may introduce ML/heuristic inference that authors the response→meaning→AVD mapping. The mapping tables (`attunementToAvd.js`, `textureToAvd.js`, `archetypeRing.js`, seed/AVD data) are human-authored data; visual redesign may not move decisions into generated logic.
2. **The seam is sacred.** Files that must not change behavior: `src/lib/stemPlayer.js`, `src/lib/generativePlayer.js`, `src/orchestra/spectralBands.js`, `src/lib/musicGen.js`, `src/orchestra/OrchestraEngine.js` (audio-graph portions), `src/lib/avdToStems.js`, `api/music.js`, the `detachAndGetSources → connectStems` call path in `Admirer.jsx`/`Orchestra.jsx`, and the `GEN_BLOOM_WAIT_MS` race. Visual code may *read* engine state; it may not sit in the conducting rAF loop's hot path (follow the existing Throne-glyph isolation pattern in `Orchestra.jsx`).
3. **Witness, not measurement.** No numeric AVD readouts, no personality labels, no archetype names spoken/shown to the listener. The Prompter describes, never diagnoses; the refusal-to-name stays.
4. **No dark patterns.** The constellation and Season surfaces are view-only, opt-in, streak-free; `daysOfPractice` framing only. If a design choice is right for retention and wrong for the practice, it is wrong.
5. **Gates green per phase:** `npm test` (553+), `npm run build`, `npm run lint` no NEW errors (baseline 146). `prefers-reduced-motion` floor holds (`src/lib/reducedMotion.js` + `MotionConfig`) — every new animated surface must respect it.
6. **Hydrate-before-render stands.** `main.jsx`'s `hydrateSessionStore()` ordering and `ReflectionSurface` mounting outside the phase-swap `AnimatePresence` in `App.jsx` are load-bearing; the new world layer must preserve both.
7. **Performance budget:** one shared fullscreen 2D canvas for the world (no new WebGL contexts in the main flow), DPR cap 2, zero per-frame allocation in rAF loops (follow `BackgroundGlyph`'s hoisting discipline), 60fps target / 30fps floor on mid phones.
8. **Flag-gate anything that changes audible behavior** (there are exactly two in this plan: §4.4 intro-ramp, §4.5 falter), default OFF, byte-identical when off — same discipline as `VITE_ENABLE_LIVE_MUSIC_GEN`.

---

## 3. The Nocturne design language (the spec Phase 0 canonizes, Phase 1 implements)

**World premise.** The entire experience happens on one dark stage. Act 0–I: a single warm practical light — a lamp's pool — holds the listener close. At bloom, the same space *opens*: the pool becomes a hall, light widens with the reverb. The Coda returns to lamplight, and the record is written on **paper** — the one bright material, reserved for what persists (Coda card, journal, statement). Two materials, one rule: **light = the living instrument; paper = the record.**

**Tokens (extend `src/lib/tokens.js`; retire `phaseTheme.js`'s two-theme model for a continuous one):**
- **Color:** stage-black `#0B0908` (warm, not blue); lamplight spectrum built on the heritage amber `#D4A053` (keep — continuity with everything shipped) graded from ember `#8C5A28` → candle `#D4A053` → white-gold `#F0E3C8`; one cool counterpoint, **moon-silver `#AEB4BD`**, reserved exclusively for the Prompter's presence (voice-active indicator, witness moments); paper `#F2EBD8` + ink `#1C1814` unchanged, appearing only on record surfaces.
- **Type:** keep EB Garamond / Iowan serif (italic remains the Prompter's register) but larger and sparser — one line on screen at a time is the norm; JetBrains Mono stays for system whispers (timestamps, days-of-practice). No headers, no UI chrome typography.
- **Light as layout:** composition is done with the lamp — where the light pool sits, how wide, how warm — not with boxes/cards. DOM content floats in the pool; `<Paper>` surfaces survive only on record screens.
- **Motion grammar** (new pure lib `src/lib/motionGrammar.js`, unit-tested): three verbs only, shared by UI and canvas — **breath** (idle ~0.1Hz sine, amplitude from reduced-motion-aware token), **swell** (gesture-coupled ease, the existing `EASE` token), **strike** (instant attack, ~600ms exponential decay). Every animated thing in both acts must be expressible as one of these; anything else is cut.
- **Sound grammar:** every state change is diegetic — a sound *from the room* (cloth, breath, a distant string, wood), never a UI blip. Extend `scripts/generate-world-sfx.js` to a palette of ~12–15 SFX (threshold, lamp-up, lamp-wide, page-write, beat-commit ×2, world-face, constellation-open, coda-settle, etc.), generated once, hosted in `public/world/sfx/`.
- **The WorldStage:** one new fullscreen 2D canvas component `src/world/WorldStage.jsx` mounted in `App.jsx` beside `ReflectionSurface` (outside `AnimatePresence`, below DOM content), driven by a pure light-field model `src/world/lightField.js` (lamp position/radius/warmth + up to 6 secondary sources; radial-gradient compositing, `screen`/`multiply` blends; no WebGL). Phases command it through a tiny imperative store (`src/world/worldStore.js`, momentBus idiom): `setScene({pool, warmth, breadth})`, `strike()`, `openHall(t)`. `BackgroundGlyph` (the sacred-geometry particle layer) is retained and composited *within* the pool during Act I — it becomes something the lamp illuminates.

---

## 4. The gesture system — making "I did that" undeniable

**4.1 The Trace (the unifying object).** Extract the Throne feedback glyph out of `Orchestra.jsx` into `src/world/TraceGlyph.jsx` + pure `src/world/traceModel.js` (tested), keeping its isolation-from-the-conducting-loop pattern. It renders the gesture correlate (roll→x, pitch→y, swell→size, downbeat→rings — as shipped) in the lamplight's color. **New: it exists in both acts.** In Act I, each beat's *committed* gesture leaves a persistent stroke on it (leanLift's brink-crossings, listen's tilt path, rise's sealing strike, face's chosen bearing) — the listener literally watches their taste being written in light. At bloom, the accumulated trace contracts into the conducting cursor: *you conduct with what you just wrote.* The trace state lives in `worldStore` so it survives the phase swap (same trick as `ReflectionSurface`).

**4.2 The cause→effect pairing rule (the legibility law).** Every audio mapping in the Throne gets a visual correlate < 100ms from the same motion-grammar verb, rendered by WorldStage + TraceGlyph: roll → the hall's light pool shifts azimuthally with the stem field; pitch → color temperature of the light (dark/warm when the filter closes); gesture size → glow amplitude (swell); downbeat → strike ring + a one-frame hall flash; yaw-spotlight → a faint beam toward the boosted quadrant. All reads come from the values `Orchestra.jsx` already extracts for the glyph — no new engine taps.

**4.3 Rehearsal that lands.** Each Act-I beat ends with an explicit transfer moment: the Prompter's line + the trace stroke sealing, staged as "the orchestra will remember this" (copy authored in Phase 2, spoken via new TTS clips). The Face beat's six worlds are lit *by* the accumulated trace — the light you wrote reveals what you can choose.

**4.4 The instrument introduces itself (flag `VITE_ENABLE_THRONE_INTRO_RAMP`, default off).** For the first ~20s of Throne, conducting-response gains run +30% and ramp to nominal — the first gestures unmistakably answer. Implemented as a time-scalar on the *visual* correlates always, and on the audio dynamics multiplier only behind the flag. Why gated: it changes audible behavior; honest per Invariant 8, and it mirrors Act I's existing gain-scheduling pedagogy.

**4.5 Diegetic falter (flag `VITE_ENABLE_FALTER`, default off; the parked Personal-Orchestra pattern, lite).** Sustained chaotic articulation (>4s above a jerk threshold) eases the hall reverb send down ~15% — the room audibly leans away; settling restores it. Pure detector in `src/lib/falter.js` (tested); ship dark, evaluate on device.

**4.6 Felt-agency hygiene (no behavior change):** keep the shipped R2 attunement neutral-calibration and Throne auto-calibration; verify the `devicemotion` subscription (`usePhoneMotion`) end-to-end in the on-device pass; document the gesture→sound latency budget (<50ms sensor→gain) in the design canon for the reviewer.

---

## 5. Per-phase experience spec (what each screen becomes)

- **Overture (entry, `Entry.score.jsx`):** dark stage, one lamp fading up; headphone rite as "take your seat"; the intro video replaced by a 20s light-only overture on WorldStage scored by the existing `threshold.mp3` swell; typed name becomes **signing the program** — the name is written in ink on a small paper slip that slides away (it is never spoken — unchanged constraint). Device-motion permission framed as "the baton wakes."
- **Act I beats (overlays in `src/phases/attunement/` + `Admirer.jsx`):** same choreography, re-formed staging. All beats live inside the lamp pool; `<Paper>` cards are replaced by light-native layouts (serif line + gesture affordance in the pool). Per-beat one-liners: *arrival* — footsteps cross the dark, the lamp finds the Prompter's seat; *leanLift/listen* — the pool itself tips/deepens with the tilt (WorldStage reads the same slider value), sub-round re-poling staged as the lamp re-centering; *rise* — the pool grows with the energy meter, the sealing strike whites it for a frame; *face* — six faint world-lights ring the darkness, lit by the trace (§4.3), yaw sweeps a beam among them; *era (EraSearch)* — the one paper moment in Act I: a slip of paper in the pool, because a remembered song is already a record; *reflect* — the Prompter speaks from the moon-silver register while the trace replays its strokes; *bloom* — `openHall(t)` runs on the same clock as `beginExpansion()` — light and reverb widen together (visual-only coupling; the audio call path untouched).
- **Act II (`Orchestra.jsx`, `BriefingScreen.jsx`, `ClosingCard.jsx`):** Briefing's baton SVG becomes the Trace contracting to a cursor over 12s (same silent rite, same duration); Bloom = the hall opening (light breadth follows the shipped reverb/gain envelopes); Throne = §4.2's paired-correlate system on the black stage; end fade = lights die to one ember; ClosingCard stays **paper** — the Forer sentence as the program's last page.
- **Coda (`Settle.jsx`):** paper record surface (keep the shipped closing voice + days-of-practice line); adds two quiet doors: the Season (journal pointer) and — default-on per §1.2 — **the constellation**: the stage fills with anonymized taste-lights (own sessions warm-amber from the archive; the collective as dim mock haze), view-only, one line of honest copy ("others are practicing too"), exit by touch. New `src/phases/Constellation.jsx` + pure `src/lib/constellationLayout.js` (AVD→sky position, seeded; tested) + mock data module.
- **The Prompter rename ripple:** copy pass over `reflectionScript.js` + first-message/welcome lines; regenerate clips via `scripts/generate-admirer-voice.js` (voice `xzZRXG86mSM3naOyL9fa` unchanged); filenames stay (they're ids, not names).

---

## 6. Execution plan — phases, orchestration shape, dependencies

**Global executor rules:** work on a branch `feat/nocturne`; land phases as separate commits; gates green before each phase closes; agents touching disjoint files may run in parallel (worktree isolation for the Phase-2 overlay fan-out); anything listed in Invariant 2 is read-only for every agent; every phase ends with the adversarial review named for it.

### Phase 0 — Canon (sequential; 1 author + 2 adversarial reviewers)
Write `docs/superpowers/specs/2026-07-06-nocturne-design-canon.md`: the §1 position verbatim, the §3 tokens with final hex/type/motion values, the full SFX palette list with generation prompts, the per-beat staging notes of §5 expanded to shot-level, all Prompter copy (renamed lines + the ~8 new transfer/constellation lines). **Adversarial reviews (parallel):** (a) *thesis-integrity lens* — check every canon line against Invariants 1/3/4; (b) *OotF-bar lens* — would this read as poetic/sculptural/ritual beside Brain Opera, or as a dark-mode reskin? Reviewer findings must be resolved in the canon before Phase 1. **Risk:** none (docs only).

### Phase 1 — WorldStage shell (strictly sequential; this touches the app spine)
Build `src/world/` (`WorldStage.jsx`, `lightField.js`, `worldStore.js`, tests for the pure libs); mount in `App.jsx` outside `AnimatePresence`; replace `phaseTheme.js` inkForPhase with continuous world-scene commands per phase (keep the `--ink` custom property mechanism — record surfaces still need it); wire reduced-motion (breath amplitude→0, transitions→crossfades); add the token extensions to `tokens.js`.
**Risk flags:** `main.jsx` hydrate ordering (do not move it); `ReflectionSurface` must keep persisting; the old cream theme must remain reachable until Phase 2 lands (feature-flag the world theme per-phase, `VITE_ENABLE_NOCTURNE`, so `main` stays shippable mid-build).
**Verify:** gates + a Playwright smoke walk of all four phases (desktop, mocked motion) screenshotting each; a perf check that WorldStage idles <2ms/frame (use the `scripts/snap-glb-v2.mjs` harness pattern).

### Phase 2 — Act I re-forming (fan-out after Phase 1)
- **2a (sequential first):** extract TraceGlyph (`src/world/TraceGlyph.jsx` + `traceModel.js` + tests) from `Orchestra.jsx` with behavior-identical Throne rendering — this is a refactor gate for everything downstream; then add Act-I stroke accumulation via `worldStore`.
- **2b (parallel, 4 agents, worktree isolation):** the beat overlays — agent A: Overture + arrival; agent B: LeanLift + Listen; agent C: Rise + Face; agent D: EraSearch + reflect staging in `Admirer.jsx`. Each re-forms visuals/copy per canon, no choreography/AVD-logic edits (the `useAttunementScore` hook and all `src/lib/attunement*.js` are read-only).
- **2c (after 2b):** Prompter copy + TTS regeneration (script run; user decision 1 gate).
**Verify:** gates; per-beat Playwright screenshots against canon; **adversarial review** — *choreography-preservation lens*: diff every overlay against the shipped gesture/commit logic and fail anything that changed a threshold, timer, or AVD write.

### Phase 3 — Act II legibility (sequential; nearest the seam)
Briefing re-form → Bloom light-coupling (`openHall` driven by the same timeline constants in `src/orchestra/constants.js`, values unchanged) → Throne §4.2 correlates → §4.4/§4.5 flags (dark) → ClosingCard paper pass.
**Risk flags:** every render addition must live outside the conducting rAF hot path (glyph isolation pattern); zero reads added inside `OrchestraEngine.tick`; the two flags byte-identical off.
**Verify:** gates; a forced-fallback + a generated-path smoke (mock via `VITE_MOCK_MUSIC`) proving the bloom seam timing is untouched; **adversarial review** — *seam-invariant lens*: line-by-line audit of any diff within 2 hops of Invariant-2 files, plus a frame-budget profile of Throne with all correlates on.

### Phase 4 — Coda + sound (parallel pair, after Phase 1; independent of 2/3)
- **4a:** SFX generation (skill/script) + diegetic wiring across all phases per canon.
- **4b:** Coda re-form + Constellation (mock) + `constellationLayout.js` tests (user decision 2 gate).
**Verify:** gates; audio-wiring checklist (every SFX fires once, respects reduced-motion's audio analog — no strobing/startling sounds); *no-dark-patterns lens* review on 4b copy + mechanics.

### Phase 5 — Verification sweep (sequential, after 2/3/4)
Full gates; complete Playwright visual walk (all phases, both flag states); lint delta audit; then **the human on-device checklist** appended to `docs/prod-test-checklist.md`: full arc under Nocturne, trace accumulation visible per beat, bloom light/sound co-expansion, Throne correlates <100ms felt, intro-ramp + falter flags evaluated ON, constellation on a real archive, reduced-motion pass, battery/thermal sanity. **Adversarial panel (3 parallel agents):** thesis-integrity, seam-invariant, performance/a11y — each must return "no finding" or the finding gets fixed before Phase 6.

### Phase 6 — Demonstration kit (parallel; docs/assets only)
- **6a Statement page:** a one-screen thesis-to-artifact statement at `/statement` (desktop route in `main.jsx`, paper material, ~300 words from the §1 position + one diagram of the authored layer). It is the thing a lab reviewer reads in 60 seconds.
- **6b Reel protocol:** a shot-list doc (`docs/portfolio-reel-shotlist.md`) for a 2–3 min user-filmed reel: real phone, real hands, one continuous session arc, cutaways to the trace and the bloom, no voiceover — the Prompter's own voice carries it; captions state what is real (everything on screen; the collective is mocked and the caption says so — felt-personalization honesty extends to the portfolio).
- **6c README/portfolio copy** refresh with the new framing.

**Dependency graph:** P0 → P1 → {P2a → P2b → P2c, P4a, P4b} ; P2a → P3 ; {P2,P3,P4} → P5 → P6. Parallel-safe: P2b's four agents; P4a∥P4b; P6a∥6b∥6c.

---

## 7. What's real vs. mock (say it plainly, everywhere)
Real: the whole instrument — gestures, AVD writing, generated music (flag-on) with catalog fallback, the seam, the archive, the trace, all light/sound. Mock: the collective constellation's other-people data (labeled in-app and in the reel). Deferred (not in this pass): real collective backend, Bilderatlas moment UI, custom R2 domain, dead-code cleanup (tracked in CLAUDE.md's parked list).

## 8. Effort/spend envelope
Executor compute: ~6 phases, ≈10–14 subagent tasks + 8 review agents. Paid API: one TTS batch (~25 clips), ~15 SFX generations — both one-time, cached in `public/`. No new music generation, no paid film. On-device pass + filming: the user's hands, ~2 hours.
