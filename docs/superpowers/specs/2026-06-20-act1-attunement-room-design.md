# Act 1 redesign — The Attunement Room (hybrid taste extraction)

**Date:** 2026-06-20
**Branch:** `musicking` (extends the spec-integration program)
**Status:** Design approved; ready for implementation planning.

> Working title "The Attunement Room" is a design label, not a spoken name. The
> internal phase key stays `admirer` to preserve existing seams (see §11);
> renaming is optional later cleanup.

---

## 1. Summary

Replace the conversation-only Act 1 (the Admirer phase) with **one continuous
spatial-audio room the user plays with their body** — a mix of *talk, tap, and
move* — that is secretly **the Orchestra's conducting tutorial**. Every gesture
the user makes to express musical taste is a gesture they will later use to
conduct their song. The room's acoustic widens across the arc, so when taste
resolves the room is *already opening* into the Orchestra: no phase cut, one
breath.

The phase is **score-led**: the React client owns the choreography (movements,
music, timing, visuals, gesture detection, taste writes). The ElevenLabs
Admirer voice is a **companion layered on top** — it greets, guides, and reacts
to the body, but never controls pacing.

This honors the user's three asks: bring back *tap* and *move-the-phone* from the
original 9-phase rite, keep the *conversation*, and keep the *sonic/spatial*
design (the footsteps-with-headphones immersion) that flows seamlessly into the
Orchestra.

## 2. Goals

- Taste extraction becomes multi-modal: **talk + tap + move**, woven into a
  single scene.
- The phase **teaches all five Orchestra conducting gestures** as a precursor,
  so the Orchestra is pure payoff.
- The experience is **full-visual and full-spatial-audio at once** (immersion,
  not sensory deprivation), in the app's existing painterly idiom.
- The taste → song handoff into the Orchestra stays **frame-perfect and
  unbroken** (silent pre-load preserved).
- Reuse the existing AVD spine, HRTF room, gesture core, and the original rite's
  interaction patterns wherever possible.

## 3. Non-goals

- Not rebuilding the Orchestra phase, the audio engine, R2, or the relay.
- Not changing the desktop journal, Supabase, or the collective sky.
- Not a voice redesign (the Admirer voice direction is unchanged; this only
  changes *who controls pacing* and *what the voice reacts to*).
- Not removing the legacy `*.score.jsx` files (they remain on disk, unrouted).
- The visual theme does **not** migrate cream→dark across the arc (decision §10).

## 4. Background — what exists today

The current Admirer phase (`src/phases/Admirer.jsx`) is conversation-only:
push-to-talk voice, an authored seed deck the agent re-voices
(`nextQuestion`/`recordAnswer`), a blocking 3-fragment listening run (yes/no
tap), and a color-swatch selection seed. The only non-voice inputs are taps.

The pieces this redesign builds on are already in place:

- **Taste interface.** `src/lib/avdStore.js` `commitTurn(target, {gain,
  confidence})` is the modality-agnostic write into the signed `[-1,1]³` AVD
  vector. `src/lib/avdToStems.js` `mapAvdToStems()` already picks the archetype
  by nearest centroid and resolves stems. `src/lib/textureToAvd.js` maps a
  texture+intensity to an AVD target.
- **Visual feedback, already taste-bound.** `src/aureola-three-plane/` binds the
  AVD vector to a sacred-geometry shader: Arousal→rotation, Valence→gold↔cyan,
  Depth→outer-ring reveal (`MiddleShaderPlane.jsx`, `AvdShaderDriver.jsx`,
  `runtime.js`).
