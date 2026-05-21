# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PostListener + The Orchestra

A two-act experience. **Act 1 — the Admirer:** an ElevenLabs Conversational AI voice has a ~5-minute conversation about the user's musical life and chooses a matched song. **Act 2 — The Orchestra:** that pre-recorded archetype-matched song plays through a 4-stem spatial audio graph the user conducts with their phone. The matched song is loaded silently during the conversation and continues unbroken into the Orchestra, where it materializes spatially around the listener.

Both acts are a single React app, one Vite project, one Vercel deploy. Audio assets are hosted on Cloudflare R2.

> **Branch note.** `main` runs the original 9-phase profiling rite (`entry → spectrum → depth → gems → moment → autobio → reflection → reveal → orchestra`). This branch — **`musicking`** — replaces phases 1–7 with the single Admirer conversation: the flow is `entry → admirer → orchestra → settle`. The 9-phase `*.score.jsx` files remain on disk, unrouted. The sections below describe the `musicking` flow; the Orchestra, conducting, audio engine, R2, and relay infrastructure are shared and unchanged from `main`.

> **Status — 2026-05-22.** Active work is the **desktop journal** (`/journal`). Slices 1–5 of the 6-slice plan (`docs/desktop-journal-design.md` §12) are built; **Slice 6 — the real collective — is next**. Slice 3, 4 & 5 specs and plans are at `docs/superpowers/specs/2026-05-21-desktop-journal-slice-{3,4,5}-*.md` and the matching `docs/superpowers/plans/`. All Slice 3–5 code is committed to `musicking` and **not yet pushed**; it passes `npm run build` and the 312-test suite, but the full phone→relay→Supabase manual run has not been done — verify a real QR-paired rite before relying on the loop.

## Tech Stack

- **React 19** + **Vite 7** (ES modules)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **Framer Motion** for animations and transitions
- **React Three Fiber** + **three.js** (`@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`) — the conductor routes and the desktop journal's 3D book
- **Vitest 4** + **jsdom** for pure-function unit tests (312 tests across `src/lib/__tests__/`, `src/orchestra/__tests__/`, `src/conductor-glb/`)
- **Web Audio API** — raw nodes only, no external audio libraries
  - PostListener: `src/engine/audio.js` (synthesis, MP3 playback for Spectrum/Moment)
  - Orchestra (v3): `src/orchestra/OrchestraEngine.js` (4-stem spatial graph, per-stem mono filter chain → HRTF panner with pre-HRTF mono reverb send, 6 image-source early reflections, binaural hall IR convolver, constant 10 Hz alpha binaural beats bypassing the compressor)
  - Stem playback: `src/lib/stemPlayer.js` — sample-aligned 4-source loop player decoded from R2 URLs
  - Legacy Chamber (v1): `src/chamber/engine/` (still on disk, not routed)
- **Audio assets** hosted on **Cloudflare R2** (free egress, $0/month at our scale). Runtime base URLs are env-driven (`VITE_STEMS_BASE_URL`, `VITE_MASTERS_BASE_URL`); local fallback is `/public/stems` and `/public/music` (gitignored).
- **Demucs (htdemucs)** via Python venv at `~/.venvs/demucs` for offline 4-stem separation (vocals/drums/bass/other) of the 24 Suno-generated archetype masters.
- **ElevenLabs Conversational AI** via **`@elevenlabs/react`** — the Admirer (Act 1) is a live conversational agent. Config lives in `scripts/create-admirer-agent.js`. See **The Admirer (musicking — Act 1)** below.
- **Server-side ElevenLabs proxy** in `api/` — the older per-line TTS path (`POST /api/admirer`, `eleven_v3`). Superseded on `musicking` by the Conversational AI agent; still on disk for `main`. `POST /api/compose` (Music API) is deprecated and unused.
- **DeviceMotionEvent / DeviceOrientationEvent** — phone-as-baton conducting (Orchestra) + the Build-A room azimuth and the glyph (Admirer). Permission is requested on the Entry "begin" tap.
- **Supabase** (`@supabase/supabase-js`) — Postgres + Google OAuth for the desktop journal's accounts + entries (`/journal`). See **Desktop journal** below.

## Architecture

### Phase Flow

`musicking` runs four phases — `src/App.jsx` holds `PHASES = ['entry', 'admirer', 'orchestra', 'settle']`:

`entry → admirer → orchestra → settle`

- **entry** — headphones prompt, intro video, typed name capture, device-motion permission request.
- **admirer** — a ~5-minute conversation with the Admirer (ElevenLabs Conversational AI). It elicits a musical direction and, via the `startGeneration` tool, resolves the matched archetype + variation's 4-stem set and silently loads the `StemPlayer`. See **The Admirer (musicking — Act 1)** below.
- **orchestra** — the 3-phase voice-free spatial conducting experience (unchanged — see the Orchestra v3 sections below).
- **settle** — the brief closing card after the song ends; routes back to entry.

The 9-phase profiling rite (`spectrum/depth/gems/moment/autobio/reflection/reveal`) and its AVD vector + 6×4 archetype scoring still exist on disk and on `main`, but are not in the `musicking` flow — the Admirer replaces them. Active phase components live in `src/phases/*.score.jsx`; pre-redesign components remain on disk, unrouted.

### Audio Continuity

During the **admirer** phase, when the Admirer calls the `startGeneration` tool, `Admirer.jsx`'s `onStartGeneration` runs `mapDescriptorsToStems(descriptors)` (`src/lib/descriptorsToStems.js`) to pick the archetype + variation, resolves the 4 R2 stem URLs + single-master fallback, calls `StemPlayer.load(ctx, stems, masterUrl)`, starts the player **silent** (`setVolume(0, 0)`), and exposes it via `revealAudioRef`. The `stemsBundle` is carried to the Orchestra phase by `onCommitEntry → onNext`.

`StemPlayer.load` fetches + decodes the 4 stems in parallel, falling back to a single duplicated buffer (master fanned to all 4 positions) if any fetch fails; the 4 sources run sample-aligned via `start(when)` with `loop=true`.

**`Orchestra`** picks up the same already-running player without restarting the sources. `StemPlayer.detachAndGetSources()` disconnects each `BufferSourceNode` and returns them; `engine.connectStems({vocals, drums, bass, other})` routes each into the per-stem mono chain → HRTF panner with pre-HRTF mono reverb send. The song stays sample-aligned across the handoff. Song duration is read from the longest stem buffer; engine envelopes (`tick(t, songDuration)`) use it directly.

(On `main` the handoff runs Autobio → Reveal instead — see git history. `musicking` keeps the `revealAudioRef` prop name for continuity.)

