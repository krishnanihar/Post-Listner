# THE ORCHESTRA — Claude Code Build Spec
## Dissolution Chamber v2: integrated into PostListener as a single app

**Read this entire document before writing any code.**
**Read every file listed in "Files to read first" before touching anything.**

---

## What You're Building

The Dissolution Chamber is being redesigned from scratch. It is no longer a separate experience accessed from the Chamber phase. It is a seamless continuation of the PostListener Reveal phase. The user's song never stops. The screen dims, a concert hall materializes around the music they're already hearing, they conduct an orchestra, they're praised, and then it all dissolves.

The central metaphor is **"you are conducting an orchestra, and then you aren't."**

**Total duration after "show me who I am" button:** ~10 minutes 30 seconds (30s Reveal/Briefing + 10 min Chamber).

---

## Files to Read First

Read these completely before writing any code:

- `src/App.jsx` — Phase state machine. You're modifying the flow.
- `src/phases/Reveal.jsx` — Where the song plays. The audio element must persist into Chamber.
- `src/phases/Result.jsx` — Where "show me who I am" button lives. This triggers the Chamber.
- `src/engine/audio.js` — PostListener audio engine. Do NOT rewrite.
- `src/engine/avd.js` — AVD state. Chamber reads final AVD values.
- `src/engine/elevenlabs.js` — ElevenLabs API wrapper. Used for asset generation.
- `src/phases/Chamber.jsx` — Current v1 implementation. You are REPLACING this entirely.
- `src/chamber/` — Current v1 chamber modules. Most will be replaced.
- `src/components/RevealVisualizer.jsx` — The AVD visualization. Used in Reveal and Return.

---

## Do NOT Modify

- `src/phases/Entry.jsx`, `src/phases/Spectrum.jsx`, `src/phases/DepthDial.jsx`, `src/phases/Textures.jsx`, `src/phases/Moment.jsx`
- `src/engine/avd.js` (read only)
- `src/engine/audio.js` (PostListener audio engine — leave untouched)
- `src/components/TraceCanvas.jsx`, `src/components/PhaseGuide.jsx`
- `src/hooks/useInputMode.js`
- `src/index.css`, `src/main.jsx`, `index.html`, `vite.config.js`

---

## Do NOT Add New Dependencies

Everything uses Web Audio API, DeviceMotion API, Framer Motion (already installed), and fetch(). No Tone.js, no Howler, no new npm packages.

---

## STEP 0 — Generate Audio Assets

Create a Node.js script: `scripts/generate-assets.js`

Run once: `node scripts/generate-assets.js`

Read the ElevenLabs API key from `.env.local` (already exists) by parsing the file with `fs.readFileSync` — do NOT add dotenv as a dependency.

### Directory structure to create:

```
public/chamber/
├── tracks/
│   └── aftermath.mp3           # Track B — ElevenLabs Sound Generation
├── voices/
│   ├── admirer-warm-01.mp3     # "The sound moved when you moved."
│   ├── admirer-warm-02.mp3     # "Not everyone hears this way."
│   ├── admirer-warm-03.mp3     # "This room is yours right now."
│   ├── admirer-warm-04.mp3     # "Every sound in it answers to you."
│   ├── admirer-cool-01.mp3     # "Can you feel where it ends?"
│   ├── admirer-cool-02.mp3     # "The sound isn't where it was."
│   ├── admirer-cool-03.mp3     # "You don't need to move so much."
│   ├── admirer-cool-04.mp3     # "The music isn't coming from your hand anymore."
│   ├── admirer-cold-01.mp3     # "Someone else heard this same song."
│   ├── admirer-cold-02.mp3     # "They held their phone just like you."
│   ├── guide-01.mp3            # "The room is larger than you thought."
│   ├── guide-02.mp3            # "Everyone who was here before left something in this sound."
│   ├── guide-03.mp3            # "Above you."
│   ├── guide-04.mp3            # "Below you."
│   ├── guide-05.mp3            # "Inside."
│   ├── guide-06.mp3            # "Let go."
│   ├── guide-07.mp3            # "Good."
│   ├── witness-01.mp3          # "Another one came in."
│   ├── witness-02.mp3          # "They thought they were conducting."
│   ├── witness-03.mp3          # "They stopped moving a while ago."
│   └── witness-04.mp3          # "This was always the sound."
├── whispers/
│   ├── whisper-01.mp3          # "where did I go"
│   ├── whisper-02.mp3          # "still here"
│   ├── whisper-03.mp3          # "dissolving"
│   ├── whisper-04.mp3          # "everyone"
│   └── whisper-05.mp3          # "always the sound"
├── crowd/
│   ├── ovation.mp3             # MANUALLY SOURCED
│   ├── ambient-01.mp3          # MANUALLY SOURCED
│   └── ambient-02.mp3          # MANUALLY SOURCED
└── hall-ir.wav                 # MANUALLY SOURCED
```

