# PostListener + The Dissolution Chamber

A two-part experience: PostListener profiles a user's musical identity as an AVD vector, then the Dissolution Chamber uses that identity to guide them through a 10-minute audio experience that dissolves their individual taste into a collective consciousness. Both are a single React app, one Vite project, one Vercel deploy.

## Tech Stack

- **React 19** + **Vite 7** (ES modules)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **Framer Motion** for animations and transitions
- **Web Audio API** — raw nodes only, no external audio libraries
  - PostListener: `src/engine/audio.js` (synthesis, MP3 playback)
  - Chamber: `src/chamber/engine/` (binaural beats, spatial HRTF, collective drone, modulation LFO)
- **ElevenLabs Music API** for AI-generated music in the Reveal phase (`src/engine/elevenlabs.js`)
- **DeviceMotionEvent / DeviceOrientationEvent** for phone-as-baton conducting in the Chamber

## Architecture

### Phase Flow
The app progresses through 8 sequential phases:

`entry → spectrum → depth → textures → moment → reveal → result → chamber`

PostListener phases (0–6) collect interaction data and build an AVD vector. The Chamber phase (7) uses that vector to drive a 10-minute audio experience.

### Key Modules — PostListener

- **`src/engine/avd.js`** — Singleton `AVDEngine`. Manages A/V/D state `{a, v, d}`, per-phase data, composition plan generation, subscriber pattern. Central state for the entire app.
- **`src/engine/audio.js`** — Singleton `AudioEngine`. Web Audio synthesis for all PostListener phases: stereo pairs, layered builds, texture previews, build-and-drop, procedural tracks. MP3 crossfade looping (`playMp3Pair`), texture previews (`playTextureMp3`).
- **`src/engine/elevenlabs.js`** — ElevenLabs Music API wrapper. Prompt-based and composition-plan-based music generation with auto-retry.
- **`src/hooks/useInputMode.js`** — Detects mouse vs touch input for adaptive UX across all phases.
- **`src/components/TraceCanvas.jsx`** — Persistent background canvas visualizing accumulated phase data.
- **`src/components/RevealVisualizer.jsx`** — Particle system during the Reveal phase, driven by AVD values.

### Key Modules — Dissolution Chamber

All chamber code lives under **`src/chamber/`** to avoid naming conflicts with PostListener modules.

- **`src/chamber/engine/AudioEngine.js`** — Master audio graph. 5 signal paths (music, binaural, collective, voices, textures) routed through a DynamicsCompressor. `preloadAll()` fetches all 51 MP3s before the experience starts.
- **`src/chamber/engine/BinauralEngine.js`** — Two sine oscillators → ChannelMerger(2) for strict L/R stereo separation. Beat frequency sweeps: 10 Hz (alpha) → 6 Hz → 4 Hz (theta) → 2 Hz (delta) across phases.
- **`src/chamber/engine/ModulationEngine.js`** — Alpha-frequency LFO (8–13 Hz) connected to the collective gain AudioParam. Makes the collective audio "breathe" at alpha frequency — the auditory equivalent of Gysin's Dreamachine.
- **`src/chamber/engine/SpatialEngine.js`** — HRTF PannerNodes with spherical→cartesian positioning. Orbital motion updates each frame. Elevations rise during Dissolution phase.
- **`src/chamber/engine/CouplingEngine.js`** — Sigmoid decay from 1.0→0.0 over the Ascent phase (165–345s). All gesture-to-audio mappings multiply by coupling value, killing conductor agency over time.
- **`src/chamber/engine/CollectiveEngine.js`** — Plays the pre-generated collective track (`/music/collectiveend.mp3`) through a lowpass filter and convolver reverb tuned to the collective AVD. Also plays crowd ambience (murmur, breath).
- **`src/chamber/motion/MotionHandler.js`** — DeviceMotion + DeviceOrientation event listeners. Caches accel/orientation/RMS/jerk data for the rAF loop to consume.
- **`src/chamber/motion/GestureMapper.js`** — Maps sensor data to `{pan, filterNorm, intensity, articulation}` (all 0–1), scaled by coupling. Touch fallback if motion permission denied.
- **`src/chamber/phases/PhaseManager.js`** — rAF-driven state machine. Tracks `currentPhase`, `phaseElapsed`, `totalElapsed`, `phaseProgress` (0–1), `deltaTime`. Subscriber pattern for phase changes.
- **`src/chamber/voices/scripts.js`** — Schedules all 51 pre-recorded MP3s across phases with per-file delays (seconds from phase start).
- **`src/chamber/voices/VoiceScheduler.js`** — On phase change, schedules `AudioBufferSourceNode.start(ctx.currentTime + delay)` for each voice. Routes through SpatialEngine panners.
- **`src/chamber/data/CollectiveStore.js`** — localStorage store with 20 seed AVD vectors. `getCollective()` returns running mean + count. `addEntry(avd)` appends user's vector after experience.
- **`src/chamber/data/MusicSelector.js`** — Euclidean distance track selection. Currently one track (`/music/chamber-track.mp3`); ready for expansion.