### The Admirer (musicking — Act 1)

The **admirer** phase is a ~5-minute spoken conversation with "the Admirer" — an **ElevenLabs Conversational AI agent**. It elicits the user's musical direction and picks the matched song.

**Agent config — all in code.**
- `scripts/create-admirer-agent.js` — **source of truth**: `SYSTEM_PROMPT`, `first_message` (the Arrival speech), the 6 client tools, the `turn` config. Run once to create the agent.
- `scripts/update-admirer-agent.js` — PATCHes the live agent's prompt + `turn` + `tts`, regex-extracted from the create script so the two can't drift. Re-run after any prompt change.
- `docs/admirer-agent-dashboard.md` — a human-readable mirror of the config; keep it in sync.
- Agent ID → `VITE_ELEVENLABS_AGENT_ID`. LLM `gemini-2.5-flash-lite`. `speculative_turn: false` is mandatory (it caused duplicate utterances). `turn_timeout: 7` / `turn_eagerness: normal` (a 3s/eager setting cut off thinking pauses).

**Client wiring.**
- `src/hooks/useAdmirerAgent.js` — wraps `@elevenlabs/react` `useConversation` (under a `ConversationProvider`). **Push-to-talk**: the mic starts muted; holding the `HoldToSpeak` button unmutes (`setMuted`). Forwards conversation messages into `liveSession` (Build B).
- `src/lib/admirerTools.js` — `buildAdmirerTools(callbacks)` builds the 6 client tools the agent calls: `recordLexicon`, `commitArtifact`, `markRestricted`, `playFragment`, `startGeneration`, `commitEntry`. Host callbacks live in `Admirer.jsx`.
- `src/lib/sessionStore.js` — cross-session state: the typed user name (never spoken — TTS would mispronounce it), the verbatim lexicon, restricted repertoires, prior entries. `buildDynamicVariables()` builds the per-session dynamic variables (primitives only — arrays silently kill the conversation).
- `src/phases/Settle.jsx` — the brief closing phase after the song.

**The listening run — the blocking `playFragment`.** Mid-conversation the Admirer plays ~3 short musical fragments; the user rates each Yes/No. `playFragment` is a **blocking** client tool (`expects_response: true`, `response_timeout_secs: 30`, `disable_interruptions: true` — set on the tool record): the agent calls it and waits, silent, while the client plays the clip and the user **taps** Yes/No. `Admirer.jsx`'s `onPlayFragment` returns a Promise that resolves with the rating (`"yes"`/`"no"`/`"none"`) — that string is the tool result the agent reads to choose the next fragment. `src/phases/FragmentControls.jsx` renders the playing indicator + Yes/No buttons; `src/lib/fragmentBank.js` holds the 8 fragments (each a full archetype master, capped client-side at `FRAGMENT_DURATION_MS` = 14s). Rating is tap-only during the run. See `docs/admirer-blocking-tool-spike.md`.