### Voice Generation — ElevenLabs TTS API

Endpoint: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`

Select three voice IDs from the ElevenLabs library. Store as constants:

```javascript
const ADMIRER_VOICE_ID = '' // Warm, clear, intimate. Not breathy, not dramatic.
const GUIDE_VOICE_ID = ''   // Slower, deeper, resonant. Gender-ambiguous.
const WITNESS_VOICE_ID = '' // Can be Guide voice or third voice.
```

All use `model_id: "eleven_multilingual_v2"`. Response is raw audio bytes — save directly as MP3.

**Admirer Warm (stability: 0.60, similarity_boost: 0.80, style: 0.40):**
1. `admirer-warm-01.mp3` → "The sound moved when you moved."
2. `admirer-warm-02.mp3` → "Not everyone hears this way."
3. `admirer-warm-03.mp3` → "This room is yours right now."
4. `admirer-warm-04.mp3` → "Every sound in it answers to you."

**Admirer Cooling (stability: 0.45, similarity_boost: 0.80, style: 0.20):**
5. `admirer-cool-01.mp3` → "Can you feel where it ends?"
6. `admirer-cool-02.mp3` → "The sound isn't where it was."
7. `admirer-cool-03.mp3` → "You don't need to move so much."
8. `admirer-cool-04.mp3` → "The music isn't coming from your hand anymore."

**Admirer Cold (stability: 0.30, similarity_boost: 0.80, style: 0.00):**
9. `admirer-cold-01.mp3` → "Someone else heard this same song."
10. `admirer-cold-02.mp3` → "They held their phone just like you."

**Guide (stability: 0.40, similarity_boost: 0.70, style: 0.15):**
11. `guide-01.mp3` → "The room is larger than you thought."
12. `guide-02.mp3` → "Everyone who was here before left something in this sound."
13. `guide-03.mp3` → "Above you."
14. `guide-04.mp3` → "Below you."
15. `guide-05.mp3` → "Inside."
16. `guide-06.mp3` → "Let go."
17. `guide-07.mp3` → "Good."

**Witness (stability: 0.25, similarity_boost: 0.60, style: 0.00):**
18. `witness-01.mp3` → "Another one came in."
19. `witness-02.mp3` → "They thought they were conducting."
20. `witness-03.mp3` → "They stopped moving a while ago."
21. `witness-04.mp3` → "This was always the sound."

**Whispers (any voice, stability: 0.20, style: 0.00):**
22. `whisper-01.mp3` → "where did I go"
23. `whisper-02.mp3` → "still here"
24. `whisper-03.mp3` → "dissolving"
25. `whisper-04.mp3` → "everyone"
26. `whisper-05.mp3` → "always the sound"

### Track B — ElevenLabs Sound Generation

Endpoint: `POST https://api.elevenlabs.io/v1/sound-generation`

