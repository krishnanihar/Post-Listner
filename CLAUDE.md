# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PostListener + The Orchestra

A two-part experience: PostListener profiles a user's musical identity through a 9-phase rite, then The Orchestra uses that identity to guide them through a 10-minute conducting experience that dissolves their individual taste into a collective consciousness. The user's per-session AI-generated song never stops — it seamlessly continues from Reveal through a concert hall that materializes, fractures, and dissolves. Both are a single React app, one Vite project, one Vercel deploy.

## Tech Stack

- **React 19** + **Vite 7** (ES modules)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **Framer Motion** for animations and transitions
- **Vitest 4** + **jsdom** for pure-function unit tests (~107 tests across `src/lib/__tests__/`)
- **Web Audio API** — raw nodes only, no external audio libraries
  - PostListener: `src/engine/audio.js` (synthesis, MP3 playback)
  - Orchestra: `src/orchestra/OrchestraEngine.js` (3-band split, HRTF spatial, hall convolver, binaural, Track B crossfade loop, sidechain ducking)
  - Legacy Chamber (v1): `src/chamber/engine/` (still present, constants re-exported by Orchestra)
- **Server-side ElevenLabs proxy** in `api/` — Vite dev middleware in dev, Vercel serverless functions in prod. Two routes:
  - `POST /api/admirer` → ElevenLabs TTS (`eleven_v3`). Accepts `{ lineId }`, server resolves canonical text from allowlist (`api/_admirerLines.js`).
  - `POST /api/compose` → ElevenLabs Music API (`music_v1`) for per-session Reveal track. Accepts `{ composition_plan }`.
- **DeviceMotionEvent / DeviceOrientationEvent** for phone-as-baton conducting (Spectrum, Depth, Moment, Orchestra)

## Architecture

### Phase Flow
The app progresses through 9 sequential phases:

`entry → spectrum → depth → gems → moment → autobio → reflection → reveal → orchestra`

PostListener phases (0–7) collect interaction data, build an AVD vector + 6×4 archetype/variation, and kick off per-session music generation. The Orchestra phase (8) uses that data to drive a 10:30 audio experience.

The active phase components live in `src/phases/*.score.jsx` (the cream-paper "score" redesign). Pre-redesign components (`Entry.jsx`, `Spectrum.jsx`, `Moment.jsx`, etc.) remain on disk but are not routed.

### Audio Continuity
The user's song URL is generated when **Autobio** completes its third prompt (where all session signals are finally present): `Autobio.recordSong` builds a composition plan via `buildCompositionPlan({archetypeId, variationId, eraMedian, dominantGemsTag, hedonic})` and POSTs to `/api/compose`. The resulting Blob URL travels via `onNext({ musicPromise })` → `App.jsx` stores it in `musicPromiseRef` → `Reveal` consumes it. If the API call fails, falls back to the static `/chamber/tracks/track-a.mp3`.

`Reveal` creates `new Audio(url)` with `loop = true` and assigns to `revealAudioRef` (in `App.jsx`). The same audio element persists across the Reveal → Orchestra transition, where `OrchestraEngine.connectSong()` creates the sole `MediaElementSource` and routes it through the 3-band frequency split.

### Score-v2 lib modules (`src/lib/`)

Pure-function modules that drive the score-v2 redesign. All have unit tests in `src/lib/__tests__/`.

