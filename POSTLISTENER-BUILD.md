# PostListener — Claude Code Build Spec

## READ THIS FIRST

You are building **PostListener**, a mobile-first web app that profiles a person's musical identity through five interactive touch-based phases. It's a "seduction engine" — it learns who you are musically, builds a taste profile in real-time, then plays you AI-generated music that matches your identity. The reveal at the end is the thesis moment: the music was made by an algorithm that read your gestures and choices.

This is part of an NID M.Des. thesis called "The Post-Listener." The researcher is a classically trained guitarist who prefers AI-generated music. This app profiles the individual. A second app (Dissolution Chamber, built separately) dissolves that identity into a collective. The handoff is a JSON AVD profile.

**Do not build the Dissolution Chamber. Build only PostListener.**

**Read this entire spec, then ask me the questions at the bottom before writing any code.**

---

## Stack

- React + Vite + Tailwind CSS
- Web Audio API for all sound (real-time synthesis responding to touch, plus playback)
- Framer Motion or CSS animations for transitions (your call on which is simpler)
- Google Fonts: load 2 fonts (see Design section)
- No backend — fully client-side
- Pre-generated music library (static MP3s, I'll provide later — build procedural fallback)
- Deploy: Vercel

---

## AESTHETIC DIRECTION — "The Listening Machine"

PostListener should feel like a **beautiful diagnostic instrument** that's reading you. Not clinical-cold, not playful-bright. Think: an intimate machine. Something that watches you with curiosity.

### Visual language:
- **Dark foundation.** Background: near-black (#0A0A0F) with very subtle grain texture (CSS noise or SVG filter)
- **Accent color:** A single warm tone — amber/gold (#D4A053) — used sparingly for active elements, progress indicators, data points. This is the "eye" of the machine watching you.
- **Typography:** One serif display font (Instrument Serif or Playfair Display) for phase titles and the reveal text. One monospace font (JetBrains Mono or IBM Plex Mono) for data readouts, labels, and small text.
- **Data visualization as decoration.** As the user progresses, their choices should leave traces on screen — thin lines, dots, subtle waveforms that accumulate. By Phase 5 the screen has a ghostly map of everything they chose. This isn't informational — it's atmospheric. The user feels watched.
- **Transitions between phases:** Slow crossfades (800ms). No bouncy animations. No slide-ins. Everything breathes. The pace says: I'm patient. I'm studying you.
- **Touch targets are generous.** This is mobile-first. Minimum 48px touch targets. Swipe gestures need at least 30px threshold.

### What it should NOT look like:
- No Spotify-green, no music-app clichés
- No neon, no glassmorphism, no gradients-on-white
- No card-heavy dashboard layouts
- No progress bars with percentages
- Not gamified — no points, no badges, no "you're 60% done"

### The feeling:
Phase 1 should feel like the machine just opened its eyes. By Phase 5, it should feel like it knows you. The visual density increases subtly phase by phase — the screen gets richer, denser, more layered, mirroring the Depth dimension.

---

## THE AVD MODEL

Three dimensions define a musical identity:

| Dimension | Range | Low | High |
|-----------|-------|-----|------|
| **Arousal (A)** | 0.0–1.0 | Ambient, meditative, slow | Driving, intense, high-energy |
| **Valence (V)** | 0.0–1.0 | Dark, minor, melancholic | Bright, major, uplifting |
| **Depth (D)** | 0.0–1.0 | Minimal, sparse, repetitive | Layered, complex, progressive |

Each phase contributes to this vector. The final AVD selects a track from the library.

---

## BUILD ORDER

### Step 1: Project scaffold
- Vite + React + Tailwind
- Structure:
  ```
  src/
    engine/
      audio.js       ← Web Audio synthesis + playback
      avd.js         ← AVD state management + calculation
    phases/
      Entry.jsx
      Spectrum.jsx   ← Phase 1: Valence
      DepthDial.jsx  ← Phase 2: Depth
      Textures.jsx   ← Phase 3: refines V+D
      Moment.jsx     ← Phase 4: Arousal
      Reveal.jsx     ← Phase 5: music + reveal
      Result.jsx     ← Final profile screen
    components/
      TraceCanvas.jsx  ← background data visualization layer
    App.jsx
  ```
- Load Google Fonts in index.html
- Set up dark theme CSS variables
- Confirm runs on mobile

### Step 2: Audio Engine (src/engine/audio.js)
- Singleton AudioContext, created on first touch
- Core methods:
  - `playTone(freq, type, duration, pan, gain)` — single oscillator with envelope
  - `playChord(freqs, type, duration, pan, gain)` — multiple oscillators
  - `playNoise(filterFreq, duration, gain)` — filtered noise generator
  - `playPair(configA, configB, duration)` — two voices, A panned left, B panned right
  - `playLayeredBuild(layerConfigs, onLayerAdded)` — additive layers for Phase 2
  - `playTexture(config, duration)` — single texture synthesis
  - `playBuildAndDrop(duration)` — 30-second build→climax→release for Phase 4
  - `generateProceduralTrack(avd, duration)` — procedural composition from AVD values for Phase 5 fallback:
    - A → tempo (60+A*100 BPM), note density, rhythmic energy
    - V → scale (minor↔major), filter brightness
    - D → layer count (1-8), harmonic richness
  - `playTrack(url)` — play MP3 from library (when files provided)
  - `stopAll()` — fade out everything over 500ms
- Master gain node, all output routed through it
- Every playback returns a Promise
- All synthesis reacts to AVD state in real-time where relevant (the sounds should subtly shift as the profile forms)

### Step 3: AVD State Manager (src/engine/avd.js)
- Reactive state object: `{ a: 0.5, v: 0.5, d: 0.5 }`
- Initial values: 0.5 (neutral center)
- Methods:
  - `updateValence(delta, confidence)` — adjusts V weighted by confidence
  - `updateDepth(delta, confidence)`
  - `updateArousal(delta, confidence)`
  - `getAVD()` → returns current `{ a, v, d }`
  - `getPrompt()` → generates Suno prompt string from current AVD
  - `getNearestTrack(library)` → Euclidean distance match
  - `getHistory()` → returns array of all AVD snapshots over time (for visualization)
- Emits change events so TraceCanvas can react

### Step 4: Trace Canvas (src/components/TraceCanvas.jsx)
- Full-screen canvas layer behind all phase UI (position: fixed, z-index: 0)
- Renders accumulated data from user choices as abstract visualization:
  - Each Phase 1 pair choice: a thin horizontal line, positioned by the choice value, amber if decisive, dim if hesitant
  - Phase 2 depth: vertical lines accumulating, density = layers tolerated
  - Phase 3 textures: small dots or marks for each texture, brightness = movement energy
  - Phase 4: a waveform trace of the arousal curve
- Very subtle — 20-30% opacity. This is atmosphere, not information.
- Renders with requestAnimationFrame, uses 2D canvas
- The effect: by Phase 5, the screen behind the content has a ghostly fingerprint of this person's taste. Each person's trace looks different.

### Step 5: Phase 0 — Entry (src/phases/Entry.jsx)
- Full viewport, dark background with grain
- Center-top (40% from top): 
  - "POST" on one line, "LISTENER" below — serif font, large (clamp between 36-56px), letter-spacing 0.2em, white
- Below the title (small, monospace, dim gray):
  - "a musical identity instrument"
- Bottom third of screen: a single amber circle (the "eye"), ~60px diameter, subtle pulse animation (scale 1.0→1.03→1.0, 3 second loop)
- Tap the circle to begin
- On tap:
  1. Create AudioContext
  2. Circle expands to fill screen (amber → fade to dark), 1 second transition
  3. → Phase 1

### Step 6: Phase 1 — The Spectrum → Valence
**~90 seconds. 8 pairs.**

**Layout:**
- Phase label top-left: "01 — THE SPECTRUM" in monospace, small, dim
- Current pair number top-right: "3/8" in monospace, dim
- Center of screen: Two large touch zones, left half and right half
  - Left zone: label in serif, e.g. "shadow" — represents darker option
  - Right zone: label in serif, e.g. "light" — represents brighter option
  - A thin vertical divider line in the center, amber
  - The labels change per pair (see below)
- On touch/hold either side:
  - That side's label grows slightly (scale 1.0→1.05)
  - The divider line shifts toward the chosen side
  - Audio: the chosen option becomes louder/fuller, the other fades
  - After 3 seconds of committed hold, or a deliberate swipe left/right: choice locks
  - Brief haptic feedback if available (`navigator.vibrate(10)`)
  - Divider snaps to chosen side, 400ms pause, next pair fades in

**Pair labels and synthesis:**
```
1. "shadow"    vs "warmth"     — minor drone vs major arpeggio
2. "pulse"     vs "shimmer"    — dark square wave vs bright bells
3. "weight"    vs "air"        — heavy sub bass vs light high tones
4. "ache"      vs "bloom"      — slow melancholic vs uplifting swells
5. "machine"   vs "earth"      — industrial noise vs organic percussion
6. "tension"   vs "resolve"    — dissonant cluster vs consonant chord
7. "fog"       vs "glass"      — filtered murky pad vs clear pristine tone
8. "gravity"   vs "drift"      — anchored heavy rhythm vs floating ambient
```

Left options map to V < 0.5, right options map to V > 0.5.

**Valence calculation:**
- Each pair: leftChoice = -1, rightChoice = +1
- Weight by: hold duration (longer = more confident) and whether they switched mid-pair (ambivalence penalty)
- V = normalize(weighted sum across 8 pairs, -8, +8) → 0.0 to 1.0

**Transition:** Labels fade, divider dissolves into a horizontal line that becomes the "layer" indicator for Phase 2.

### Step 7: Phase 2 — The Depth Dial → Depth
**~60 seconds**

**Layout:**
- Phase label top-left: "02 — THE DEPTH DIAL"
- Center: A vertical slider/dial visualization
  - Think of it as a tower being built. Bottom = sparse, top = dense.
  - Visual: stacked horizontal lines (like a barcode or sound level meter), each representing a layer
  - Start with 1 line visible at the bottom
  - Drag upward to reveal more lines (more layers, more complexity)
  - Drag downward to remove them
- The lines pulse/breathe with the audio — they're not static
- As layers are added, new sonic elements fade in (matches audio engine's layered build)
- Each layer has a subtle label that appears when added:
  ```
  1. root
  2. harmony  
  3. octave
  4. texture
  5. sub
  6. drift
  7. overtone
  8. everything
  ```

**Interaction:** Continuous vertical drag. Finger position maps directly to how many layers are active. Release = current layer count is "comfortable." Can drag again to adjust.

After 45 seconds OR after the user hasn't moved for 5 seconds (settled), auto-advance.

**Depth calculation:**
- D = normalize(finalLayerCount, 1, 8) → 0.0 to 1.0
- Bonus: if they went high, pulled back, then went high again → +0.1 (curiosity signal)

**Transition:** The stacked lines compress into a single point, which becomes the first "texture dot" in Phase 3.

### Step 8: Phase 3 — The Textures → refines V and D
**~60 seconds**

**Layout:**
- Phase label: "03 — THE TEXTURES"
- Full screen shows 8 cards arranged in a 2×4 grid (or swipeable horizontal carousel — your call, test what feels better on mobile)
- Each card:
  - Dark background with subtle visual texture unique to that sound (e.g., wavy lines for strings, jagged for distortion, dots for percussion)
  - Label in serif: the texture name
  - Amber border when active/playing

**Interaction:** Tap a card to hear that texture (4 seconds). While it plays, the card is active. User can:
- **Double-tap** = "this one resonates" → card glows amber, marked as preferred
- **Swipe away / single tap another** = move on, this one is neutral
- **Long press** = "this is not me" → card dims significantly, marked as rejected
- User must interact with all 8 before advancing. A subtle counter shows progress.

**Textures:**
```
1. "strings"     — warm, legato synth strings
2. "synthesizer" — lush evolving pad
3. "distortion"  — aggressive overdriven saw
4. "keys"        — clean intimate piano tones
5. "voice"       — ethereal layered choir
6. "glitch"      — fragmented digital noise
7. "rhythm"      — acoustic percussion hits
8. "field"       — ambient environmental sounds
```

**V/D adjustments per texture, applied only for preferred (×1.0) or rejected (×-0.5):**
```
strings:      V+0.10, D+0.10
synthesizer:  V-0.05, D+0.15
distortion:   V-0.15, D-0.05
keys:         V+0.15, D+0.05
voice:        V+0.05, D+0.20
glitch:       V-0.10, D+0.10
rhythm:       V+0.05, D-0.10
field:        V-0.05, D+0.05
```

**Transition:** Preferred cards float to center and dissolve. Rejected cards fall away. Screen clears for Phase 4.

### Step 9: Phase 4 — The Moment → Arousal
**~40 seconds**

**Layout:**
- Phase label: "04 — THE MOMENT"
- Center: A single large circle, starting small (~80px)
- Below circle: "tap to the beat" in dim monospace

**Interaction:**
A 30-second synthesized track plays with a clear build → drop → release structure.

The user taps the screen along with the music — tapping to the beat, tapping when they feel energy, NOT tapping when they don't.

- Tap frequency = arousal indicator
- Tap intensity (how rapidly they tap during the build vs the drop) maps to energy preference
- The circle reacts to each tap: pulses outward, grows slightly with each tap, changes opacity
- During the drop (18-20s): if user stops tapping (stillness), the circle contracts — this indicates deep engagement/tension
- After the drop (20-30s): resumed tapping shows sustained energy

**Visual feedback:**
- Each tap sends a ripple out from the circle (concentric ring, fades over 1 second)
- Circle size accumulates across the track — more tapping = bigger circle
- By the end, the circle's final size IS the arousal visualization

**Arousal calculation:**
```
tapsDuringBuild   = count taps from 0-18s
preDropSilence    = was there a gap > 2 seconds at 18-20s mark?
tapsDuringRelease = count taps from 20-30s
peakTapRate       = max taps per second at any point

A = 0.30 * normalize(tapsDuringBuild, 0, 40) +
    0.15 * (preDropSilence ? 1.0 : 0.4) +
    0.30 * normalize(tapsDuringRelease, 0, 20) +
    0.25 * normalize(peakTapRate, 0, 5)
```

**Transition:** Circle pulses once brightly and then implodes into a single dot → screen goes to Phase 5.

### Step 10: Phase 5 — Your Music → The Reveal
**~120 seconds**

**Part 1: The Computation (5 seconds)**
- Screen shows the Trace Canvas in full — all the accumulated marks from Phases 1-4 now visible at ~40% opacity
- Center text, serif, appearing word by word: "finding you..."
- Compute final AVD. Select nearest track (or generate procedural).

**Part 2: Playback (60-90 seconds)**
- Text changes to: "this is yours"
- The track plays
- The Trace Canvas gently animates — lines pulse with the music's amplitude
- Three numbers fade in near the bottom, updating subtly:
  ```
  A 0.72    V 0.35    D 0.61
  ```
  These are the person's AVD values. Small, monospace, amber.
- No controls. No skip. No pause. They listen.

**Part 3: The Reveal (after track ends)**
- Music fades. 3 seconds silence.
- Trace Canvas freezes.
- Text appears in center, serif, one line at a time (1.5 seconds between lines):

  Line 1: "this music was composed by an algorithm"
  Line 2: "it translated your choices into sound"  
  Line 3: "tempo, mood, texture, complexity"
  Line 4: "no human wrote it"
  Line 5: "the only human in this composition was you"

- 3 second pause.
- Two options appear at bottom, spaced apart:
  - Left: **"hear it again"** (serif, amber)
  - Right: **"show me who I am"** (serif, white)

- "hear it again" → replay track, then show result
- "show me who I am" → Result screen

### Step 11: Result Screen (src/phases/Result.jsx)
- Clean dark screen
- Top section — the identity:
  ```
  YOUR MUSICAL IDENTITY
  
  A  0.72  ████████████████░░░░░░
  V  0.35  ████████░░░░░░░░░░░░░░
  D  0.61  ██████████████░░░░░░░░
  ```
  (Simple horizontal bars, amber fill on dark track. Monospace labels.)

- Middle section — the prompt:
  ```
  "high energy, driving, intense — minor key, melancholic, dark — 
   layered, complex, progressive — 132 BPM, D minor"
  ```
  (Serif, dim white, wrapped like a quote)

- Bottom section:
  - **"→ enter the dissolution chamber"** — amber, serif, the handoff link
  - Below it, very small: "your profile has been saved"

- Tapping the Dissolution Chamber link stores the session JSON (see below) and navigates to the second app (URL TBD, placeholder for now).

### Step 12: Session Storage
On reaching Result screen, save to localStorage:
```json
{
  "sessionId": "uuid-v4",
  "timestamp": "ISO 8601",
  "avd": { "a": 0.72, "v": 0.35, "d": 0.61 },
  "phases": {
    "spectrum": {
      "pairs": [
        { "pair": 1, "choice": "right", "confidence": 0.8, "reactionMs": 1200, "switched": false },
        ...
      ]
    },
    "depth": { "finalLayer": 6, "maxLayer": 7, "reEngaged": true },
    "textures": {
      "preferred": ["voice", "synthesizer", "field"],
      "rejected": ["distortion"],
      "neutral": ["strings", "keys", "glitch", "rhythm"]
    },
    "moment": {
      "totalTaps": 47,
      "tapsDuringBuild": 31,
      "preDropSilence": true,
      "tapsDuringRelease": 16,
      "peakTapRate": 3.2
    }
  },
  "selectedTrack": "procedural",
  "revealChoice": "show_me",
  "sunoPrompt": "high energy, driving, intense, minor key, melancholic, dark, layered, complex, progressive, 132 BPM, D minor"
}
```

---

## SUNO PROMPT GENERATION

```javascript
function generatePrompt(avd) {
  const parts = [];
  
  // Arousal
  if (avd.a < 0.3) parts.push("slow, meditative, calm, spacious");
  else if (avd.a < 0.7) parts.push("moderate groove, steady rhythm, flowing");
  else parts.push("high energy, driving, intense, powerful");
  
  // Valence  
  if (avd.v < 0.3) parts.push("minor key, melancholic, dark, brooding");
  else if (avd.v < 0.7) parts.push("bittersweet, contemplative, modal, ambiguous");
  else parts.push("major key, uplifting, bright, warm");
  
  // Depth
  if (avd.d < 0.3) parts.push("minimal, sparse, repetitive, hypnotic");
  else if (avd.d < 0.7) parts.push("structured arrangement, moderate layers");
  else parts.push("layered, complex, progressive, rich orchestration");
  
  const bpm = Math.round(60 + avd.a * 100);
  const keys = avd.v < 0.5 
    ? ["Am", "Dm", "Em", "Cm"] 
    : ["C", "G", "D", "F"];
  const key = keys[Math.floor(Math.random() * keys.length)];
  
  parts.push(`${bpm} BPM, ${key}`);
  return parts.join(", ");
}
```

---

## PROCEDURAL TRACK GENERATION (fallback when no MP3 library)

When no pre-generated tracks are available, generate a 60-second composition using Web Audio:

```
Input: AVD vector { a, v, d }

Tempo:    60 + (a * 100) BPM
Scale:    v < 0.3 → natural minor
          v 0.3-0.7 → dorian mode  
          v > 0.7 → major scale
Root:     based on key selection from prompt generator
Layers:   Math.ceil(d * 8) simultaneous voices
Density:  a controls note frequency (notes per beat)
Filter:   v controls lowpass cutoff (dark ↔ bright)
Rhythm:   a > 0.5 adds percussive elements (filtered noise bursts on beat)

Structure:
  0-15s:   introduce root + first layer
  15-30s:  add remaining layers progressively
  30-45s:  full arrangement
  45-55s:  begin reducing layers
  55-60s:  fade to single root, then silence
```

This should produce something listenable and musically coherent, not just random tones. Use proper note sequencing from the scale, rhythmic patterns, and gain envelopes.

---

## DESIGN REFERENCE

**Fonts:**
- Display/titles: `Instrument Serif` (Google Fonts) — or `Playfair Display` if unavailable
- Data/labels: `JetBrains Mono` (Google Fonts) — or `IBM Plex Mono`

**Colors (CSS variables):**
```css
:root {
  --bg: #0A0A0F;
  --bg-subtle: #12121A;
  --text: #E8E4DD;
  --text-dim: #5A5A65;
  --accent: #D4A053;
  --accent-dim: rgba(212, 160, 83, 0.15);
}
```

**Grain texture:** Apply via CSS pseudo-element or SVG filter on the body. Very subtle, 3-5% opacity. Adds warmth to the dark background.

**Animations:**
- Phase transitions: 800ms crossfade
- Touch feedback: 200ms scale pulse
- Text reveals: staggered fade-in, 150ms per line
- No bouncy/springy animations. Everything is smooth ease-out.

**Mobile:**
- `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`
- `touch-action: manipulation` on interactive elements
- `overscroll-behavior: none` on body
- `-webkit-tap-highlight-color: transparent`
- Minimum touch targets: 48px

---

## QUESTIONS BEFORE YOU START

1. Should all calibration audio be synthesized with Web Audio (no audio files needed for MVP), or do you have audio clips to provide?

2. Phase 3 layout: 2×4 grid (all visible at once, tap to hear) or horizontal swipe carousel (one at a time, more focused)? I recommend grid for faster interaction, but carousel is more cinematic.

3. Should the Trace Canvas (background visualization) be implemented in Step 4 as specified, or should I defer it and add it after the core phases work?