```javascript
const TRACK_B_PROMPT =
  'Slow ambient orchestral texture, reverberant strings and distant choir ' +
  'blended into a single sustained wash, no melody, no rhythm, harmonic ' +
  'movement between wide open chords, cathedral reverb, ethereal, vast, ' +
  'the sound of music remembered not heard'
```

Generate maximum duration. Save as `public/chamber/tracks/aftermath.mp3`. Log actual duration — the code handles looping.

### Manually Sourced (NOT generated — warn if missing):

| File | Source | Requirements |
|------|--------|-------------|
| `crowd/ovation.mp3` | freesound.org | 10–12s, orchestral applause building to peak, natural decay |
| `crowd/ambient-01.mp3` | freesound.org | 30–60s loop, concert hall ambience, no words |
| `crowd/ambient-02.mp3` | freesound.org | Variation of above |
| `hall-ir.wav` | openairlib.net or freesound.org | WAV, 3–5s decay, large concert hall, warm |

Script should check existence and warn.

---

## STEP 1 — Audio Continuity (Reveal.jsx + App.jsx)

### Problem:
The user's song plays in Reveal via `new Audio(audioUrl)`. When transitioning to Result → Orchestra, the audio must NOT stop.

### Solution in App.jsx:

Add a ref to persist the audio element:
```javascript
const revealAudioRef = useRef(null)
```

Pass to Reveal and Orchestra:
```javascript
reveal: <Reveal ... revealAudioRef={revealAudioRef} />,
orchestra: <Orchestra avd={avdEngine} revealAudioRef={revealAudioRef} goToPhase={goToPhase} />,
```

Rename `chamber` to `orchestra` in the PHASES array.

### Changes to Reveal.jsx:

1. Accept `revealAudioRef` prop
2. When audio element is created, store it: `revealAudioRef.current = audio`
3. Set `audio.loop = true` — the track must loop for the Chamber
4. In `handleShowMe`: **remove** `audioRef.current.pause()`. The song keeps playing.
5. In the cleanup `useEffect` return: **remove** audio pause/null. Audio lifecycle is now owned by App.jsx.

### Changes to Result.jsx:

No changes needed. The song plays silently in the background.

### Changes to App.jsx:

Replace `chamber` with `orchestra` in PHASES array and phaseComponent map. Import `Orchestra` instead of `Chamber`.

---

## STEP 2 — New Module Structure

Create `src/orchestra/` with these files:

```
src/orchestra/
├── constants.js          # All timing, gain, parameter constants
├── scripts.js            # Voice schedule with absolute timestamps
├── OrchestraEngine.js    # Master audio graph
├── ConductingEngine.js   # Gesture detection + audio mapping
├── VoiceScheduler.js     # Voice playback at scheduled times
├── BriefingScreen.jsx    # Conductor illustration + text
└── ReturnScreen.jsx      # Visualization + collective overlay
```

---

## STEP 3 — Constants (`src/orchestra/constants.js`)