- **`archetypes.js`** — `ARCHETYPES` array (6 archetypes × 4 variations) + Forer paragraph templates. Each archetype carries `scoringWeights: {a, v, d}`. Variations carry `era` + Daylist-style `microgenreLabel`.
- **`scoreArchetype.js`** — `scoreArchetype(avd, phaseData, rand?)` cascade hybrid: softmax over `-distance/temperature` for archetype, then era-aware variation pick (autobio era median > depth heuristic) with ε-greedy (ε=0.12).
- **`hedonicBias.js`** — when `phaseData.moment.hedonic === false`, multiplies archetype scores (Sky-Seeker × 0.06, Quiet Insurgent × 2.0, Slow Glow × 1.4, Hearth-Keeper × 0.85) and renormalizes. Applied inside `scoreArchetype` after softmax.
- **`compositionPlan.js`** — `buildCompositionPlan({archetypeId, variationId, eraMedian, dominantGemsTag, hedonic})` returns `{positive_global_styles, negative_global_styles, sections}` for the Music API. Single 30s section.
- **`reflectionLines.js`** — `buildReflectionLines(avd, phaseData)` returns 5 `{signal, interpretation}` lines (spectrum, depth, gems, moment, autobio) for the Reflection phase.
- **`forerLines.js`** — Mirror beat copy generators: `buildBecauseLine`, `buildMemoryCallback` (prefers autobio.songs[0] → textures → spectrum), `buildTimeOfDayLine`, `buildLatencyLine`, `buildTemporalFrame`.
- **`gemsTags.js`** — `GEMS_TAGS` array of 6 emotion tiles (nostalgic, awed, tender, melancholic, defiant, peaceful) with per-tile AVD nudges. `gemsExcerptsToAvdNudge`, `dominantGemsTag` helpers.
- **`era.js`** — `detectEraCluster(years)` returns `{median, span, clustered}`; `buildEraLine` returns reflection-friendly era copy.
- **`autobio.js`** — `validateSong({title, artist, year})`, `summarizeAutobio(songs) → {songs, eraSummary}`. Calls `detectEraCluster` internally.
- **`itunesSearch.js`** — `searchTracks(query, signal?) → Promise<Track[]>` wrapping iTunes Search API. CORS-friendly, no auth, called directly from Autobio.
- **`spectrumPairs.js`** — `PAIRS_LEGACY` (8 pairs, current default) + `PAIRS_V2` (9 polar production-aesthetic pairs, behind `ACTIVE_PAIRS` toggle). Spectrum imports `ACTIVE_PAIRS`.
- **`voiceRegister.js`** — Admirer voice register → ElevenLabs `voice_settings` mapping. Three registers: caretaking / present / elevated.
- **`textHash.js`** — FNV-1a deterministic hash for cache keys.
- **`moment.js`** — `computeBpm(moment)` derives BPM from `totalDownbeats` (score-flow) or `peakTapRate` (legacy fallback).

### Server-side proxy (`api/`)

ElevenLabs API key (`ELEVENLABS_API_KEY`, no VITE_ prefix) stays on the server. Vite dev middleware in `vite.config.js` mounts `/api/*.js` handlers via `ssrLoadModule`. In production, Vercel auto-deploys these as serverless functions.

- **`api/admirer.js`** — TTS handler. Body `{ lineId }`. Resolves text via `resolveLine(lineId)` from `_admirerLines.js`. Rejects unknown lineIds with 400 (closes credit-spend abuse vector).
- **`api/compose.js`** — Music API handler. Body `{ composition_plan }`. Returns audio/mpeg stream.
- **`api/_admirerLines.js`** — Server-side allowlist of voice lines per phase. Canonical source.
- **`api/_elevenlabs.js`** — Shared helpers: `getApiKey`, `readJsonBody`, `sendError`.

### Hooks

- **`src/hooks/useAdmirer.js`** — `useAdmirer().play(lineId)` and `.preload(lineId)`. Caches Blob URLs by lineId in-memory across the session. Mount-guard (`mountedRef`) prevents stale resolutions from playing audio in a later phase.
- **`src/hooks/useInputMode.js`** — Detects mouse vs touch input.

### Key Modules — Engine

- **`src/engine/avd.js`** — Singleton `AVDEngine`. State `{a, v, d}`, history, per-phase data. `phaseData` shape after Phase 2: `{spectrum, depth, textures, gems, moment, autobio}`. `getCompositionPlan()` derives a legacy plan from gems-derived style hints (`textures.preferred` removed in Phase 2).
- **`src/engine/audio.js`** — Singleton `AudioEngine`. Web Audio synthesis: stereo pairs, layered builds, build-and-drop, MP3 crossfade looping (`playMp3Pair`).
- **`src/engine/elevenlabs.js`** — ElevenLabs Music API wrapper used by `scripts/generate-assets.js`. Phase 3 routes go through `api/compose.js` instead.

### Key Modules — Orchestra (v2)

All Orchestra code lives under **`src/orchestra/`**. The main component is **`src/phases/Orchestra.jsx`**.