### Phases

| # | Phase | File | What it does |
|---|-------|------|-------------|
| 0 | Entry | `Entry.jsx` | Initializes AudioContext on tap |
| 1 | Spectrum | `Spectrum.jsx` | Valence via 8 word-pair choices with pre-recorded MP3 stereo pairs |
| 2 | Depth Dial | `DepthDial.jsx` | Depth via layered audio build (1–8 layers) |
| 3 | Textures | `Textures.jsx` | Valence + Depth via texture preferences with MP3 previews |
| 4 | Moment | `Moment.jsx` | Arousal via tap-to-beat during a 10s build-and-drop |
| 5 | Reveal | `Reveal.jsx` | Plays AI-generated music, reveals concept |
| 6 | Result | `Result.jsx` | Displays final AVD profile, saves to localStorage, button → Chamber |
| 7 | Chamber | `Chamber.jsx` | 10-minute Dissolution Chamber experience |

### Chamber Phase Timeline

| Time | Phase | What happens |
|------|-------|-------------|
| 0:00–0:45 | Intro | Screen goes black, binaural alpha beats fade in (10 Hz), admirer voices start |
| 0:45–2:45 | Throne | Ego inflation via admirer voices, phone-as-baton conducting at full coupling |
| 2:45–5:45 | Ascent | Guide voices add spatial depth, binaural sweeps 10→6 Hz, coupling decays, collective drone fades in |
| 5:45–9:15 | Dissolution | Witness voices, whispers, fragments scattered. Music fades out, collective dominates. Binaural at 4 Hz theta. Modulation "breathing" perceptible. Coupling = 0 (conducting does nothing) |
| 9:15–10:00 | Silence | Binaural fades to 2 Hz delta, all audio fades, screen brightens |

### Input Modes (PostListener phases)
- Mouse: hover/click, scroll wheel, arrow keys, spacebar
- Touch: hold, swipe, drag, double-tap, long-press

### Audio Assets

**PostListener:**
- **`public/spectrum/`** — 16 MP3 clips for 8 word-pairs (stereo crossfade pairs)
- **`public/Texture/`** — 8 MP3 clips for texture previews

**Dissolution Chamber:**
- **`public/voices/admirer/`** — 17 voice tracks (ego inflation, Throne + Ascent)
- **`public/voices/guide/`** — 11 voice tracks (spatial guidance, Ascent)
- **`public/voices/witness/`** — 4 voice tracks (third-person witness, Dissolution)
- **`public/whispers/`** — 5 whisper fragments (Dissolution)
- **`public/fragments/`** — 6 short voice fragments (Dissolution texture)
- **`public/crowd/`** — 7 ambient tracks (murmur, breath, applause)
- **`public/music/chamber-track.mp3`** — Primary music track (loops during Throne + Ascent)
- **`public/music/collectiveend.mp3`** — Collective track (fades in during Ascent, dominates Dissolution)

### Spectrum AVD Coordinates

Each Spectrum word-pair carries explicit `coordL` / `coordR` AVD coordinates (defined in `SPECTRUM-AUDIO-PROMPTS.md`). The balance slider interpolates between the two coordinate sets. Spectrum tracks `reversalCount` as an additional engagement signal.

## Environment

- `VITE_ELEVENLABS_API_KEY` — Required for AI music generation in the Reveal phase. Not needed for the Chamber (all pre-recorded).

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Design

- Dark theme: `--bg: #0A0A0F`, `--bg-dark: #000000` (chamber), `--accent: #D4A053` (amber)
- Fonts: Instrument Serif (headings), JetBrains Mono (UI)
- Film-grain overlay via SVG noise filter (opacity 0.04)
- Safe area insets: `.pb-safe`, `.pt-safe` for notched phones
- Minimal, museum-like aesthetic; Chamber is near-total darkness