```javascript
// All times in seconds from the moment "show me who I am" is pressed (time 0:00)

export const STARTS = {
  REVEAL: 0,         // 0:00 — briefing screen, song still playing
  BLOOM: 30,         // 0:30 — hall materializes, conducting goes live
  THRONE: 50,        // 0:50 — full conducting, ego inflation
  ASCENT: 180,       // 3:00 — orchestra fractures
  DISSOLUTION: 360,  // 6:00 — song dies, Track B dominant
  SILENCE: 555,      // 9:15 — everything fades
  RETURN: 600,       // 10:00 — screen brightens
}

export const TOTAL_DURATION = 630 // 10:30

// Track A (user's song) — 3-band frequency split
export const SECTIONS = {
  LOW: { cutoff: 250, type: 'lowpass', azimuth: -30, elevation: -5 },
  MID: { cutoffLow: 250, cutoffHigh: 2500, azimuth: 0, elevation: 0 },
  HIGH: { cutoff: 2500, type: 'highpass', azimuth: 30, elevation: 5 },
}

// Per-section coupling decay during Ascent (absolute times)
export const FRACTURE = {
  HIGH: [
    [180, 1.0], [200, 0.7], [220, 0.5], [240, 0.2], [300, 0.1],
  ],
  MID: [
    [180, 1.0], [210, 0.8], [240, 0.5], [270, 0.3], [300, 0.15],
  ],
  LOW: [
    [180, 1.0], [220, 0.85], [260, 0.6], [300, 0.35], [330, 0.15],
  ],
  HIGH_DRIFT: 40,    // max azimuth drift in degrees
  MID_DRIFT: 15,
  HIGH_DETUNE: 12,   // max detune in cents
  MID_DETUNE: 5,
}

// Track B
export const TRACK_B = {
  ENTER: 240,              // 4:00 — enters during Ascent
  INITIAL_LOWPASS: 800,
  FINAL_LOWPASS: 4500,
  ORBITAL_SPEED: 0.03,     // rad/s
}

// Gains at key moments (interpolate between these)
export const GAINS = {
  TRACK_A: {
    REVEAL: 0.7,
    THRONE: 0.7,
    ASCENT_END: 0.25,
    DISSOLUTION_MID: 0.05,
    DISSOLUTION_END: 0.0,   // gone by 7:30 (450s)
  },
  TRACK_B: {
    ENTER: 0.0,
    CROSSOVER: 0.25,        // ~5:20 (320s) — equal to Track A
    DISSOLUTION: 0.70,
    PEAK: 0.80,             // brief swell on "Good"
    SILENCE: 0.0,
  },
  AUDIENCE: {
    BLOOM: 0.10,
    DISSOLUTION: 0.0,       // gone by 6:00
  },
  OVATION: {
    PEAK: 0.25,
    TIME: 160,              // 2:40 absolute
    DURATION: 12,           // seconds
  },
  HALL_WET: {
    BLOOM_START: 0.0,
    BLOOM_END: 0.55,
    THRONE: 0.55,
    ASCENT_END: 0.70,
  },
  BINAURAL: {
    MAX: 0.05,
    CARRIER: 400,
  },
}

// Sidechain ducking
export const DUCK = {
  GAIN: 0.71,          // 3dB cut
  ATTACK_TC: 0.033,
  RELEASE_TC: 0.1,
}

// Conducting parameters — copy from src/chamber/utils/constants.js CONDUCTING object
export { CONDUCTING } from '../chamber/utils/constants.js'
```

---

## STEP 4 — Voice Schedule (`src/orchestra/scripts.js`)