- **`src/orchestra/OrchestraEngine.js`** — Master audio graph. Song → 3-band frequency split (LOW 250Hz / MID 250–2500Hz / HIGH 2500Hz) with per-section HRTF PannerNodes. Hall convolver reverb. Sidechain ducking. Track B crossfade-looping. Binaural beats. Audience ambient. Per-frame `tick()` interpolates gain envelopes, filter sweeps, fracture curves, spatial drift.
- **`src/orchestra/ConductingEngine.js`** — DeviceMotion + DeviceOrientation handler. Downbeat detection, gesture size, orientation calibration. Touch fallback.
- **`src/orchestra/VoiceScheduler.js`** — Schedules voices/whispers at absolute timestamps via `AudioBufferSourceNode.start(when)`.
- **`src/orchestra/constants.js`** — Timing, gain curves, fracture decay, Track B params, sidechain ducking. Re-exports `CONDUCTING` from `src/chamber/utils/constants.js`.
- **`src/orchestra/scripts.js`** — `VOICES`, `WHISPERS` schedule with absolute timestamps + paths. `getAllPaths()` for preloading.
- **`src/orchestra/preloader.js`** — Warms Orchestra asset cache during Reveal.
- **`src/orchestra/BriefingScreen.jsx`** — Conductor SVG silhouette + 3 text lines + dim-to-black. 30s.
- **`src/orchestra/ReturnScreen.jsx`** — AVD visualization + collective overlay + return button after 15s.

### Legacy Chamber (v1)

Original chamber code under `src/chamber/`:
- **`src/chamber/utils/constants.js`** — `CONDUCTING` object re-exported by Orchestra.
- **`src/chamber/utils/math.js`** — `lerp`, `clamp`, `sphericalToCartesian`, `sigmoid`.
- **`src/chamber/data/CollectiveStore.js`** — localStorage store with 20 seed AVD vectors (used by ReturnScreen).

### Phases

| # | Phase | File | What it does |
|---|-------|------|-------------|
| 0 | Entry (Threshold rite) | `Entry.score.jsx` | Headphones → name capture → 6s held-tap → 2 × 6s exhales → voiced threshold statement → "begin" |
| 1 | Spectrum | `Spectrum.score.jsx` | 8 word-pair lean-and-hold choices (3s commit). Logs hover-without-commit. Operational-transparency comment after pair 4. |
| 2 | Depth | `Depth.score.jsx` | Tap to add layers (1–8) over a layered build. Equivoque framing copy. |
| 3 | Gems | `Gems.score.jsx` | 3 × 15s GEMS excerpts + 6-tile multi-select fade (nostalgic / awed / tender / melancholic / defiant / peaceful). Falls back to 4s silent listening when audio missing. |
| 4 | Moment | `Moment.score.jsx` | 30s build-and-drop with phone-as-baton conducting (downbeats + tactus drawing). Hurley liking probe (`hedonic: true \| false \| null`) before advancing. Passes static-track `musicPromise` as fallback. |
| 5 | Autobio | `Autobio.score.jsx` | 3 Rathbone "I am…" prompts with iTunes Search autocomplete + free-text fallback. **Generates per-session Reveal track** here via `buildCompositionPlan` → `/api/compose`. |
| 6 | Reflection | `Reflection.score.jsx` | 5 lines (spectrum / depth / gems / moment / autobio) fade in sequentially on cream paper. ~12s total. |
| 7 | Reveal | `Reveal.score.jsx` | **Mirror beat (~25s)**: archetype reveal → variation microgenre → "because you…" attribution → 3-sentence Forer paragraph → memory callback → temporal frame. Then plays the AI-generated song from t=0. |
| 8 | Orchestra | `Orchestra.jsx` | 10:30 Orchestra experience (30s briefing + 10min conducting/dissolution). |

### Orchestra Timeline

