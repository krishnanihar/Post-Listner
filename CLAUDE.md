# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PostListener + The Orchestra

A two-part experience: PostListener profiles a user's musical identity through a 9-phase rite, then The Orchestra uses that identity to play a pre-recorded archetype-matched song through a 4-stem spatial audio graph the user conducts with their phone. The user's matched song begins under the Reveal Mirror beat and continues unbroken into the Orchestra phase, where it materializes spatially around the listener.

Both halves are a single React app, one Vite project, one Vercel deploy. Audio assets are hosted on Cloudflare R2.

## Tech Stack

- **React 19** + **Vite 7** (ES modules)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **Framer Motion** for animations and transitions
- **Vitest 4** + **jsdom** for pure-function unit tests (125 tests across `src/lib/__tests__/`)
- **Web Audio API** — raw nodes only, no external audio libraries
  - PostListener: `src/engine/audio.js` (synthesis, MP3 playback for Spectrum/Moment)
  - Orchestra (v3): `src/orchestra/OrchestraEngine.js` (4-stem spatial graph, per-stem mono filter chain → HRTF panner with pre-HRTF mono reverb send, 6 image-source early reflections, binaural hall IR convolver, constant 10 Hz alpha binaural beats bypassing the compressor)
  - Stem playback: `src/lib/stemPlayer.js` — sample-aligned 4-source loop player decoded from R2 URLs
  - Legacy Chamber (v1): `src/chamber/engine/` (still on disk, not routed)
- **Audio assets** hosted on **Cloudflare R2** (free egress, $0/month at our scale). Runtime base URLs are env-driven (`VITE_STEMS_BASE_URL`, `VITE_MASTERS_BASE_URL`); local fallback is `/public/stems` and `/public/music` (gitignored).
- **Demucs (htdemucs)** via Python venv at `~/.venvs/demucs` for offline 4-stem separation (vocals/drums/bass/other) of the 24 Suno-generated archetype masters.
- **Server-side ElevenLabs proxy** in `api/` (still wired but voices are now optional — admirer hook fails silently):
  - `POST /api/admirer` → ElevenLabs TTS (`eleven_v3`). Accepts `{ lineId }`, server resolves canonical text from allowlist (`api/_admirerLines.js`).
  - `POST /api/compose` → ElevenLabs Music API (`music_v1`) — **deprecated in v3**, no longer called from runtime (replaced by pre-recorded Suno tracks). File kept on disk; safe to delete.
- **DeviceMotionEvent / DeviceOrientationEvent** for phone-as-baton conducting (Spectrum, Depth, Moment, Orchestra)

## Architecture

### Phase Flow
The app progresses through 9 sequential phases:

`entry → spectrum → depth → gems → moment → autobio → reflection → reveal → orchestra`

PostListener phases (0–7) collect interaction data, build an AVD vector + 6×4 archetype/variation, and resolve the matched archetype's pre-recorded 4-stem set. The Orchestra phase (8) plays those stems through a 3-phase voice-free spatial audio graph that the user conducts.

The active phase components live in `src/phases/*.score.jsx` (the cream-paper "score" redesign). Pre-redesign components (`Entry.jsx`, `Spectrum.jsx`, `Moment.jsx`, etc.) remain on disk but are not routed.

### Audio Continuity (v3)

When **Autobio** completes its third prompt, `recordSong` runs `scoreArchetype(avd, phaseData)` to pick the archetype + variation, then `getStems(archetypeId, variationId)` resolves the 4 R2 stem URLs and `getMasterUrl(...)` resolves the single-master fallback. The bundle is passed forward as `onNext({ stemsBundle: { kind, stems, masterUrl, archetypeId, variationId } })`.

**`Reveal`** receives the bundle, calls `StemPlayer.load(ctx, stems, masterUrl)`:
- Tries to fetch + decode all 4 stems in parallel
- If any stem fetch fails, falls back to a single duplicated buffer (master fanned to all 4 stem positions)
- Returns a `StemPlayer` with the 4 sources running sample-aligned via `start(when)` with `loop=true`
- Reveal exposes the player via `revealAudioRef` for handoff to Orchestra

`StemPlayer.setVolume(target, fadeMs)` controls the simple sum-bus gain during Reveal (sub-audible during Mirror, full volume during listening).

**`Orchestra`** picks up the same player without restarting the sources. `StemPlayer.detachAndGetSources()` disconnects each `BufferSourceNode` from Reveal's sum bus and returns them; `engine.connectStems({vocals, drums, bass, other})` routes each into the per-stem mono chain → HRTF panner with pre-HRTF mono reverb send. The song never restarts and stays sample-aligned across the handoff.

Song duration is read from the longest stem buffer; engine envelopes (`tick(t, songDuration)`) and the closing-card transition use this directly.

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

### Hooks

- **`src/hooks/useAdmirer.js`** — `useAdmirer().play(lineId)` and `.preload(lineId)`. Caches Blob URLs by lineId in-memory across the session. Mount-guard prevents stale resolutions from playing in a later phase. **Fails silently** if `/api/admirer` returns an error — voice is enhancement, not gating.
- **`src/hooks/useInputMode.js`** — Detects mouse vs touch input.

### Key Modules — Engine