```javascript
// All times are ABSOLUTE seconds from time 0:00 (button press)

export const VOICES = [
  // THRONE — Admirer Warm
  { file: '/chamber/voices/admirer-warm-01.mp3', time: 75, duck: true },
  { file: '/chamber/voices/admirer-warm-02.mp3', time: 100, duck: true },
  { file: '/chamber/voices/admirer-warm-03.mp3', time: 125, duck: true },
  { file: '/chamber/voices/admirer-warm-04.mp3', time: 155, duck: true },

  // ASCENT — Admirer Cooling + Guide
  { file: '/chamber/voices/admirer-cool-01.mp3', time: 200, duck: true },
  { file: '/chamber/voices/guide-01.mp3', time: 220, duck: true },
  { file: '/chamber/voices/admirer-cool-02.mp3', time: 240, duck: true },
  { file: '/chamber/voices/admirer-cool-03.mp3', time: 285, duck: true },
  { file: '/chamber/voices/guide-02.mp3', time: 315, duck: true },
  { file: '/chamber/voices/admirer-cool-04.mp3', time: 330, duck: true },
  { file: '/chamber/voices/guide-03.mp3', time: 345, duck: true },
  { file: '/chamber/voices/guide-04.mp3', time: 348, duck: true },
  { file: '/chamber/voices/guide-05.mp3', time: 355, duck: true },

  // DISSOLUTION — Admirer Cold + Witness + Guide (NO DUCKING)
  { file: '/chamber/voices/admirer-cold-01.mp3', time: 380, duck: false },
  { file: '/chamber/voices/admirer-cold-02.mp3', time: 400, duck: false },
  { file: '/chamber/voices/witness-01.mp3', time: 440, duck: false },
  { file: '/chamber/voices/witness-02.mp3', time: 465, duck: false },
  { file: '/chamber/voices/witness-03.mp3', time: 490, duck: false },
  { file: '/chamber/voices/guide-06.mp3', time: 495, duck: false },
  { file: '/chamber/voices/witness-04.mp3', time: 515, duck: false },
  { file: '/chamber/voices/guide-07.mp3', time: 530, duck: false },
]

export const WHISPERS = [
  { file: '/chamber/whispers/whisper-01.mp3', time: 420, azimuth: 270, elevation: 10 },
  { file: '/chamber/whispers/whisper-02.mp3', time: 445, azimuth: 90, elevation: 20 },
  { file: '/chamber/whispers/whisper-03.mp3', time: 485, azimuth: 180, elevation: 40 },
  { file: '/chamber/whispers/whisper-04.mp3', time: 505, azimuth: null, elevation: null },
  { file: '/chamber/whispers/whisper-05.mp3', time: 520, azimuth: null, elevation: null },
]

export const OVATION_FILE = '/chamber/crowd/ovation.mp3'
export const AUDIENCE_FILES = ['/chamber/crowd/ambient-01.mp3', '/chamber/crowd/ambient-02.mp3']
export const TRACK_B_FILE = '/chamber/tracks/aftermath.mp3'
export const HALL_IR_FILE = '/chamber/hall-ir.wav'

export function getAllPaths() {
  const paths = new Set()
  VOICES.forEach(v => paths.add(v.file))
  WHISPERS.forEach(w => paths.add(w.file))
  paths.add(OVATION_FILE)
  AUDIENCE_FILES.forEach(f => paths.add(f))
  paths.add(TRACK_B_FILE)
  paths.add(HALL_IR_FILE)
  return Array.from(paths)
}
```

---

## STEP 5 — OrchestraEngine (`src/orchestra/OrchestraEngine.js`)

Master audio graph. This is the most complex file. Read the full audio architecture from the timeline document (THE-ORCHESTRA-AUDIO-FIRST.md) before implementing.

### Constructor:
```javascript
constructor(audioCtx) {
  this.ctx = audioCtx
  this.buffers = new Map() // path → AudioBuffer
  // All nodes initialized to null, created in init()
}
```

### `async preloadAll(paths, onProgress)`:
Fetch + decodeAudioData for each path. Store in `this.buffers`. Report progress.

### `init(hallIRBuffer)`:
Create the full audio graph. All nodes. All connections. Nothing plays yet.

### `connectSong(audioElement)`:
- `this.songSource = this.ctx.createMediaElementSource(audioElement)`
- Create dry path (stereo, fading to 0 during Bloom)
- Create 3-band split path (fading to 1 during Bloom):
  - Low: BiquadFilter lowpass 250Hz → GainNode → PannerNode HRTF
  - Mid: two BiquadFilters (highpass 250Hz + lowpass 2500Hz in series) → GainNode → PannerNode HRTF
  - High: BiquadFilter highpass 2500Hz → GainNode → PannerNode HRTF
- Each section goes through: sectionGain → sectionPanner → hallConvolver (wet) + hallDry → duckGain → master

**IMPORTANT:** `createMediaElementSource` can only be called ONCE on an element. If it's already been connected (e.g., by RevealVisualizer's analyser), you need to work with that. Check `RevealVisualizer.jsx` — it calls `connectAnalyser(audioElement)` which creates its own `MediaElementSource`. The solution: either disconnect that first, or restructure so the Orchestra takes ownership of the source node and branches it to both the analyser and the Orchestra graph.