| Absolute Time | Stage | What happens |
|---------------|-------|-------------|
| 0:00–0:30 | Briefing | Conductor illustration, 3 text lines, dim to black |
| 0:30–0:50 | Bloom | Hall reverb fades in, song splits into 3 frequency bands with spatial width, audience murmur |
| 0:50–3:00 | Throne | Full conducting — tilt pans sections, gesture size controls volume, downbeats accent + haptic. Admirer warm voices with ducking. Ovation at 2:40 |
| 3:00–6:00 | Ascent | Orchestra fractures — HIGH stops responding first, then MID, then LOW. Per-section azimuth drift + detune. Track B enters at 4:00 (muffled, clears over time). Crossover at 5:20 |
| 6:00–9:15 | Dissolution | Track A gone by 7:30. Track B dominant. Voices without ducking — "They thought they were conducting." Binaural theta (4 Hz). "Good" at 8:50 triggers Track B swell |
| 9:15–10:00 | Silence | 25s true silence. Return tone at 9:55 (sine, freq from depth). All audio fades |
| 10:00–10:30 | Return | Screen brightens. AVD visualization + collective overlay. "You were always part of this." Return button → home |

### Audio Assets

**PostListener (existing):**
- **`public/spectrum/`** — 16 MP3 clips for the legacy 8 word-pairs (stereo crossfade pairs)
- **`public/Texture/`** — 8 MP3 clips for legacy texture previews (Textures phase removed but assets retained)
- **`public/chamber/voices/score/`** — voice cues for legacy phase narration (still played alongside dynamic Admirer voice in some phases)

**PostListener (Phase 2/3 dependencies — to generate via `npm run gen:phase2`):**
- **`public/gems/{sublimity,tenderness,tension}.mp3`** — 3 × 15s GEMS excerpts (currently missing — Gems phase falls back to 4s silent listening)
- **`public/spectrum/v2/{warm,cold,dense,spare,sung,instrumental,...}.mp3`** — 18 × 8s Spectrum v2 polar pairs (behind `ACTIVE_PAIRS = PAIRS_V2` toggle in `src/lib/spectrumPairs.js`)

**Per-session (generated at runtime via `/api/compose`):**
- The Reveal track is generated dynamically from each user's session signals. Falls back to `public/chamber/tracks/track-a.mp3` if Music API fails.

**Orchestra (v2) — `public/chamber/`:**
- **`voices/score/`** — Phase 1 voice cues + Orchestra voice cues
- **`voices/`** — admirer-warm/cool/cold (10), guide (7), witness (4) for Orchestra
- **`whispers/`** — 5 whisper MP3s
- **`crowd/{ovation,ambient-01,ambient-02}.mp3`** — applause + concert hall ambience
- **`tracks/aftermath.mp3`** — Track B, 60s ambient orchestral wash
- **`hall-ir.wav`** — 4s synthesized concert hall impulse response

### Spectrum AVD Coordinates

Each Spectrum word-pair carries explicit `coordL` / `coordR` AVD coordinates in `src/lib/spectrumPairs.js`. The lean position interpolates between the two coordinate sets. Spectrum also tracks `reversalCount`, `confidence`, `hoveredButNotChosen[]` for downstream signal weighting.

## Environment

Both env vars must be set in `.env.local`:

- **`VITE_ELEVENLABS_API_KEY`** — used by `scripts/generate-assets.js` and `scripts/generate-phase2-assets.js`. Read at build time but **not** sent to the client (no client code references it directly).
- **`ELEVENLABS_API_KEY`** — used by `api/admirer.js` and `api/compose.js` server proxy. Loaded into `process.env` by `dotenv` in `vite.config.js`. **Never** exposed to the client.

Both should be the same value.

## Commands

```bash
npm run dev                          # Start dev server (Vite + /api middleware)
npm run build                        # Production build
npm run lint                         # ESLint
npm run preview                      # Preview production build
npm test                             # Run vitest suite (~107 tests)
npm run test:watch                   # Watch mode
npm run gen:phase2                   # Generate the 21 missing GEMS + Spectrum v2 audio assets (idempotent)

node scripts/generate-assets.js      # Generate Orchestra audio assets (TTS, SFX, Music, Hall IR)
```

## Design

- **Cream-paper aesthetic** for all PostListener phases (Phase 1+ score-v2 redesign): `--paperCream: #F2EBD8`, `--inkCream: #1C1814`, italic serif, Roman numeral phase labels (i. through viii.)
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

`todo.md` tracks remaining asset dependencies (GEMS audio + Spectrum v2 audio prompts) and minor follow-ups.
