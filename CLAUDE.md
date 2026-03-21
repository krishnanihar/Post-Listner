# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PostListener + The Orchestra

A two-part experience: PostListener profiles a user's musical identity as an AVD vector, then The Orchestra uses that identity to guide them through a 10-minute conducting experience that dissolves their individual taste into a collective consciousness. The user's AI-generated song never stops — it seamlessly continues from Reveal through a concert hall that materializes, fractures, and dissolves. Both are a single React app, one Vite project, one Vercel deploy.

## Tech Stack

- **React 19** + **Vite 7** (ES modules)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **Framer Motion** for animations and transitions
- **Web Audio API** — raw nodes only, no external audio libraries
  - PostListener: `src/engine/audio.js` (synthesis, MP3 playback)
  - Orchestra: `src/orchestra/OrchestraEngine.js` (3-band split, HRTF spatial, hall convolver, binaural, Track B crossfade loop, sidechain ducking)
  - Legacy Chamber (v1): `src/chamber/engine/` (still present, constants re-exported by Orchestra)
- **ElevenLabs APIs** for asset generation:
  - Music API (`/v1/music`) → Track B ambient orchestral texture
  - TTS API (`/v1/text-to-speech`) → 26 voice/whisper MP3s
  - Sound Effects API (`/v1/sound-generation`) → crowd sounds (ovation, ambient)
- **DeviceMotionEvent / DeviceOrientationEvent** for phone-as-baton conducting

## Architecture

### Phase Flow
The app progresses through 8 sequential phases:

`entry → spectrum → depth → textures → moment → reveal → result → orchestra`

PostListener phases (0–6) collect interaction data and build an AVD vector. The Orchestra phase (7) uses that vector to drive a 10:30 audio experience.

### Audio Continuity
The user's song is created in Reveal as `new Audio(url)` with `loop = true`. A `revealAudioRef` in App.jsx persists the audio element across phase transitions. The song keeps playing through Result and into Orchestra, where `OrchestraEngine.connectSong()` creates the sole `MediaElementSource` and routes it through the 3-band frequency split. `RevealVisualizer` does NOT create a `MediaElementSource` — it renders from AVD data only.

### Key Modules — PostListener

- **`src/engine/avd.js`** — Singleton `AVDEngine`. Manages A/V/D state `{a, v, d}`, per-phase data, composition plan generation, subscriber pattern. Central state for the entire app.
- **`src/engine/audio.js`** — Singleton `AudioEngine`. Web Audio synthesis for all PostListener phases: stereo pairs, layered builds, texture previews, build-and-drop, procedural tracks. MP3 crossfade looping (`playMp3Pair`), texture previews (`playTextureMp3`).
- **`src/engine/elevenlabs.js`** — ElevenLabs Music API wrapper. Prompt-based and composition-plan-based music generation with auto-retry.
- **`src/hooks/useInputMode.js`** — Detects mouse vs touch input for adaptive UX across all phases.
- **`src/components/TraceCanvas.jsx`** — Persistent background canvas visualizing accumulated phase data.
- **`src/components/RevealVisualizer.jsx`** — Particle system during the Reveal phase, driven by AVD values. No audio analyser connection (Orchestra owns MediaElementSource).

### Key Modules — Orchestra (v2)

All new Orchestra code lives under **`src/orchestra/`**. The main component is **`src/phases/Orchestra.jsx`**.

- **`src/orchestra/OrchestraEngine.js`** — Master audio graph. Song → 3-band frequency split (LOW 250Hz / MID 250–2500Hz / HIGH 2500Hz) with per-section HRTF PannerNodes. Hall convolver reverb (wet/dry). Sidechain ducking on voices. Track B crossfade-looping with orbital panner. Binaural beats (L/R sine pair through ChannelMerger). Audience ambient. Per-frame `tick()` interpolates all gain envelopes, filter sweeps, fracture curves, and spatial drift. `applyConducting()` maps gesture data to per-section responses scaled by fracture coupling.
- **`src/orchestra/ConductingEngine.js`** — Consolidated DeviceMotion + DeviceOrientation handler. Downbeat detection (Y-axis zero-crossing), gesture size (rolling peak-to-peak, 2s window), orientation calibration. Returns raw `{pan, filterNorm, gestureGain, articulation, downbeat}` — NO coupling applied. Touch fallback for devices without motion permission.
- **`src/orchestra/VoiceScheduler.js`** — Schedules all voices and whispers at absolute timestamps using `AudioBufferSourceNode.start(when)`. Simpler than v1 — everything scheduled once at experience start.
- **`src/orchestra/constants.js`** — All timing (`STARTS`), gain curves (`GAINS`), fracture decay curves (`FRACTURE`), Track B parameters, section definitions, sidechain ducking params. Re-exports `CONDUCTING` from `src/chamber/utils/constants.js`.
- **`src/orchestra/scripts.js`** — Voice schedule (`VOICES`, `WHISPERS`) with absolute timestamps and file paths. `getAllPaths()` for preloading.
- **`src/orchestra/BriefingScreen.jsx`** — Conductor SVG silhouette + 3 sequential text lines + dim-to-black transition. 30s total before experience begins.
- **`src/orchestra/ReturnScreen.jsx`** — AVD visualization + collective overlay (30% opacity) + "You were always part of this." + return button after 15s.