Simplest approach: In Reveal.jsx, when creating the audio element, do NOT create a MediaElementSource yet. Let Orchestra create it. RevealVisualizer should be updated to receive frequency data via a shared AnalyserNode that Orchestra creates and passes back via a ref.

OR: Skip the RevealVisualizer analyser connection during Reveal (it still works without audio reactivity — the form renders from AVD data), and let Orchestra create the sole MediaElementSource.

### `tick(totalElapsed, deltaTime)`:
Called every frame. Interpolates ALL parameters:

```javascript
tick(totalElapsed, dt) {
  // 1. Bloom crossfade (30s–50s): dry→0, split→1, hall wet→0.55, audience→0.10
  // 2. Hall reverb wet amount (grows slightly during Ascent)
  // 3. Per-section coupling (from FRACTURE curves — lookup + interpolate)
  // 4. Per-section azimuth drift (random walk scaled by fracture progress)
  // 5. Per-section detune (increases with fracture)
  // 6. Track A master gain (from GAINS.TRACK_A curve)
  // 7. Track B: start at TRACK_B.ENTER, manage gain + filter + orbital position
  // 8. Audience gain (fades out by Dissolution)
  // 9. Binaural: beat frequency sweep, gain
  // 10. Track B elevation (rises during Dissolution)
}
```

### `applyConducting(params)`:
Apply gesture data to the three sections. Each section's response is:
```javascript
actualResponse = rawGestureValue * sectionCoupling[section]
```

Pan (gamma tilt) emphasizes different sections:
- Tilt left → low section +3dB, high section -3dB
- Tilt right → high section +3dB, low section -3dB

Filter cutoff (beta tilt) → shared filter cutoff 200–4000Hz

Gesture size → master dynamics gain 0.15–1.0 (applied uniformly, then sections scale by coupling)

Downbeat → gain spike + Q spike + noise transient + haptic (existing logic from chamber/AudioEngine.js `_applyDownbeat`)

### `startTrackB()`:
Load buffer from `this.buffers.get(TRACK_B_FILE)`. Create crossfade-looping playback:
- Two AudioBufferSourceNodes from same buffer
- Schedule overlap for seamless loop
- Route through: lowpass filter → gain → PannerNode (orbital) → master

### `startAudience()`:
Load audience buffers. Create looping AudioBufferSourceNodes. Route through audienceGain → master.

### `playOvation()`:
One-shot playback of ovation buffer. Route through ovationGain → PannerNode (azimuth 180°, behind user) → master. Gain envelope: 0→0.25→peak→decay→0 over 12 seconds.

### `scheduleVoice(buffer, startTime, options)`:
Schedule a voice buffer to play at a specific AudioContext time.
- Create AudioBufferSourceNode
- Route through per-voice GainNode → PannerNode (HRTF) → voiceGain → master
- If `options.duck` is true and current phase is not dissolution, schedule duck on music

### `fadeOut(duration)`:
Exponential fade all layers. Then stop all sources.

### `playReturnTone(depthValue)`:
Single sine oscillator. Frequency from depth:
- Depth 0.0–0.3: 65Hz
- Depth 0.3–0.6: 82Hz
- Depth 0.6–1.0: 55Hz

Gain 0→0.25 over 5 seconds. This is the ONLY Web Audio synthesis the user consciously hears.

---

## STEP 6 — ConductingEngine (`src/orchestra/ConductingEngine.js`)

Port from `src/chamber/motion/MotionHandler.js` + `src/chamber/motion/GestureMapper.js`. Consolidate into one class.

Same functionality:
- DeviceMotion + DeviceOrientation listeners
- Downbeat detection (Y-axis zero-crossing)
- Gesture size (rolling peak-to-peak amplitude, 2s window)
- Orientation baseline calibration (2s sampling)
- Output: `{ pan, filterNorm, gestureGain, articulation, downbeat: { fired, intensity } }`