**Build A — the shared spatial room.** The Admirer's voice is routed through a Web-Audio HRTF "room" so it externalizes; the room then expands into the orchestra as the act-1 → act-2 transition.
- `src/orchestra/AdmirerRoom.js` — an HRTF room for one source (mirrors `OrchestraEngine`'s per-source chain): captured voice → mono → HRTF panner + pre-HRTF reverb send → 6 early reflections + hall-IR convolver → master lowpass. `setExpansion(t)` / `beginExpansion()` interpolate `INTIMATE ↔ EXPANDED`. The voice is captured from the SDK's hidden `<audio>` element via `createMediaStreamSource` (`captureAdmirerVoice` — the SDK exposes no output node; see `docs/admirer-spatial-spike.md`).
- `src/lib/roomPresets.js` — pure `INTIMATE`/`EXPANDED` acoustic presets + `roomAt(t)` interpolation. Unit-tested.
- `src/hooks/usePhoneMotion.js` — device-orientation hook over `src/conducting/GestureCore.js`. iOS permission is requested in `Entry.score.jsx`'s "begin" tap.
- `src/hooks/useAdmirerRoom.js` — owns the `AdmirerRoom` lifecycle: builds it, captures the voice on connect, feeds phone roll → room azimuth, exposes `beginExpansion()` (fired when the agent calls `startGeneration`).

**Build B — the reflection surface.** A calm, peripheral, ignorable visual layer shown unbroken across the admirer + orchestra phases.
- `src/lib/liveSession.js` — an in-memory, subscribable store of the current session's transcript + accumulating lexicon. Reset on entry. Unit-tested.
- `src/phases/ReflectionSurface.jsx` — renders the Admirer's latest line + the lexicon words faintly at the bottom; mounted in `App.jsx` **outside** the phase-swap `AnimatePresence` so it persists across the act transition.
- `src/phases/GlyphCanvas.jsx` — a faint ink-trail glyph drawn from phone orientation (`usePhoneMotion`).

### Score-v2 lib modules (`src/lib/`)

Pure-function modules. Most have unit tests in `src/lib/__tests__/`.

- **`archetypes.js`** — `ARCHETYPES` array (6 archetypes × 4 variations) + Forer paragraph templates. Each archetype carries `scoringWeights: {a, v, d}`. Variations carry `era` + Daylist-style `microgenreLabel`.
- **`scoreArchetype.js`** — `scoreArchetype(avd, phaseData, rand?)` cascade hybrid: softmax over `-distance/temperature` for archetype, then era-aware variation pick (autobio era median > depth heuristic) with ε-greedy (ε=0.12).
- **`hedonicBias.js`** — when `phaseData.moment.hedonic === false`, multiplies archetype scores (Sky-Seeker × 0.06, Quiet Insurgent × 2.0, Slow Glow × 1.4, Hearth-Keeper × 0.85) and renormalizes. Applied inside `scoreArchetype` after softmax.
- **`stemsCatalog.js`** — Resolves R2 URLs for the 24 archetype × variation × 4-stem combinations. `getStems(archetypeId, variationId)` returns `{vocals, drums, bass, other}`; `getMasterUrl(...)` returns the single per-archetype master fallback. Base URLs are read from `VITE_STEMS_BASE_URL` / `VITE_MASTERS_BASE_URL` env vars.
- **`stemPlayer.js`** — Class wrapping 4 `AudioBufferSourceNode`s started at a single anchor time so they remain phase-locked across loop boundaries. `StemPlayer.load(ctx, urls, fallbackUrl)` decodes in parallel with single-buffer fallback. `detachAndGetSources()` hands ownership to Orchestra without stopping the sources.
- **`reflectionLines.js`** — `buildReflectionLines(avd, phaseData)` returns 5 `{signal, interpretation}` lines (spectrum, depth, gems, moment, autobio) for the Reflection phase.
- **`forerLines.js`** — Mirror beat copy generators: `buildBecauseLine`, `buildMemoryCallback` (prefers autobio.songs[0] → textures → spectrum), `buildTimeOfDayLine`, `buildLatencyLine`, `buildTemporalFrame`.
- **`gemsTags.js`** — `GEMS_TAGS` array of 6 emotion tiles (nostalgic, awed, tender, melancholic, defiant, peaceful) with per-tile AVD nudges. `gemsExcerptsToAvdNudge`, `dominantGemsTag` helpers.
- **`era.js`** — `detectEraCluster(years)` returns `{median, span, clustered}`; `buildEraLine` returns reflection-friendly era copy.
- **`autobio.js`** — `validateSong({title, artist, year})`, `summarizeAutobio(songs) → {songs, eraSummary}`. Calls `detectEraCluster` internally.
- **`itunesSearch.js`** — `searchTracks(query, signal?) → Promise<Track[]>` wrapping iTunes Search API. CORS-friendly, no auth, called directly from Autobio.
- **`spectrumPairs.js`** — `PAIRS_LEGACY` (8 pairs) + `PAIRS_V2` (9 polar pairs, currently active). Spectrum imports `ACTIVE_PAIRS`.
- **`voiceRegister.js`** — Admirer voice register → ElevenLabs `voice_settings` mapping. Three registers: caretaking / present / elevated.
- **`textHash.js`** — FNV-1a deterministic hash for cache keys.
- **`moment.js`** — `computeBpm(moment)` derives BPM from `totalDownbeats` (score-flow) or `peakTapRate` (legacy fallback).
- **`compositionPlan.js`** — *Deprecated in v3.* Was used to build ElevenLabs Music API prompts. No longer called; safe to delete.

### Server-side proxy (`api/`)

ElevenLabs API key (`ELEVENLABS_API_KEY`, no VITE_ prefix) stays on the server. Vite dev middleware in `vite.config.js` mounts `/api/*.js` handlers via `ssrLoadModule`. In production, Vercel auto-deploys these as serverless functions.

- **`api/admirer.js`** — TTS handler. Body `{ lineId }`. Resolves text via `resolveLine(lineId)` from `_admirerLines.js`. Rejects unknown lineIds with 400. Voice playback fails silently in v3 (see `useAdmirer` hook), so the API is optional — production deploys can omit `ELEVENLABS_API_KEY` and the experience runs voiceless.
- **`api/compose.js`** — *Deprecated in v3.* No longer called. Safe to delete.
- **`api/_admirerLines.js`** — Server-side allowlist of voice lines per phase. Canonical source.
- **`api/_elevenlabs.js`** — Shared helpers: `getApiKey`, `readJsonBody`, `sendError`.
- **`api/geo.js`** — Resolves the desktop's coarse location from Vercel's `x-vercel-ip-*` geolocation headers, coarsened server-side to a 1° grid. Returns `{ region }`. Used by `useRiteSession` to stamp a journal entry's `region` (desktop journal Slice 5).

### Hooks

- **`src/hooks/useAdmirerAgent.js`** — wraps `@elevenlabs/react` `useConversation`; runs the Admirer agent with push-to-talk and forwards messages into `liveSession`. See **The Admirer (musicking — Act 1)**.
- **`src/hooks/useAdmirerRoom.js`** — owns the Build-A `AdmirerRoom` lifecycle (build, voice capture, roll→azimuth, expansion).
- **`src/hooks/usePhoneMotion.js`** — device-orientation snapshots via `GestureCore` (Build A + the glyph).
- **`src/hooks/useInputMode.js`** — Detects mouse vs touch input.
- **`src/hooks/useRiteSession.js`** — the desktop journal's relay-viewer side: opens one viewer connection, runs the rite `riteStage` state machine, and writes the `entries` row when the phone relays its `entry` message at settle. See **Desktop journal** (Slice 3).
- **`src/hooks/useEntryAudio.js`** — streams one journal entry's master MP3 from R2 for the entry detail view; owns a plain `HTMLAudioElement`, exposes `{available, playing, toggle, progressRef}`. See **Desktop journal** (Slice 4).
- **`src/hooks/useAdmirer.js`** — the *old* per-line TTS hook (`/api/admirer`). Not used in `musicking` — superseded by `useAdmirerAgent`. Still on disk for `main`.

### Key Modules — Engine

- **`src/engine/avd.js`** — Singleton `AVDEngine`. State `{a, v, d}`, history, per-phase data.
- **`src/engine/audio.js`** — Singleton `AudioEngine`. Web Audio synthesis: stereo pairs, layered builds, build-and-drop, MP3 crossfade looping.
- **`src/engine/elevenlabs.js`** — ElevenLabs Music API wrapper used by legacy `scripts/generate-assets.js`. Not called in v3.

### Key Modules — Orchestra (v3)

All Orchestra code lives under **`src/orchestra/`**. The main component is **`src/phases/Orchestra.jsx`**.

- **`src/orchestra/OrchestraEngine.js`** — Master audio graph. Per-stem (mono) chain: `entry → gain → eqFilter → distanceLP → conductingFilter → HRTFPanner → directBus`, with a parallel mono pre-HRTF reverb send into a shared `reverbBus`. Shared `reverbBus` feeds 6 image-source early reflections + a binaural hall IR convolver. Binaural beats (oscL + oscR → ChannelMerger → ctx.destination) bypass the compressor. No Track B, no ovation, no fracture coupling, no return tone (all removed in v3). Gesture extraction lives in `src/conducting/GestureCore.js` (shared with the relay phone bundle); `ConductingEngine.js` is a thin DOM-binding wrapper.
- **`src/orchestra/ConductingEngine.js`** — DeviceMotion + DeviceOrientation handler. Downbeat detection (negative-Y zero-crossing), gesture size (RMS peak-to-peak), articulation (jerk), 2-second auto-calibration of orientation baseline. Touch fallback.
- **`src/orchestra/constants.js`** — 3-phase timing (`BRIEFING_DURATION` 12s, `BLOOM_DURATION` 24s, `END_FADE_DURATION` 4s, `CLOSING_CARD_DURATION` 7s); per-stem spatial layout (`STEMS.{VOCALS, DRUMS, BASS, OTHER}` with azimuth/elevation/distance/reverbSend); image-source `EARLY_REFLECTIONS` for ~5×4×3m room; `YAW_SPOTLIGHT` boost/cut params; flat `GAINS.TRACK_A`, `GAINS.AUDIENCE`, `GAINS.HALL_WET`, constant 10 Hz `GAINS.BINAURAL`. Re-exports `CONDUCTING` from `src/chamber/utils/constants.js`.
- **`src/orchestra/scripts.js`** — Reduced to ambient bed only: `AUDIENCE_FILES` (2 crowd murmur loops) + `HALL_IR_FILE`. All admirer voices, whispers, ovation, Track B removed.
- **`src/orchestra/preloader.js`** — Warms Orchestra asset cache during Reveal (audience + hall IR only now).
- **`src/orchestra/BriefingScreen.jsx`** — 12-second silent threshold rite: cream paper + animated baton SVG (oscillates ±22° in 4-second arc) + dim-to-black overlay. No text, no voice.
- **`src/orchestra/ClosingCard.jsx`** — 7-second cream-paper closing card showing the matched archetype's last Forer sentence (`ARCHETYPES[i].forerTemplate[3]`), with fade-in/hold/fade-out arc. Auto-routes to entry on completion. Replaces v2's `ReturnScreen.jsx` (deleted).

**Removed in v3** (deleted from repo): `src/orchestra/VoiceScheduler.js`, `src/orchestra/ReturnScreen.jsx`. Orphaned but not deleted: `public/chamber/voices/v2/*.mp3` (51 admirer voice files), `public/chamber/whispers/*.mp3`, `public/chamber/crowd/ovation.mp3`, `public/chamber/tracks/aftermath.mp3` (Track B). Safe to delete from disk and R2.

### Legacy Chamber (v1)

Original chamber code under `src/chamber/`:
- **`src/chamber/utils/constants.js`** — `CONDUCTING` object re-exported by Orchestra.
- **`src/chamber/utils/math.js`** — `lerp`, `clamp`, `sphericalToCartesian`, `sigmoid`.
- **`src/chamber/data/CollectiveStore.js`** — localStorage store with 20 seed AVD vectors (was used by v2 ReturnScreen, now unused).

### Phases (`musicking`)

| # | Phase | File | What it does |
|---|-------|------|-------------|
| 0 | Entry | `Entry.score.jsx` | Headphones prompt → intro video → typed name capture → device-motion permission (the "begin" tap) → routes to Admirer. |
| 1 | Admirer | `Admirer.jsx` | ~5-min ElevenLabs Conversational AI conversation — arrival, a boundary object, ~2 questions, the 3-fragment listening run, then `startGeneration`. Loads the matched `StemPlayer` silently. See **The Admirer (musicking — Act 1)**. |
| 2 | Orchestra | `Orchestra.jsx` | 3-phase song-driven spatial conducting experience (Briefing 12s + Bloom 24s + Throne for the rest of the song + 4s end fade + 7s closing card). Voice-free. See **Orchestra Timeline (v3)**. |
| 3 | Settle | `Settle.jsx` | Brief closing card after the song ends; routes back to entry. |

The 9-phase `*.score.jsx` files (Spectrum, Depth, Gems, Moment, Autobio, Reflection, Reveal) and the pre-redesign `Entry.jsx`-era components remain on disk for `main` but are **not routed** in `musicking`.

### Orchestra Timeline (v3)

Total duration is **song-duration-driven** rather than fixed. For a typical 4-minute master: ~4:23 total.

| Time (relative to phase start) | Stage | What happens |
|---|---|---|
| 0:00–0:12 | Briefing | Animated baton SVG on cream paper, dim-to-black overlay grows in last third. Silent. |
| 0:12–0:36 | Bloom | Hall reverb fades from 0 → 0.55, audience murmur fades 0 → 0.10, song stems Track-A gain ramps 0 → 0.7. The room materializes. |
| 0:36 → song_end − 0:04 | Throne | Full conducting agency. Roll → per-stem azimuth offset + yaw-quadrant spotlight. Acceleration RMS → per-stem dynamics gain. Jerk → conducting filter Q-spike. Negative-Y downbeat → gain spike + Q spike + percussive transient + 15ms haptic pulse. Constant 10 Hz alpha binaural beats. |
| song_end − 0:04 → song_end | End Fade | `engine.fadeOut(4)` ramps master gain to 0. |
| song_end → song_end + 0:07 | Closing Card | Cream-paper card with archetype's last Forer sentence (e.g. *"There is a song you only listen to alone, and you don't know why."*). Auto-routes to entry. |

### Conducting Mappings

| Sensor read | Computed as | Maps to audio |
|---|---|---|
| Roll (gamma) | `(gamma − baselineGamma + 45) / 90` → `pan` 0..1 | Per-stem HRTF azimuth offset (±27°) + yaw-spotlight stem boost (±3.5 dB front, ±2 dB rear) |
| Pitch (beta) | `(beta − baselineBeta + 45) / 90` → `filterNorm` 0..1 | Per-stem conducting filter cutoff (200–4000 Hz lowpass, mono pre-HRTF) |
| Acceleration RMS | `√(ax² + ay² + az²)` peak-to-peak in 2s window, normalized | Per-stem dynamics gain multiplier (0.15 → 1.0) |
| Jerk | `\|rms − prevRms\|` normalized to 3 m/s³ | Articulation Q-spike on conducting filter (Q 1 → Q 8) |
| Y zero-crossing (downbeat) | Peak-Y magnitude in 150ms window, refractory 250ms, threshold 2.0 m/s² | One-shot per-stem gain spike (1.3–2.0×, 150ms decay) + Q spike + percussive noise transient + 15ms haptic |

Auto-calibration runs once for 2 seconds on Throne entry — averages baseline beta + gamma so "neutral" is wherever the user is holding the phone, not absolute upright. Touch fallback works for desktop testing.

### Audio Assets

**Hosted on Cloudflare R2** (`postlistner` bucket, public r2.dev URL):

- **Stems** at `<R2>/stems/{archetypeId}/{variationId}/{vocals,drums,bass,other}.mp3` — 96 files, ~550 MB. Generated via `scripts/run-demucs.sh` from the masters using htdemucs on MPS. 192 kbps MP3.
- **Masters** at `<R2>/music/{archetypeId}_{variationId}.mp3` — 24 files, ~80 MB. Pre-generated in Suno V5.5 using prompts from `scripts/generate-suno-prompts.js`. Used as fallback when stems aren't available.

**Bundled with the deploy (`/public/`):**
- **`public/spectrum/`** — 16 MP3 clips for legacy 8 word-pairs + Spectrum v2 polar pairs
- **`public/Texture/`** — legacy texture previews (Textures phase removed but assets retained)
- **`public/gems/{sublimity,tenderness,tension}.mp3`** — 3 × 15s GEMS excerpts
- **`public/chamber/crowd/ambient-01.mp3`, `ambient-02.mp3`** — audience murmur for Bloom + Throne ambient bed
- **`public/chamber/hall-ir.wav`** — concert hall impulse response for the binaural reverb convolver
- **`public/chamber/voices/score/*.mp3`, `voices/v2/*.mp3`, `whispers/*.mp3`, `crowd/ovation.mp3`, `tracks/aftermath.mp3`** — orphaned in v3 (no code path references them); safe to delete.

**Gitignored (live only on R2 in production):**
- `public/stems/` — full local copy generated by `scripts/run-demucs.sh`
- `public/music/` — local Suno masters dropped here before R2 upload
- `tmp/` — Demucs intermediate output

### Spectrum AVD Coordinates

Each Spectrum word-pair carries explicit `coordL` / `coordR` AVD coordinates in `src/lib/spectrumPairs.js`. The lean position interpolates between the two coordinate sets. Spectrum also tracks `reversalCount`, `confidence`, `hoveredButNotChosen[]` for downstream signal weighting.

### QR-paired desktop canvas (added 2026-05-13)

Optional flow: desktop visitor sees a QR code, scans with phone, runs the rite on phone, desktop becomes the cosmos canvas during Orchestra.

- **Routing**: `src/main.jsx` picks the root at runtime — desktop without `?s=` → `Desktop` (the auth-gated journal that also hosts the live rite mirror); everything else → `App`. Device detection via `useDeviceMode` (`matchMedia('(pointer: coarse)')`).
- **Session ID**: 8-char Crockford base32 from `src/lib/sessionId.js`, generated client-side on desktop, embedded in QR URL.
- **Relay**: Cloudflare Worker + Durable Object at `relay.post-listner.com` (or the `*.workers.dev` default). One DO instance per session ID, routed via `env.SESSION_ROOM.idFromName(sessionId).get()`. Conductor messages broadcast to all viewers. Single-conductor enforcement (new conductor closes the old socket). 5-second grace period via DO Alarms (hibernation-safe).
- **Local dev**: `conduct-relay/server.cjs` at `wss://localhost:8443` with the same `?s=<id>&role=<conductor|viewer>` protocol. Backwards-compat: also accepts the legacy `role=phone|desktop`.
- **WS protocol**: see `src/lib/relayProtocol.js`. 5 conductor→viewer message types: `gesture`, `phase`, `audio`, `session:end`, `entry` (the finished journal entry, relayed at settle). Relay-generated: `conductor:lost`, `conductor:resumed`.
- **Phone bundle**: `conduct-relay/src/phone.js` builds via esbuild to `conduct-relay/public/phone.bundle.js` and imports `GestureCore` + `RelayClient` from the main project. Session ID via `?s=` URL param or the dev session input field.
- **Cosmos audio**: phone sends 128-byte FFT magnitude arrays at 30 fps over WS during Orchestra phase. Desktop reads them into a `Uint8Array(128)` and feeds the existing `ConductorCelestialField` canvas as if it were a local AnalyserNode. Guarantees what user hears matches what desktop visualizes.

### Desktop journal (`/journal`)

The `/journal` route is the **desktop journal** — PostListener's "past tense"
surface, where a person browses the accumulated record of their sessions. The
full design is a hybrid "book + sky"; the 6-slice spec is
`docs/desktop-journal-design.md`. **Slices 1–5 are built; Slice 6 is next.**

**Slice 1 — the book** (`src/journal/`). The journal is a literal 3D book used
purely as a *transition device* between separate cream-paper entry pages — the
book itself is never the reading surface.
- `Journal.jsx` — the R3F scene (`public/models/journal-book-v2.glb`, a rigged
  book with a baked page-turn clip) + the transition orchestrator. A rAF loop
  drives clip position, camera, and a cloud veil for three transition kinds:
  `open` (landing → first page), `turn` (neighbouring entries — clip scrub +
  camera push), `jump` (chapter rail — cloud crossfade). Takes an `entries`
  prop + optional `onSignOut`.
- `EntryPage.jsx` — the reading surface (DOM, not 3D): a per-entry seeded
  watercolour wash, a hand-painted ink sigil, the date, the one-line summary.
- `ChapterIndex.jsx` / `chapters.js` — the marginal month rail for deep
  navigation across the record.
- `CloudCanvas.jsx` — volumetric raymarched cloud veil for transitions;
  `KuwaharaEffect.jsx` — a painterly post-pass (with paper grain = the
  watercolour look); `coverTexture.js` — a UV-independent cover wash.
- `entryFormat.js` (`src/lib/`) — pure entry shaping (ISO ↔ display date,
  `normalizeEntries`, `loadMockEntries`); `mockEntries.js` — the 10 mock
  entries for the no-backend dev fallback. `/cloud-test` (`CloudTest.jsx`) is
  a dev route for the cloud shader.

**Slice 2 — accounts + backend.** `src/desktop/Desktop.jsx` is the auth gate:
`useAuth` (Supabase Google OAuth) routes between `SignIn`, `FirstTimer`
(signed in, zero entries — QR only), and the `Journal` (one or more entries).
Entries live in one Supabase `entries` table behind RLS (`supabase/schema.sql`);
`src/lib/entriesRepo.js` is the data layer. With no Supabase env set, `Desktop`
falls back to a no-auth journal on mock data, so `/journal` always renders.
Backend setup: `docs/supabase-setup.md`. A project-scoped Supabase MCP
(`.mcp.json`) is configured for database work. The desktop root is now
`Desktop` itself; `main.jsx` routes desktop-without-`?s=` straight to it.
The phone-rite/QR-pairing relay flow is unchanged.

**Slice 3 — "close the loop" (built).** A QR-paired rite writes a real
`entries` row at settle. The phone records the Orchestra conducting gesture,
`distillGlyph` (`src/lib/glyph.js`) reduces it to a small recorded-path glyph,
and `App.jsx` relays one `entry` message. `Desktop` is now the desktop root:
`useRiteSession` (`src/hooks/useRiteSession.js`) holds the relay viewer, runs
the rite state machine, writes the row via `entriesRepo.createEntry`, and the
`Journal` reopens turned to the new page. `EntryPage` renders the real glyph in
a per-account "hand" (`deriveHand`); entries with no glyph keep the procedural
fallback. `Stage` is retired (`StageCosmos` reused as the live mirror). The
Admirer-phase `GlyphCanvas` is kept as pure decoration.

**Slice 4 — the entry detail view (built).** Opening a journal entry makes its
page a living "room": `useEntryAudio` (`src/journal/useEntryAudio.js`) streams
the entry's master MP3 from R2, and the glyph re-animates — `revealGlyph`
(`src/lib/glyph.js`) slices the recorded path to the song's playback position,
which the extracted `Glyph` component (`src/journal/Glyph.jsx`) redraws each
frame. The glyph mark itself is the play/pause control. Mock entries (no
`song`/`glyph`) stay a static procedural mark. (`Glyph.jsx` and `EntryPage`'s
watercolour wash share the seeded PRNG `src/lib/mulberry32.js`.)

**Slice 5 — the sky (built).** The journal's third surface: a Mapbox GL
globe of glyph-lights (`src/journal/CollectiveSky.jsx`), reached from a book
page by the "rise to the field" transition — a `rise`/`descend` crossfade in
`Journal.jsx`'s rAF orchestrator, reusing the cloud veil. The custom dark
style is code-defined (`src/journal/skyStyle.js`): faint ink land over a void
ocean. The user's own entries glow warm in their hand hue, placed at a
coarsened location; a mock collective — `src/lib/mockCollective.js` rendered
as a soft, dim Mapbox `heatmap` haze — fills the field. Location is captured
at settle from Vercel geo headers (`api/geo.js` → `entries.region`);
`src/lib/geo.js` coarsens to a 1° grid and `src/lib/skyPresets.js` holds the
INTIMATE↔EXPANDED rise camera. Needs `VITE_MAPBOX_TOKEN`; without it the rise
affordance is hidden. `region` resolves only on a Vercel deploy (the geo
headers don't exist in local dev — it stores `null` there), so real
self-placement on the globe is verifiable only once deployed. **Slice 6
(next) — the real collective:** anonymized glyphs from all accounts, the
mine/field/both view (§7).

## Environment

`.env.local` env vars:

| Var | Used by | Required for |
|---|---|---|
| `VITE_STEMS_BASE_URL` | Runtime (`stemsCatalog.js`) | Stems loading from R2 |
| `VITE_MASTERS_BASE_URL` | Runtime (`stemsCatalog.js`) | Master fallback from R2 |
| `R2_ACCOUNT_ID` | `scripts/upload-to-r2.sh` | R2 sync endpoint |
| `R2_BUCKET` | `scripts/upload-to-r2.sh` | R2 sync target |
| `R2_ACCESS_KEY_ID` | `scripts/upload-to-r2.sh` | R2 S3 auth |
| `R2_SECRET_ACCESS_KEY` | `scripts/upload-to-r2.sh` | R2 S3 auth |
| `R2_PUBLIC_URL` | `scripts/upload-to-r2.sh` (informational) | Public access URL |
| `CLOUDFLARE_API_TOKEN` | wrangler (optional, future use) | Bucket admin via wrangler |
| `CLOUDFLARE_ACCOUNT_ID` | wrangler (optional) | Bucket admin |
| `VITE_ELEVENLABS_API_KEY` | `scripts/generate-assets.js`, `scripts/generate-phase2-assets.js` | Generating legacy SFX/voice assets |
| `ELEVENLABS_API_KEY` | `api/admirer.js` (optional in v3) | Inline admirer voice during phases 0–6. Hook fails silently without it. |
| `VITE_RELAY_URL` | Runtime (`relayClient.js`, `phone.js`) | WebSocket relay endpoint. Dev: `wss://localhost:8443`. Prod: `wss://relay.post-listner.com`. |
| `VITE_ELEVENLABS_AGENT_ID` | Runtime (`useAdmirerAgent`) | The Admirer agent (musicking branch). Set on Production environment in Vercel. |
| `VITE_SUPABASE_URL` | Runtime (`supabaseClient.js`) | Desktop journal accounts + entries |
| `VITE_SUPABASE_ANON_KEY` | Runtime (`supabaseClient.js`) | Desktop journal accounts + entries |
| `VITE_MAPBOX_TOKEN` | Runtime (`CollectiveSky.jsx`) | The desktop journal's collective sky (Mapbox globe). Without it the "rise to the field" affordance is hidden. |

`.env.local` is gitignored via `*.local`. Vercel production needs `VITE_STEMS_BASE_URL`, `VITE_MASTERS_BASE_URL`, `VITE_RELAY_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_MAPBOX_TOKEN` set on the **Production** environment.

## Commands

```bash
npm run dev                          # Start dev server (Vite + /api middleware)
npm run build                        # Production build
npm run lint                         # ESLint
npm run preview                      # Preview production build
npm test                             # Run vitest suite (312 tests)
npm run test:watch                   # Watch mode

# Local conducting relay (Node, dev only — for /conduct-* routes + QR pairing dev)
npm run relay                        # Builds phone bundle + launches Node WS relay at :8443

# Cloudflare Worker relay (production)
cd relay && npx wrangler login          # One-time OAuth (browser opens)
cd relay && npm run dev                 # Local Worker via wrangler dev (port 8787)
cd relay && npm run deploy              # Deploy to *.workers.dev + relay.post-listner.com
cd relay && npm run tail                # Live-tail Worker logs

node scripts/generate-suno-prompts.js   # Generate 24 Suno V5.5 prompts → docs/suno-prompts.{md,json}
bash scripts/run-demucs.sh              # Stem-split public/music/*.mp3 → public/stems/{archetype}/{variation}/ via htdemucs on MPS (idempotent)
bash scripts/upload-to-r2.sh            # Sync public/stems/ + public/music/ to R2 with immutable cache headers (idempotent)
bash scripts/upload-to-r2.sh --dry-run  # Preview what would change
bash scripts/upload-to-r2.sh stems      # Sync stems only

# Legacy:
npm run gen:phase2                      # Legacy Phase 2 audio asset generation
node scripts/generate-assets.js         # Legacy Orchestra v2 audio asset generation (TTS, SFX, Music, Hall IR)
```

> **Lint debt.** `npm run lint` is **not clean** — ~133 pre-existing errors (+12 warnings), all in legacy/unrouted or non-browser code: the `src/phases` 9-phase rite, `src/chamber` v1, Node `scripts/`, `api/`, and the relay. Mostly `no-unused-vars`; every `no-undef` is an ESLint env-config gap (`process`/`Buffer`/Cloudflare-Workers globals), not a real bug. `npm run build` + `npm test` (312 passing) are the real gates — the bar for new work is **no _new_ lint errors**.

## Deployment

- **Production**: https://post-listner.vercel.app/ (auto-deploys on push to `main`)
- **Repo**: https://github.com/krishnanihar/Post-Listner
- **CDN**: Cloudflare R2 bucket `postlistner` at `https://pub-9c9037cd5db94d1b8d9ec361b8fc814e.r2.dev/`
- **R2 CORS**: allows `https://post-listner.vercel.app`, `http://localhost:5173`, `http://localhost:4173` for GET/HEAD with `Accept-Ranges` exposed.

Asset upload workflow:
1. Generate Suno tracks → drop into `public/music/`
2. Run `bash scripts/run-demucs.sh` → stems land in `public/stems/`
3. Run `bash scripts/upload-to-r2.sh` → both directories sync to R2 with `Cache-Control: public, max-age=31536000, immutable`
4. Push code → Vercel auto-deploys

## Design

- **Cream-paper aesthetic** for all PostListener phases: `--paperCream: #F2EBD8`, `--inkCream: #1C1814`, italic serif, Roman numeral phase labels (i. through viii.)
- **Dark theme** for Orchestra phase: `--bg: #0A0A0F`, `--bg-dark: #000000`, `--accent: #D4A053` (amber)
- Fonts: Iowan Old Style / Palatino / EB Garamond serif (FONTS.serif), JetBrains Mono / SFMono (FONTS.mono)
- Film-grain overlay via SVG noise filter (opacity 0.06 cream / 0.03 dark)
- Safe area insets for notched phones
- Conductor SVG: amber-stroke pictogram, silhouette from behind with raised baton

## Phase plans

The score-v2 redesign was executed in three phases. Plans live at:

- `docs/superpowers/plans/2026-05-08-phase1-reflection-and-mirror.md` — Reflection screen + Mirror beat + 6×4 archetype scoring
- `docs/superpowers/plans/2026-05-08-phase2-gems-autobio.md` — GEMS probe replacing Textures + Autobio module + Hurley probe + Spectrum v2 polar pairs
- `docs/superpowers/plans/2026-05-08-phase3-elevenlabs-voice-music.md` — ElevenLabs server proxy + Threshold rite + per-session music generation + hedonic bias

The Orchestra v3 redesign (4-stem spatial graph + 3-phase voice-free experience + R2 hosting) was executed 2026-05-09 to 2026-05-10. No formal plan doc — captured in this file.

The **`musicking`** redesign — Act 1 = the Admirer conversation; Build A = the shared room; Build B = the reflection surface — was executed 2026-05-19 to 2026-05-21:

- `docs/superpowers/plans/2026-05-19-musicking-phase-a-admirer.md` — the Admirer agent, the 6 client tools, the conversation
- `docs/superpowers/plans/2026-05-20-five-minute-admirer-shared-world.md` — 5-minute compression, the fragment listening run, Build B
- `docs/superpowers/plans/2026-05-20-build-a-room-integration.md` — Build A: the HRTF room, phone motion, the glyph, the expansion transition
- `docs/admirer-spatial-spike.md`, `docs/admirer-tap-to-agent-spike.md`, `docs/admirer-blocking-tool-spike.md` — SDK spikes (audio capture, the tap→agent path, the blocking-tool semantics)

## Experimental conducting routes

Three routes prototype the visual layer for the Orchestra phase. **None are wired into the 9-phase production flow yet** — they're standalone explorations of what phase 8 could look like:

| Route | Folder | Status |
|---|---|---|
| `/conduct` | `src/conductor/` | First-attempt 3D conductor figure with Rigify GLB rig + IK. Phone-as-baton drives bone rotations. Works mechanically but motion never felt right — see `docs/conductor-handoff.md` for the post-mortem. |
| `/conduct-codex` | `src/conductor-codex/` | Stick-figure 2.5D R3F scene with starfield-shader silhouette, parchment background, constellation overlay. Phone hook (`usePhoneConductor`) lives here — reused by `/conduct-glb`. |
| `/conduct-glb` | `src/conductor-glb/` | **Current direction.** Pure 2D canvas + Web Audio. No R3F. See below. |

### /conduct-glb — canvas conducting cosmos

A 2D canvas experience where the conducting gesture draws an ink trail through a parchment cosmos, activating stars and inscribing canonical edges of a programmatic Metatron's Cube. Ambient audio reacts the geometry. The plans/`2026-05-13-conductor-programmatic-geometry.md` and `2026-05-12-conductor-richer-signals.md` document the buildout.

**Five files (everything else under `src/conductor-glb/` was deleted in the 2026-05-13 hygiene pass):**

| File | Role |
|---|---|
| `ConductGlb.jsx` | Top-level composition. Calls `useAmbientAudio`, renders `ConductorCelestialField` + `StatusPanel` + tap-to-begin overlay (when audio autoplay is blocked). |
| `ConductorCelestialField.jsx` | The entire 2D canvas system: 3 stacked canvases (bg/fg/trail). Owns the render loop, phone-state subscription, audio polling, geometry rendering, ink trail, and constellation completion logic. |
| `metatronGeometry.js` | Pure functions: `computeMetatronNodes(radius)` returns 13 Fruit-of-Life node positions (1 center + 6 inner hex at radius r + 6 outer hex at 2r, all on the same 60° rays). `computeMetatronEdges(nodeCount)` returns the 78-edge complete graph. 8 vitest tests. |
| `audioBands.js` | Pure functions: `bandAverage(freqData, startBin, endBin)` averages a slice of an AnalyserNode Uint8Array, normalized to 0..1 against 255. `detectBassBeat()` edge-triggered threshold crossing with 250ms refractory — same shape as the phone-side downbeat detector. 7 vitest tests. |
| `useAmbientAudio.js` | React hook. Loads an MP3 via HTMLAudioElement, lazily creates AudioContext + AnalyserNode (fftSize 256 → 128 bins) on first user gesture. Returns `{ needsGesture, playing, error, tryStart, pause, pollFrequency, freqDataRef }`. |

**Phone integration:** reuses `usePhoneConductor` from `/conduct-codex`. All phone signals available: `pitch`, `roll`, `yaw`, `energy` (acceleration RMS), `articulation` (jerk), `downbeatIntensity` + `lastDownbeatAt`, `angularSpeed` (gyro magnitude), `accel.{x,y,z}` (per-axis acceleration). The phone payload was expanded in the 2026-05-12 richer-signals plan to carry `rotationRate` and `accel` fields beyond the original orientation-only set.

**Visual layer stack (back to front):**

1. **Parchment** — DOM background, radial gradient (`#d8c5a0` family)
2. **bg canvas** — concentric circles + 6 zodiac glyphs (☉☽♃♄♂♀) + 300 dust dots + 4 hint constellations + Metatron watermark (faint amber, painted once at resize)
3. **fg canvas** — every frame: 30 stars with activation, inscribed constellation lines (between consecutive activated stars), inscribed Metatron edges (bright gold, with bass-driven breath), 13 Metatron nodes (per-node activation state)
4. **trail canvas** — every frame: tapered ink ribbon (width modulated by phone angular speed + screen velocity) + two-layer ink-blob "pen" at the leading tip

**Reactivity model — per-element activation pattern shared across all interactive elements:**
- Each element has `act ∈ [0..1]`. Trail-tip proximity bumps it (`+dt*5`), otherwise decays (`-dt*0.55`).
- Color + size + glow scale with activation.
- Discrete events (star bursts, edge inscription) trigger on the activation transition (`act < 0.4 && this !== lastActivated`).

**Phone signal → visual:**
| Phone signal | Visual effect |
|---|---|
| `pitch` / `roll` | Cursor X/Y position (40% of viewBox per ±1 unit) |
| `accel.{x,y}` | Subtle directional cursor nudge (40px per 1g normalized) |
| `angularSpeed` (gyro) | Ribbon width (high speed → narrow ink) |
| `energy` (RMS) | Trail glow halo intensity |
| `articulation` (jerk) | Ink wet/dry character (sharp gestures dry faster) |
| `lastDownbeatAt` | Star burst within 180px + inscribed constellation line between two closest stars |

**Audio signal → visual:**
- Default song: `hearth-keeper_acoustic-soft-2000s.mp3` (hardcoded; experimental route, not env-driven yet)
- Bass band (bins 0-3) → ±5% breath on inscribed Metatron segments
- Bass-peak beat detection (rising-edge threshold 0.55, 250ms refractory) → pulses the "expected next" Metatron node
- "Expected next" = first endpoint of the first uninscribed canonical edge (currently always node 0 until all 12 center-spokes are inscribed; documented as item to refine)

**Constellation completion mechanic:**
- 13 Fruit-of-Life nodes activate when the trail tip passes within 20px
- When two consecutive node activations form a canonical Metatron edge, that edge inscribes permanently (Set keyed by `'i,j'`)
- All 78 edges inscribed → one-shot completion flash (2.5s decay, edges thicken to 4.1px + opacity peaks) + `isComplete` flag persists for the rest of the session
- 78-edge completion is intentionally hard — the inscribed pattern is a slow background reward, not a session goal

**Tap-to-begin:** browsers block `AudioContext.resume()` and `HTMLAudioElement.play()` until a user gesture. `BeginOverlay` is rendered while `audio.needsGesture` is true; a click anywhere calls `audio.tryStart()` which lazily constructs the audio graph and starts playback.

**Tests:** 15 vitest tests (8 geometry, 7 audio bands). The hook + canvas rendering are visually verified via `scripts/snap-glb-v2.mjs` (Playwright + WebSocket-intercept harness for synthetic phone gestures).

**Performance:** Zero WebGL contexts on the route (was 5 mid-iteration when R3F layers were stacked). Three 2D canvases. ~60fps on modern devices, ~30 on low-end mobile under sustained gesture.

**Not yet:** wiring to the actual Orchestra-phase audio (currently independent MP3 playback, not the matched-archetype stem player). When integrated, the simulated stem signals in this route become real `AnalyserNode` reads on the existing `StemPlayer` sources.

## Parked for later

Items deliberately deferred. Loop back here when picking these up.

### 1. Voice redesign (full)

Scope: rebuild the entire voice arc across PostListener (phases 0–6) and Orchestra (currently silent). The v3 ship is voice-free by design — the existing 51 admirer voice files are orphaned, the script architecture is gone, and `useAdmirer` fails silently. The redesign is its own phase, treating both halves as a single arc.

Open questions to resolve when starting:
- New voice direction (intimacy register? caretaking? mirroring? all three?)
- Where the new voices teach the conducting vocabulary (Briefing? inline during Bloom? discovery hints during Throne?)
- Whether the disclosure / "turn" returns (currently Orchestra is pure ego-feeding throughout — no Phase II turn)
- Closing line per variation (currently archetype-level, 4 lines × 6 archetypes; could expand to per-variation 24 lines)

The conducting gaps in §2 below become voice-driven discoverability when this phase happens.

### 2. Conducting gaps — addressed 2026-05-13

The yaw-on-roll bug, missing One Euro Filter, low downbeat threshold, and gesture-size gain floor identified in `Research/gesture-felt-agency-phone-as-baton.md` were fixed in the conducting refactor (`docs/superpowers/plans/2026-05-13-conducting-refactor.md`). Both the Orchestra phone-native path and the `/conduct-glb` relay path now share a single `src/conducting/GestureCore.js` source of truth, with research-aligned thresholds (4.0 m/s² / 300 ms refractory) and 1€ filtering active. Yaw-spotlight runs on `alpha` (compass), gyro magnitude cross-couples into the "Energy/Brightness" macro-dimension on the per-stem conducting filter + reverb send. Gated behind `USE_RESEARCH_CONDUCTING_PARAMS` and `ENABLE_GYRO_ENERGY_COUPLING` (both now `true`) — flip to `false` in `src/conducting/constants.js` to revert.

Still open: diegetic error feedback (Personal Orchestra's "orchestra stops when conducting is too erratic" pattern). Optional, depends on voice-redesign tone.

### 3. Stem quality

User noted vocals stem feels weak across many archetypes (instrumental tracks → htdemucs has nothing vocal-like to pull, leaks lead instruments inconsistently). Options:
- Re-run with `htdemucs_ft` (fine-tuned, ~3× slower, cleaner separation) — single command change in `scripts/run-demucs.sh`
- Rebalance per-stem gain at runtime in `OrchestraEngine` (boost vocals stem +3 to +6 dB)
- Swap which Demucs stem feeds which spatial position (e.g. route `other.mp3` to front-center "vocals" position if it has the lead melody)

### 4. Custom domain for R2

R2 currently serves from `pub-9c9037cd5db94d1b8d9ec361b8fc814e.r2.dev`. For production polish, point a subdomain like `stems.post-listner.com` (or whatever domain) at the R2 bucket — free with Cloudflare DNS, automatic SSL. Then update `VITE_STEMS_BASE_URL` and `VITE_MASTERS_BASE_URL` in Vercel and re-deploy. No code changes.

### 5. Dead code cleanup

Safe to delete after voice redesign decision:
- `api/compose.js`, `src/lib/compositionPlan.js` — dead since Orchestra v3
- `public/chamber/voices/v2/*.mp3` (51 files), `public/chamber/whispers/*.mp3` (5 files), `public/chamber/crowd/ovation.mp3`, `public/chamber/tracks/aftermath.mp3` — orphaned audio assets
- `src/chamber/data/CollectiveStore.js` — was used by deleted v2 ReturnScreen

`todo.md` tracks any remaining minor follow-ups outside this list.