- **Spatial audio room.** `src/orchestra/AdmirerRoom.js` is a single-source HRTF
  room with `playFootsteps()` (a general "animate a sound from A→B in space"
  pattern), `rollToAzimuthOffset()` (phone roll → source azimuth), continuous
  `setExpansion(t)` / `beginExpansion()` (INTIMATE↔EXPANDED), and
  `captureAdmirerVoice()` (captures the SDK's hidden `<audio>` element). Presets
  in `src/lib/roomPresets.js`.
- **Gesture vocabulary.** `src/conducting/GestureCore.js` `read()` exposes
  `pan` (roll), `filterNorm` (pitch), `yaw` (compass), `gestureGain`
  (acceleration RMS), `articulation` (jerk), and one-shot `downbeat`. Subscribed
  via `src/hooks/usePhoneMotion.js`. iOS permission is already requested in the
  Entry "begin" tap.
- **Original rite interaction patterns (reusable mechanics).**
  `src/phases/Spectrum.score.jsx` (lean between poles + equal-power stereo
  cross-fade + dwell/reversal confidence + `vibrate` on commit),
  `src/phases/Textures.score.jsx` (tilt keep/let-go with hold-to-commit + touch
  fallback), `src/phases/Moment.score.jsx` (hedonic-peak detection over an
  ascending triptych), `src/phases/Gems.score.jsx` (tap-to-toggle tiles).
- **Seamless handoff.** `src/lib/stemPlayer.js` `load() → setVolume(0,0) →
  start()` pre-loads silently; `detachAndGetSources()` + `OrchestraEngine`
  `connectStems()` hands the running sources to the Orchestra within an audio
  frame. Carried via `revealAudioRef` + `stemsBundleRef` in `src/App.jsx`.

## 5. The experience — the six-beat arc

One continuous cream-paper room. Three "move" movements teach the five gestures
by **pairing them into musical moments** (so it never feels like drilling),
bookended by the arrival (already built) and the bloom (the song materializing).

| # | Beat | Modality | Teaches | Writes (taste) | Sound | Visual | Commit |
|---|------|----------|---------|----------------|-------|--------|--------|
| 0 | **Arrival** | talk | — | gentle A/V seed | footsteps walk up (built); *"what's around you?"* | shader ground breathing, faint | user speaks one answer → texture→AVD |
| 1 | **Lean & Lift** | move: roll + pitch | tilt L/R, tilt fwd/back | **Valence** (lean) + **Depth** (lift) | two textures in HRTF L/R, equal-power cross-fade by roll; fwd/back opens a filter (light↔shadow) | two presences L/R over the shader; field warms/cools live | hold the lean past threshold → `commitTurn` + haptic |
| 2 | **Listen** | tap | — (still beat) | archetype/era direction | 2 short pieces seated in front (HRTF) | minimal; the presences rest | tap yes/no (blocking, reuses fragment run) |
| 3 | **Rise** | move: size + downbeat | big/small arm, the down-stroke | **Arousal** + hedonic | a build climbs; gesture-size → swell gain; down-stroke → percussive transient + haptic | the geometry intensifies/rotates faster with Arousal | ride or hold back through the peak → `commitTurn` |
| 4 | **Face** | move: yaw | turn to face | **Depth/archetype** (the commit) | six worlds ring the user in azimuth; the faced one brightens (yaw-spotlight) | six archetype presences arranged at their AVD coordinates; one blooms | face + hold → archetype committed |
| 5 | **Bloom** | handoff | (first conduct) | — | `beginExpansion()` + the silent song fades up *around* the user; voice recedes | shader climaxes; representational layer dissolves into the Orchestra | automatic → phase swaps to Orchestra |

Each commit also nudges `setExpansion(t)` upward, so the room is audibly wider
by the end and the bloom is a continuation, not a cut.

## 6. The five gestures → the Orchestra

By the bloom the user has rehearsed the entire conducting vocabulary with no
explicit lesson:

| Gesture | Taught in | Orchestra use (existing mapping) |
|---|---|---|
| Roll (tilt L/R) | Lean | per-stem HRTF azimuth offset (±27°) |
| Pitch (tilt fwd/back) | Lift | per-stem conducting filter cutoff (200–4000 Hz) |
| Gesture size | Rise | per-stem dynamics gain (0.15→1.0) |
| Downbeat (down-stroke) | Rise | accent: gain spike + transient + 15 ms haptic |
| Yaw (turn to face) | Face | facing-direction stem spotlight (±3.5 dB) |

## 7. Architecture — score-led

### 7.1 The choreographer (the "score")
A new client-owned state machine drives the arc: it sequences the six beats,
owns each movement's timing, starts/stops the audio for each, reads gesture
input, decides when a commit lands, writes taste, advances `setExpansion(t)`,
and triggers the bloom. This replaces the agent-driven pacing of today's
Admirer. Suggested home: a `useAttunementScore` hook plus pure
movement-definition data (so wording/tuning is data, logic is testable) — mirrors
the Slice-2 "client owns the deck" pattern.

### 7.2 The Admirer as companion voice
The ElevenLabs agent still runs (reusing `src/hooks/useAdmirerAgent.js`) but is
demoted to a companion:
- **Arrival opener** — existing dynamic first-message (`admirerFirstMessage.js`).
- **Per-movement guidance** — short spoken cues as each movement opens.
- **Reactions to the body** — the choreographer sends `sendContextualUpdate()`
  with what the user just did ("leaned warm", "rode the climax", "turned toward
  the hearth world"); the agent voices a brief reaction.
- **One genuine spoken question** — the biography / "a song that's yours" beat,
  where the user actually answers aloud (reuses `recordAnswer`→`commitTurn`).

The agent never calls pacing tools; `nextQuestion`/`playFragment` blocking is
replaced by the choreographer's own sequencing. The push-to-talk button remains
only for the spoken-answer beats.

### 7.3 Gesture input layer
Reuse `GestureCore`/`usePhoneMotion` unchanged. Each movement subscribes to the
signals it needs (Lean: `pan`+`filterNorm`; Rise: `gestureGain`+`downbeat`;
Face: `yaw`). Commit mechanics reuse the dwell/hold-to-lock + reversal/confidence
logic from `Spectrum.score.jsx` / `Textures.score.jsx`, and `navigator.vibrate`
for haptics.

### 7.4 Spatial audio layer
Extend `AdmirerRoom` (or a sibling room owned by the choreographer) to host
multiple positioned sources, generalizing `playFootsteps()`:
- Lean: two looped textures at fixed L/R azimuths, cross-faded by roll via the
  equal-power curve (mirror `Spectrum`'s cross-fade) + `rollToAzimuthOffset`.
- Listen: fragment sources seated in front (reuse `fragmentBank.js`).
- Rise: one build source whose gain follows `gestureGain`; the down-stroke
  triggers a percussive transient.
- Face: six sources arranged in azimuth (a ring); the faced one is spotlit via
  the yaw mapping.
- Bloom: `beginExpansion()` + fade up the pre-loaded `StemPlayer`.

All sources share the single AudioContext (hard constraint).

### 7.5 Visual layer — hybrid
The AVD sacred-geometry shader is the **always-reacting ground** (free taste
feedback). Each movement layers in only the representational elements it needs:
two presences (Lean), the ring of six worlds (Face), ripples on the down-stroke
(Rise). Painterly, on-brand, maximal reuse. The room stays cream-paper.

### 7.6 Taste layer
Every movement writes through `commitTurn(target, {gain})`:
- Lean → Valence target (warm↔austere); Lift → Depth target (open/social↔inward).
- Listen → archetype/era nudge (keep the fragment-rating influence on routing).
- Rise → Arousal target scaled by swell size + tempo; hedonic flag from
  ride-vs-pull-back (reuse `Moment` hedonic logic).
- Face → confirm/snap toward the chosen archetype centroid.

The trajectory is recorded by `avdRecorder` (start at Arrival, stop at commit),
as today.

## 8. Taste → song routing

Routing stays `mapAvdToStems(getAvd(), {restricted, era})`. The novelty: **the
six worlds in *Face* are the six archetype centroids spatialized** (their
`scoringWeights` mapped into the signed AVD ring). Because Lean/Lift/Rise have
already moved the vector, the user enters *Face* already half-turned toward their
nearest centroid; facing confirms or adjusts it. Facing → the archetype is
committed; `era` (from Listen / a light prompt) picks the variation.

**Speculative pre-load.** Start `StemPlayer.load()` during *Rise* on the
in-progress vector's nearest archetype, `setVolume(0,0)`, `start()`. If *Face*
resolves to a different archetype, swap the load. This guarantees *Bloom* always
has audio ready, preserving the silent-preload seam.

## 9. The seamless seam

*Bloom* fires `beginExpansion()` while the silent `StemPlayer` fades up and the
voice recedes — all under the user's *Face* gesture, which is already a
conducting motion. The phase then swaps `admirer → orchestra`; the Orchestra
reads `revealAudioRef.current`, calls `detachAndGetSources()` →
`engine.connectStems()` within a frame (unchanged). The cream→dark theme change
happens at that swap exactly as today. Seams preserved: device-motion permission
(Entry tap), silent pre-load + `revealAudioRef`, `ReflectionSurface` mount guard,
`stemsBundle` carry, the AVD recorder + `onCommitEntry` session-record write.

## 10. Components & files

**New**
- `src/hooks/useAttunementScore.js` — the choreographer state machine.
- `src/lib/attunementMovements.js` — pure movement definitions (sequence,
  per-movement signals, AVD targets, gains, copy/cue ids). Data + logic split for
  testing.
- `src/phases/movements/` — `LeanLift.jsx`, `Listen.jsx`, `Rise.jsx`,
  `Face.jsx` presentational components (representational visuals over the shader).
- `src/lib/attunementToAvd.js` — pure mapping from each movement's raw input
  (roll/pitch/size/downbeat/yaw, dwell/confidence) to an AVD target.
- Optional `src/orchestra/AttunementRoom.js` if multi-source hosting outgrows
  `AdmirerRoom` (else extend `AdmirerRoom`).

**Modified**
- `src/phases/Admirer.jsx` — becomes the Attunement host: mounts the score,
  the movement components, the companion voice; keeps `onCommitEntry` +
  silent-preload + `revealAudioRef`.
- `src/orchestra/AdmirerRoom.js` — generalize source hosting (Lean pair, Face
  ring, Rise build) if not split out.
- `scripts/create-admirer-agent.js` / `update-admirer-agent.js` — agent prompt
  → companion-voice role; drop pacing tools, add a contextual-reaction style.
- `src/lib/avdToStems.js` — export the spatialized archetype ring (centroids →
  azimuths) for *Face*.

## 11. Decisions (resolved) & open questions

**Resolved in brainstorm**
- Teach **all five** gestures (not a focused three).
- **Six-beat arc**, three compound move-movements.
- **Full-visual**, **hybrid** language (shader ground + presences).
- **Score-led** (client owns choreography; voice is companion).
- **Keep cream** throughout (no theme migration).
- *Face* worlds = the six **archetype centroids**.
- **Speculative pre-load** during *Rise*.

**Open (resolve in planning / on device)**
- Exact AVD targets, gains, and dwell/confidence thresholds per movement (tune
  on device).
- Whether the spoken biography question is session-1-only (as today's seeds) or
  every session.
- Whether to extend `AdmirerRoom` or add `AttunementRoom`.
- *Rise* build asset(s): synthesized vs a short prepared stem.
- Phase-key rename (`admirer` → e.g. `attune`) — deferred to avoid touching the
  `ReflectionSurface`/relay mount guards now.

## 12. Fallbacks & accessibility

- **Touch fallback** for every gesture (drag to lean, tap-and-hold to commit,
  tap the beat, swipe to face) — reuse the existing touch paths in
  `Spectrum`/`Textures`/`ConductingEngine`.
- **No motion permission** → touch path; the room still runs.
- **`prefers-reduced-motion`** floor already in place (Slice 6); essential
  conducting motion is exempt per WCAG 2.5.4, ambient sway is gated.
- **Voice-capture failure** → voice plays unspatialized; the room continues.

## 13. Testing

- Pure-function unit tests (vitest) for: `attunementMovements` sequencing, the
  per-movement input→AVD mapping (`attunementToAvd`), the speculative-preload
  archetype pick, and the hedonic read in *Rise*.
- Reuse existing `avdStore` / `avdToStems` / `roomPresets` tests.
- The choreographer's live timers and the real-device gesture feel are
  user-run verification (headless tools can't synthesize DeviceOrientation /
  the live conversation) — same caveat as the rest of `musicking`.
- Gates: `npm run build` clean, `npm test` green, no new lint errors.

## 14. Out of scope / deferred

- Orchestra changes, voice redesign, desktop journal/collective, relay.
- The two "extra" gestures revealing *inside* the Orchestra (we teach all five
  here, so this is moot).
- Phase rename and any `*.score.jsx` deletion.
