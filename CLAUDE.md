# PostListener

A musical identity instrument — an interactive web app that builds a personalized music composition based on user choices across multiple phases.

## Tech Stack

- **React 19** + **Vite 7** (ES modules)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **Framer Motion** for animations and transitions
- **Web Audio API** for real-time synthesis (`src/engine/audio.js`)
- **ElevenLabs Music API** for AI-generated music (`src/engine/elevenlabs.js`)

## Architecture

### Phase Flow
The app progresses through 7 sequential phases: `entry → spectrum → depth → textures → moment → reveal → result`

Each phase collects user interaction data and updates the **AVD Engine** (Arousal, Valence, Depth) — three normalized [0,1] values that ultimately define the user's musical identity and drive the AI composition.

### Key Modules

- **`src/engine/avd.js`** — Singleton `AVDEngine` class. Manages A/V/D state, per-phase data, composition plan generation, and subscriber pattern for reactive updates. Central state for the entire app.
- **`src/engine/audio.js`** — Singleton `AudioEngine` class. Web Audio synthesis for all interactive phases: stereo pairs, layered builds, texture previews, build-and-drop sequences, and full procedural track generation.
- **`src/engine/elevenlabs.js`** — ElevenLabs Music API wrapper. Supports prompt-based and composition-plan-based generation with auto-retry on bad prompt/plan errors.
- **`src/hooks/useInputMode.js`** — Detects mouse vs touch input, used throughout phases for adaptive interaction (click vs hold, scroll vs drag, keyboard shortcuts).
- **`src/components/TraceCanvas.jsx`** — Persistent background canvas that visualizes accumulated phase data (spectrum lines, depth verticals, texture dots, moment waveform).

### Phases

| # | Phase | File | What it measures |
|---|-------|------|-----------------|
| 0 | Entry | `Entry.jsx` | Initializes audio context on tap |
| 1 | Spectrum | `Spectrum.jsx` | Valence via 8 word-pair choices (shadow/warmth, etc.) with stereo audio |
| 2 | Depth Dial | `DepthDial.jsx` | Depth via layered audio build (1-8 layers) |
| 3 | Textures | `Textures.jsx` | Valence + Depth via texture preferences (strings, synth, distortion, etc.) |
| 4 | Moment | `Moment.jsx` | Arousal via tap-to-beat interaction during a 30s build-and-drop |
| 5 | Reveal | `Reveal.jsx` | Plays AI-generated music, reveals concept |
| 6 | Result | `Result.jsx` | Displays final AVD profile, saves to localStorage |

### Input Modes
All interactive phases support both **mouse** and **touch** with distinct UX:
- Mouse: hover/click, scroll wheel, arrow keys, spacebar
- Touch: hold, swipe, drag, double-tap, long-press

## Environment

- `VITE_ELEVENLABS_API_KEY` — Required for AI music generation in the Reveal phase

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Design

- Dark theme: `--bg: #0A0A0F`, `--accent: #D4A053` (amber)
- Fonts: Instrument Serif (headings), JetBrains Mono (UI)
- Film-grain overlay via SVG noise filter
- Minimal, museum-like aesthetic