### Key Modules — Legacy Chamber (v1)

The original chamber code remains under **`src/chamber/`** for reference and constant re-export. The Orchestra re-uses:

- **`src/chamber/utils/constants.js`** — `CONDUCTING` object (55+ gesture control parameters) re-exported by Orchestra constants.
- **`src/chamber/utils/math.js`** — `lerp`, `clamp`, `sphericalToCartesian`, `sigmoid` utilities used by Orchestra.
- **`src/chamber/data/CollectiveStore.js`** — localStorage store with 20 seed AVD vectors. Used by ReturnScreen.

### Phases

| # | Phase | File | What it does |
|---|-------|------|-------------|
| 0 | Entry | `Entry.jsx` | Initializes AudioContext on tap |
| 1 | Spectrum | `Spectrum.jsx` | Valence via 8 word-pair choices with pre-recorded MP3 stereo pairs |
| 2 | Depth Dial | `DepthDial.jsx` | Depth via layered audio build (1–8 layers) |
| 3 | Textures | `Textures.jsx` | Valence + Depth via texture preferences with MP3 previews |
| 4 | Moment | `Moment.jsx` | Arousal via tap-to-beat during a 10s build-and-drop |
| 5 | Reveal | `Reveal.jsx` | Plays AI-generated music (looped), reveals concept. Song persists via `revealAudioRef` |
| 6 | Result | `Result.jsx` | Displays final AVD profile, saves to localStorage, button → Orchestra |
| 7 | Orchestra | `Orchestra.jsx` | 10:30 Orchestra experience (30s briefing + 10min conducting/dissolution) |

### Orchestra Timeline

| Absolute Time | Phase | What happens |
|---------------|-------|-------------|
| 0:00–0:30 | Briefing | Conductor illustration, 3 text lines, screen dims to black |
| 0:30–0:50 | Bloom | Hall reverb fades in, song splits into 3 frequency bands with spatial width, audience murmur appears |
| 0:50–3:00 | Throne | Full conducting — tilt pans sections, gesture size controls volume, downbeats accent + haptic. Admirer warm voices with ducking. Ovation at 2:40 |
| 3:00–6:00 | Ascent | Orchestra fractures — HIGH stops responding first, then MID, then LOW. Per-section azimuth drift + detune. Track B enters at 4:00 (muffled, clears over time). Crossover at 5:20 |
| 6:00–9:15 | Dissolution | Track A gone by 7:30. Track B dominant. Voices without ducking — "They thought they were conducting." Binaural theta (4 Hz). "Good" at 8:50 triggers Track B swell |
| 9:15–10:00 | Silence | 25s true silence. Return tone at 9:55 (sine, freq from depth). All audio fades |
| 10:00–10:30 | Return | Screen brightens. AVD visualization + collective overlay. "You were always part of this." Return button → Result |

### Input Modes (PostListener phases)
- Mouse: hover/click, scroll wheel, arrow keys, spacebar
- Touch: hold, swipe, drag, double-tap, long-press

### Audio Assets

**PostListener:**
- **`public/spectrum/`** — 16 MP3 clips for 8 word-pairs (stereo crossfade pairs)
- **`public/Texture/`** — 8 MP3 clips for texture previews

**Orchestra (v2) — `public/chamber/`:**
- **`voices/`** — 21 voice MP3s: admirer-warm (4), admirer-cool (4), admirer-cold (2), guide (7), witness (4)
- **`whispers/`** — 5 whisper MP3s (processed, scattered in 3D space)
- **`crowd/ovation.mp3`** — 12s orchestral applause (behind user at azimuth 180°)
- **`crowd/ambient-01.mp3`**, **`crowd/ambient-02.mp3`** — 30s looping concert hall ambience
- **`tracks/aftermath.mp3`** — Track B, 60s ambient orchestral wash (crossfade-looped in code)
- **`hall-ir.wav`** — 4s synthesized concert hall impulse response for ConvolverNode

**Legacy Chamber (v1):**
- **`public/voices/`** — admirer, guide, witness voice tracks
- **`public/whispers/`**, **`public/fragments/`**, **`public/crowd/`** — ambient/texture audio
- **`public/music/`** — chamber-track.mp3, collectiveend.mp3

### Spectrum AVD Coordinates

Each Spectrum word-pair carries explicit `coordL` / `coordR` AVD coordinates (defined in `SPECTRUM-AUDIO-PROMPTS.md`). The balance slider interpolates between the two coordinate sets. Spectrum tracks `reversalCount` as an additional engagement signal.

## Environment

- `VITE_ELEVENLABS_API_KEY` — Required for AI music generation in the Reveal phase and for running `scripts/generate-assets.js`.

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build

node scripts/generate-assets.js  # Generate Orchestra audio assets (TTS, SFX, Music, Hall IR)
```

## Design

- Dark theme: `--bg: #0A0A0F`, `--bg-dark: #000000` (orchestra), `--accent: #D4A053` (amber)
- Fonts: Instrument Serif (headings), JetBrains Mono (UI)
- Film-grain overlay via SVG noise filter (opacity 0.04)
- Safe area insets: `.pb-safe`, `.pt-safe` for notched phones
- Minimal, museum-like aesthetic; Orchestra experience is pure black screen
- Conductor SVG: amber-stroke (#D4A053) pictogram, silhouette from behind with raised baton