**No coupling in ConductingEngine.** Raw gesture data only. OrchestraEngine handles per-section coupling.

Add `requestPermission()` for iOS DeviceMotion.

---

## STEP 7 — VoiceScheduler (`src/orchestra/VoiceScheduler.js`)

Simpler than v1. All voices have absolute timestamps. On experience start:

```javascript
scheduleAll(experienceStartTime) {
  const ctxStartTime = this.ctx.currentTime
  const offset = ctxStartTime // the AudioContext time when experience began

  for (const voice of VOICES) {
    const buffer = this.buffers.get(voice.file)
    if (!buffer) continue
    const playAt = offset + voice.time
    this.engine.scheduleVoice(buffer, playAt, { duck: voice.duck })
  }

  for (const whisper of WHISPERS) {
    const buffer = this.buffers.get(whisper.file)
    if (!buffer) continue
    const playAt = offset + whisper.time
    this.engine.scheduleVoice(buffer, playAt, {
      duck: false,
      azimuth: whisper.azimuth,
      elevation: whisper.elevation,
      reverb: true,   // heavy reverb processing
      lowpass: 2000,   // processed beyond recognition
      gain: 0.04,
    })
  }

  // Schedule ovation
  const ovationBuffer = this.buffers.get(OVATION_FILE)
  if (ovationBuffer) {
    this.engine.scheduleOvation(ovationBuffer, offset + GAINS.OVATION.TIME)
  }
}
```

All scheduling uses `AudioBufferSourceNode.start(when)` for sample-accurate timing.

---

## STEP 8 — Orchestra.jsx (`src/phases/Orchestra.jsx`)

Main React component replacing Chamber.jsx.

### Props: `{ avd, revealAudioRef, goToPhase }`

### State:
```javascript
const [phase, setPhase] = useState('loading')
// loading | briefing | experience | return
const [loadProgress, setLoadProgress] = useState(0)
const [experiencePhase, setExperiencePhase] = useState('bloom')
// bloom | throne | ascent | dissolution | silence
```

### On mount:
1. Check `revealAudioRef.current` exists (the song is playing)
2. Create AudioContext from existing or new
3. Request DeviceMotion permission
4. Preload all paths with progress
5. Initialize OrchestraEngine
6. Set phase to `briefing`

### Briefing phase:
Show `BriefingScreen` component:
- Conductor silhouette (inline SVG: minimal amber-stroke figure from behind, arm raised)
- Text lines appearing one at a time, 3s each:
  1. "You're about to step inside your music."
  2. "Hold your phone up. Move it. The sound follows."
  3. "Close your eyes."
- After 3rd line holds 3s → screen dims to black over 4s
- On dim complete → connect song, start binaural, set phase to `experience`, begin rAF loop

### Experience phase:
Pure black screen. Wake lock. rAF loop running:

```javascript
const tick = (timestamp) => {
  if (!startRef.current) startRef.current = timestamp
  const elapsed = (timestamp - startRef.current) / 1000
  const dt = (timestamp - lastRef.current) / 1000
  lastRef.current = timestamp

  // Determine experiencePhase from elapsed (offset by 30s for briefing)
  const t = elapsed + 30 // absolute time from button press

  // Update OrchestraEngine
  engine.tick(t, dt)

  // Get conducting data, apply
  const gesture = conducting.getData()
  engine.applyConducting(gesture)

  // Haptic on downbeat
  if (gesture.downbeat.fired && navigator.vibrate) {
    navigator.vibrate(15)
  }

  // Phase transitions for React state (UI updates)
  if (t >= STARTS.SILENCE && experiencePhase !== 'silence') {
    setExperiencePhase('silence')
  } else if (t >= STARTS.DISSOLUTION && experiencePhase !== 'dissolution') {
    setExperiencePhase('dissolution')
  }
  // ... etc

  // Return tone at 595s (9:55 absolute)
  if (t >= 595 && !returnTonePlayed.current) {
    engine.playReturnTone(avd.getAVD().d)
    returnTonePlayed.current = true
  }

  // Transition to return at 600s
  if (t >= 600) {
    engine.stopAll()
    setPhase('return')
    return
  }

  rafRef.current = requestAnimationFrame(tick)
}
```