- **`src/engine/avd.js`** — Singleton `AVDEngine`. State `{a, v, d}`, history, per-phase data.
- **`src/engine/audio.js`** — Singleton `AudioEngine`. Web Audio synthesis: stereo pairs, layered builds, build-and-drop, MP3 crossfade looping.
- **`src/engine/elevenlabs.js`** — ElevenLabs Music API wrapper used by legacy `scripts/generate-assets.js`. Not called in v3.

### Key Modules — Orchestra (v3)

All Orchestra code lives under **`src/orchestra/`**. The main component is **`src/phases/Orchestra.jsx`**.

- **`src/orchestra/OrchestraEngine.js`** — Master audio graph. Per-stem (mono) chain: `entry → gain → eqFilter → distanceLP → conductingFilter → HRTFPanner → directBus`, with a parallel mono pre-HRTF reverb send into a shared `reverbBus`. Shared `reverbBus` feeds 6 image-source early reflections + a binaural hall IR convolver. Binaural beats (oscL + oscR → ChannelMerger → ctx.destination) bypass the compressor. No Track B, no ovation, no fracture coupling, no return tone (all removed in v3).
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

### Phases

| # | Phase | File | What it does |
|---|-------|------|-------------|
| 0 | Entry (Threshold rite) | `Entry.score.jsx` | Headphones → name capture → 6s held-tap → 2 × 6s exhales → voiced threshold statement → "begin" |
| 1 | Spectrum | `Spectrum.score.jsx` | 9 polar word-pair lean-and-hold choices (3s commit). Logs hover-without-commit. Operational-transparency comment after pair 4. |
| 2 | Depth | `Depth.score.jsx` | Tap to add layers (1–8) over a layered build. Equivoque framing copy. |
| 3 | Gems | `Gems.score.jsx` | 3 × 15s GEMS excerpts + 6-tile multi-select fade (nostalgic / awed / tender / melancholic / defiant / peaceful). Falls back to 4s silent listening when audio missing. |
| 4 | Moment | `Moment.score.jsx` | 30s build-and-drop with phone-as-baton conducting (downbeats + tactus drawing). Hurley liking probe (`hedonic: true \| false \| null`) before advancing. |
| 5 | Autobio | `Autobio.score.jsx` | 3 Rathbone "I am…" prompts with iTunes Search autocomplete + free-text fallback. **Resolves the matched archetype + variation's stem URLs from `stemsCatalog`** and pre-warms fetch via low-priority browser cache hint. Hands `stemsBundle` forward via `onNext`. |
| 6 | Reflection | `Reflection.score.jsx` | 5 lines (spectrum / depth / gems / moment / autobio) fade in sequentially on cream paper. ~12s total. |
| 7 | Reveal | `Reveal.score.jsx` | Loads 4 stems via `StemPlayer.load(ctx, stems, masterUrl)`, starts them sample-aligned. **Mirror beat (~25s)**: archetype reveal → variation microgenre → "because you…" attribution → 3-sentence Forer paragraph → memory callback → temporal frame. Then full-volume listening for ~25s of song body before handing off to Orchestra. No voice cues in v3. |
| 8 | Orchestra | `Orchestra.jsx` | 3-phase song-driven experience (Briefing 12s + Bloom 24s + Throne for the rest of the song + 4s end fade + 7s closing card). Voice-free. |

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

`.env.local` is gitignored via `*.local`. Vercel production needs `VITE_STEMS_BASE_URL` and `VITE_MASTERS_BASE_URL` set on the **Production** environment.

## Commands

```bash
npm run dev                          # Start dev server (Vite + /api middleware)
npm run build                        # Production build
npm run lint                         # ESLint
npm run preview                      # Preview production build
npm test                             # Run vitest suite (125 tests)
npm run test:watch                   # Watch mode

node scripts/generate-suno-prompts.js   # Generate 24 Suno V5.5 prompts → docs/suno-prompts.{md,json}
bash scripts/run-demucs.sh              # Stem-split public/music/*.mp3 → public/stems/{archetype}/{variation}/ via htdemucs on MPS (idempotent)
bash scripts/upload-to-r2.sh            # Sync public/stems/ + public/music/ to R2 with immutable cache headers (idempotent)
bash scripts/upload-to-r2.sh --dry-run  # Preview what would change
bash scripts/upload-to-r2.sh stems      # Sync stems only

# Legacy:
npm run gen:phase2                      # Legacy Phase 2 audio asset generation
node scripts/generate-assets.js         # Legacy Orchestra v2 audio asset generation (TTS, SFX, Music, Hall IR)
```

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

### 2. Conducting gaps (research-grounded)

Current implementation diverges from `Research/gesture-felt-agency-phone-as-baton.md` in three places. None block shipping but each would tighten felt agency. Detail in conversation history (2026-05-09).

| Gap | Fix |
|---|---|
| Yaw-quadrant spotlight is wired to **roll (gamma)** instead of compass heading **(alpha)**. Tilting and turning currently behave the same. | Separate `pan` (roll) and `yaw` (alpha) in `ConductingEngine.getData()`. Calibrate alpha baseline alongside beta/gamma. ~30 min. |
| **No One Euro Filter** on input side. Audio-side `setTargetAtTime` smoothing isn't speed-adaptive. | Add `OneEuroFilter` for gamma/beta/alpha streams (min_cutoff 1.0 Hz, beta 0.007). ~30 min. |
| **No diegetic error feedback** (Personal Orchestra's "orchestra stops when conducting is too erratic" pattern). | Optional: if `articulation > 0.8` for 3+ seconds, drop master gain and play a settle cue. Depends on voice redesign tone. |

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