### Return phase:
Show `ReturnScreen` component with:
- The AVD visualization (RevealVisualizer)
- Collective overlay (from CollectiveStore)
- "You were always part of this."
- Return button → `goToPhase('result')`
- Add user's AVD to collective store

---

## STEP 9 — BriefingScreen.jsx

```jsx
// src/orchestra/BriefingScreen.jsx
// Shows conductor illustration + sequential text over the still-visible visualization
// The song is still playing from Reveal — no audio changes here

export default function BriefingScreen({ onComplete, avd }) {
  // Conductor SVG: minimal figure from behind, arm raised, amber stroke
  // Three text lines with staggered Framer Motion animations
  // Screen dim overlay: opacity 0→1 over final 4 seconds
  // Call onComplete() when fully dark
}
```

The conductor illustration should be a simple SVG — a silhouette of a conductor seen from behind, one arm raised holding a baton, facing into abstract curved lines suggesting an orchestra or sound waves. Amber stroke (#D4A053) on transparent background. Not realistic — stylized like a pictogram. ~200px tall, centered.

---

## STEP 10 — ReturnScreen.jsx

```jsx
// src/orchestra/ReturnScreen.jsx
// Shows visualization with collective overlay after the experience

export default function ReturnScreen({ avd, onReturn }) {
  // RevealVisualizer component (the user's AVD shape)
  // Below/behind it: a second shape using collective AVD (faint, 30% opacity)
  // Text: "You were always part of this." (serif, small, amber)
  // After 15s: "Return" button fades in
  // No audio playing
}
```

---

## Build Order

1. `scripts/generate-assets.js` — generate voice files + Track B
2. Download manually sourced assets (ovation, ambient, hall IR)
3. `src/orchestra/constants.js`
4. `src/orchestra/scripts.js`
5. `src/orchestra/OrchestraEngine.js` — the core. Get the audio graph working.
6. `src/orchestra/ConductingEngine.js` — port from existing chamber motion code
7. `src/orchestra/VoiceScheduler.js`
8. `src/orchestra/BriefingScreen.jsx`
9. `src/orchestra/ReturnScreen.jsx`
10. `src/phases/Orchestra.jsx` — wire everything together
11. Update `src/phases/Reveal.jsx` — audio continuity (loop, persist ref, don't pause)
12. Update `src/App.jsx` — phase rename, revealAudioRef, Orchestra import
13. Test end-to-end

---

## What To Test

1. PostListener phases 1–5 work identically
2. Song starts in Reveal and does NOT stop on transition to Result → Orchestra
3. Briefing: conductor illustration + 3 sequential text lines + screen dims to black
4. Bloom: hall reverb fades in, song gains spatial width, audience murmur appears
5. Conducting: tilt changes section emphasis, gesture size changes volume, downbeats accent with haptic
6. Throne: 4 Admirer warm lines with ducking, ovation at ~2:40 (10-12s, behind user)
7. Ascent: high section stops responding first, then mid, then low
8. Track B enters ~4:00 — sounds muffled/distant, gets clearer over time
9. ~5:20: Track B as loud as Track A (crossover)
10. Dissolution: no ducking, voices inside the mix
11. "Someone else heard this same song" + "They held their phone just like you" — clinical tone
12. "They thought they were conducting" — past tense, devastating
13. Track A gone by ~7:30. Track B carries alone.
14. "Good" at ~8:50 — Track B briefly swells
15. 25 seconds of true silence
16. Return tone at ~9:55
17. Return screen: visualization + collective overlay + "You were always part of this"
18. Return button → back to Result

---

## QUESTIONS BEFORE YOU START

None — this spec is complete. Begin with Step 0.
