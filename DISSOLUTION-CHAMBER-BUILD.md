# DISSOLUTION-CHAMBER-BUILD.md
# Claude Code Build Specification — The Dissolution Chamber
# Read this FULLY before writing any code.

---

## Overview

The Dissolution Chamber is a 10-minute audio-only experience on a phone. Screen goes dark. The user holds the phone as a conductor's baton in a dark room with headphones. AI voices inflate their ego, then guide them into an altered state as their individual musical taste dissolves into the collective consciousness of all previous users.

This is a SEPARATE app from PostListener. It receives the user's AVD (Arousal, Valence, Depth) vector via URL parameter or localStorage. It is deployed to its own Vercel project.

---

## Tech Stack

- React + Vite (same tooling as PostListener)
- Web Audio API — RAW NODES ONLY. No Tone.js. No external audio libraries.
- ElevenLabs TTS API for voice generation
- DeviceMotionEvent + DeviceOrientationEvent for phone-as-baton
- Tailwind CSS for minimal UI (mostly a black screen)
- Vercel for deployment

---

## Project Structure

```
dissolution-chamber/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── public/
│   ├── music/           # Pre-generated AVD-matched tracks (MVP)
│   │   ├── high-arousal-low-valence.mp3
│   │   ├── high-arousal-high-valence.mp3
│   │   ├── low-arousal-low-valence.mp3
│   │   ├── low-arousal-high-valence.mp3
│   │   ├── mid-range.mp3
│   │   └── collective-seed.mp3    # The "collective" track for MVP
│   ├── whispers/        # Pre-recorded collective whisper fragments
│   │   ├── whisper-01.mp3
│   │   ├── whisper-02.mp3
│   │   └── whisper-03.mp3
│   └── silence.mp3      # 1-second silence file for AudioBuffer bootstrapping
├── src/
│   ├── main.jsx
│   ├── index.css
│   ├── App.jsx           # Top-level: reads AVD, manages phase state machine
│   ├── engine/
│   │   ├── AudioEngine.js       # Master audio graph, all 5 signal paths
│   │   ├── BinauralEngine.js    # Binaural beat generation + frequency sweeps
│   │   ├── SpatialEngine.js     # PannerNode HRTF management + orbital motion
│   │   ├── CouplingEngine.js    # Sigmoid decay algorithm
│   │   ├── CollectiveEngine.js  # Collective composition synthesis from AVD data
│   │   └── ModulationEngine.js  # Alpha-range amplitude modulation (LFO)
│   ├── motion/
│   │   ├── MotionHandler.js     # DeviceMotion/Orientation setup + permission
│   │   └── GestureMapper.js     # Raw sensor data → audio parameters
│   ├── voices/
│   │   ├── VoiceScheduler.js    # Phase-aware voice playback timing
│   │   ├── ElevenLabsAPI.js     # TTS API calls
│   │   └── scripts.js           # Voice text content per phase
│   ├── phases/
│   │   ├── PhaseManager.js      # State machine: intro→throne→ascent→dissolution→silence
│   │   └── PhaseConfig.js       # Timing, parameters per phase
│   ├── data/
│   │   ├── AVDReader.js         # Reads AVD from URL param or localStorage
│   │   └── CollectiveStore.js   # Read/write collective AVD data
│   ├── components/
│   │   ├── EntryScreen.jsx      # Pre-experience instructions + permission requests
│   │   ├── DarkScreen.jsx       # The black screen during the experience
│   │   ├── ExitScreen.jsx       # Post-experience: individual vs collective AVD
│   │   └── PermissionPrompt.jsx # iOS motion permission + audio context unlock
│   └── utils/
│       ├── math.js              # Sigmoid, lerp, clamp, RMS helpers
│       └── constants.js         # Phase durations, frequency values, etc.
```

---

## Build Order — Follow This Exactly

### Step 1: Project Scaffold + Constants

Set up Vite + React + Tailwind. Define all constants in `constants.js`:

```javascript
// Phase durations in seconds
export const PHASE_DURATIONS = {
  INTRO: 45,        // 0:00 - 0:45
  THRONE: 120,      // 0:45 - 2:45
  ASCENT: 180,      // 2:45 - 5:45
  DISSOLUTION: 210, // 5:45 - 9:15
  SILENCE: 45,      // 9:15 - 10:00
};

export const TOTAL_DURATION = 600; // 10 minutes in seconds

// Binaural beat parameters
export const BINAURAL = {
  CARRIER_FREQ: 400,         // Hz — optimal for binaural perception
  PHASE_1_BEAT: 10,          // Hz — alpha range
  PHASE_3_START_BEAT: 10,    // Hz — alpha
  PHASE_3_END_BEAT: 6,       // Hz — upper theta
  PHASE_4_BEAT: 4,           // Hz — theta (OBE-conducive, Monroe's 3.78 rounded)
  PHASE_5_END_BEAT: 2,       // Hz — delta (fade to sleep/silence)
  GAIN: 0.12,                // Subliminal — below conscious attention
};

// Alpha amplitude modulation
export const MODULATION = {
  MIN_FREQ: 8,    // Hz — lower alpha
  MAX_FREQ: 13,   // Hz — upper alpha
  MIN_DEPTH: 0.0, // No modulation (Phase 1-2)
  MAX_DEPTH: 0.7, // Strong modulation (Phase 4) — 0.3 to 1.0 gain range
};

// Coupling decay
export const COUPLING = {
  INITIAL: 1.0,
  PHASE_3_END: 0.3,    // Still slightly responsive
  PHASE_4: 0.0,        // Dead
  SIGMOID_STEEPNESS: 6, // Controls curve shape
};

// Spatial audio positions (azimuth in degrees, elevation in degrees)
export const VOICE_POSITIONS = {
  ADMIRER: { azimuth: 0, elevation: 0, distance: 1 },       // Center front
  GUIDE: { azimuth: 90, elevation: 15, distance: 1.5 },     // Orbiting
  WITNESS: { azimuth: 180, elevation: 30, distance: 2 },    // Behind and above
};

// Orbital motion for spatial sources
export const ORBITAL = {
  DRONE_SPEED: 0.02,      // Radians per frame — very slow rotation
  GUIDE_SPEED: 0.05,      // Moderate orbit
  COLLECTIVE_SPEED: 0.03, // Slow collective drift
  ELEVATION_RISE_RATE: 0.5, // Degrees per second during Phase 4
};
```

---

### Step 2: AVD Reader + Entry Screen

**AVDReader.js:**
- Check URL parameter first: `?avd=0.65,0.35,0.72` (arousal,valence,depth)
- Fall back to localStorage key: `postlistener-session` → parse JSON → extract AVD
- If neither exists, show error: "Complete PostListener first" with link back
- Return object: `{ arousal: Number, valence: Number, depth: Number }`

**EntryScreen.jsx:**
- Dark background (#050508)
- Title: "The Dissolution Chamber" in Instrument Serif (match PostListener aesthetic)
- Subtitle: "Hold your phone. Find darkness. Close your eyes."
- Instructions: "Put on headphones. Turn off the lights. Lie down if you can."
- Button: "Enter" — on tap:
  1. Request iOS DeviceMotion permission if needed
  2. Create and resume AudioContext (requires user gesture)
  3. Transition to DarkScreen

**PermissionPrompt.jsx:**
- iOS 13+ requires explicit permission for DeviceMotionEvent
- Use `DeviceMotionEvent.requestPermission()` if it exists
- If denied, fall back to touch-only mode (no motion conducting — degrade gracefully)
- AudioContext must be created/resumed on user gesture — handle this here

---

### Step 3: Phase Manager (State Machine)

**PhaseManager.js:**

```javascript
// Phase enum
export const PHASES = {
  ENTRY: 'entry',       // Pre-experience
  INTRO: 'intro',       // Phase 1
  THRONE: 'throne',     // Phase 2
  ASCENT: 'ascent',     // Phase 3
  DISSOLUTION: 'dissolution', // Phase 4
  SILENCE: 'silence',   // Phase 5
  EXIT: 'exit',         // Post-experience
};

// State machine
// - Tracks current phase, elapsed time within phase, total elapsed time
// - Exposes: currentPhase, phaseElapsed, totalElapsed, phaseProgress (0-1)
// - Auto-advances based on PHASE_DURATIONS
// - Emits phase change events that other engines subscribe to
// - Uses requestAnimationFrame for timing (not setInterval)
// - Provides normalized progress (0-1) within each phase for smooth parameter interpolation
```

All other engines subscribe to PhaseManager's phase changes and elapsed time.

---

### Step 4: Audio Engine (Master Graph)

**AudioEngine.js:**

This is the central audio system. It creates and manages all 5 signal paths.

```
Signal Flow:

Path 1 (AVD Music)      ──→ gainNode1 ──→ pannerNode1 ──┐
Path 2 (Binaural)        ──→ gainNode2 ──→ mergerNode ──┤
Path 3 (Collective)      ──→ modGain3  ──→ pannerNode3 ──┤──→ compressorNode ──→ destination
Path 4 (Voices)          ──→ gainNode4 ──→ pannerNodes ──┤
Path 5 (Isochronic/Tex)  ──→ gainNode5 ──────────────────┘
```

**Initialization sequence (called after AudioContext is created):**
1. Create DynamicsCompressorNode as master bus
2. Initialize BinauralEngine (Path 2)
3. Initialize ModulationEngine
4. Initialize SpatialEngine
5. Load AVD-matched music track into AudioBuffer (Path 1)
6. Initialize CollectiveEngine (Path 3)
7. Pre-load voice audio buffers (Path 4) — or generate via ElevenLabs
8. Pre-load whisper fragments (Path 5)
9. Connect all paths to compressor → destination

**Critical: All audio loading must happen BEFORE the experience starts.** Show a loading screen while buffers are being fetched. The experience must be seamless once it begins — no loading pauses.

---

### Step 5: Binaural Engine

**BinauralEngine.js:**

```javascript
// Creates two OscillatorNodes routed to separate stereo channels
// Left: carrier frequency (400 Hz)
// Right: carrier + beat frequency (e.g., 404 Hz for 4 Hz theta beat)

class BinauralEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.leftOsc = null;
    this.rightOsc = null;
    this.merger = null;
    this.gainNode = null;
  }

  start() {
    // Create ChannelMergerNode(2) for stereo separation
    this.merger = this.ctx.createChannelMerger(2);
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = BINAURAL.GAIN;

    // Left oscillator → channel 0
    this.leftOsc = this.ctx.createOscillator();
    this.leftOsc.type = 'sine';
    this.leftOsc.frequency.value = BINAURAL.CARRIER_FREQ;
    const leftGain = this.ctx.createGain();
    this.leftOsc.connect(leftGain);
    leftGain.connect(this.merger, 0, 0);

    // Right oscillator → channel 1
    this.rightOsc = this.ctx.createOscillator();
    this.rightOsc.type = 'sine';
    this.rightOsc.frequency.value = BINAURAL.CARRIER_FREQ + BINAURAL.PHASE_1_BEAT;
    const rightGain = this.ctx.createGain();
    this.rightOsc.connect(rightGain);
    rightGain.connect(this.merger, 0, 1);

    this.merger.connect(this.gainNode);

    this.leftOsc.start();
    this.rightOsc.start();
  }

  // Called by PhaseManager on each frame
  // beatFreq smoothly transitions based on phase
  setBeatFrequency(beatFreq) {
    const now = this.ctx.currentTime;
    this.rightOsc.frequency.setTargetAtTime(
      BINAURAL.CARRIER_FREQ + beatFreq,
      now,
      0.5 // smoothing time constant
    );
  }

  setGain(value) {
    this.gainNode.gain.setTargetAtTime(value, this.ctx.currentTime, 0.3);
  }

  stop() {
    this.leftOsc?.stop();
    this.rightOsc?.stop();
  }

  // Returns the output node to connect to master bus
  getOutput() {
    return this.gainNode;
  }
}
```

**Phase-driven beat frequency schedule:**
- Phase 1 (Intro): 10 Hz (alpha) — fades in from gain 0 to BINAURAL.GAIN
- Phase 2 (Throne): 10 Hz — holds steady, very subtle
- Phase 3 (Ascent): sweeps 10 Hz → 6 Hz (linear ramp over phase duration)
- Phase 4 (Dissolution): sweeps 6 Hz → 4 Hz, holds at 4 Hz
- Phase 5 (Silence): sweeps 4 Hz → 2 Hz, then gain fades to 0

---

### Step 6: Modulation Engine (Alpha Amplitude Modulation)

**ModulationEngine.js:**

Makes the music "breathe" at alpha frequency (8-13 Hz). This is the auditory equivalent of Gysin's flickering Dreamachine light.

```javascript
class ModulationEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.lfo = null;
    this.depthGain = null;
  }

  // targetGainNode is the GainNode controlling Path 3 (Collective)
  connect(targetGainNode) {
    // LFO oscillator
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 10; // Start at 10 Hz (mid-alpha)

    // Depth control: LFO output (-1 to 1) scaled to modulation range
    this.depthGain = this.ctx.createGain();
    this.depthGain.gain.value = 0; // Start with no modulation

    // Offset: the target gain should oscillate around 0.65 (not 0)
    // LFO → depthGain → targetGainNode.gain
    this.lfo.connect(this.depthGain);
    this.depthGain.connect(targetGainNode.gain);

    // Set the target gain's base value
    targetGainNode.gain.value = 0.65; // Center point

    this.lfo.start();
  }

  // depth: 0 (no modulation) to 0.35 (heavy breathing)
  setDepth(depth) {
    this.depthGain.gain.setTargetAtTime(depth, this.ctx.currentTime, 0.5);
  }

  setFrequency(freq) {
    this.lfo.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.3);
  }
}
```

**Phase schedule:**
- Phase 1-2: depth = 0 (no modulation — music sounds normal)
- Phase 3: depth ramps 0 → 0.2 over the phase. User may subconsciously notice the breathing.
- Phase 4: depth ramps 0.2 → 0.35. The pulsing is now perceptible. Combined with theta beats and darkness, this is the auditory flicker that induces synesthetic percepts.
- Phase 5: depth fades to 0.

---

### Step 7: Spatial Engine

**SpatialEngine.js:**

Manages PannerNodes in HRTF mode for 3D audio positioning.

```javascript
class SpatialEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.panners = new Map(); // key → PannerNode
    this.orbitAngles = new Map(); // key → current angle in radians
  }

  createPanner(key, position) {
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 10;
    panner.rolloffFactor = 1;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;

    this.setPosition(panner, position);
    this.panners.set(key, panner);
    this.orbitAngles.set(key, 0);
    return panner;
  }

  setPosition(panner, { azimuth, elevation, distance }) {
    // Convert spherical to cartesian
    const azRad = (azimuth * Math.PI) / 180;
    const elRad = (elevation * Math.PI) / 180;
    const x = distance * Math.cos(elRad) * Math.sin(azRad);
    const y = distance * Math.sin(elRad);
    const z = -distance * Math.cos(elRad) * Math.cos(azRad);

    const now = this.ctx.currentTime;
    panner.positionX.setTargetAtTime(x, now, 0.1);
    panner.positionY.setTargetAtTime(y, now, 0.1);
    panner.positionZ.setTargetAtTime(z, now, 0.1);
  }

  // Called every frame during Phase 3-4 for orbital motion
  updateOrbits(deltaTime, phase) {
    for (const [key, panner] of this.panners) {
      const speed = ORBITAL[key + '_SPEED'] || ORBITAL.DRONE_SPEED;
      let angle = this.orbitAngles.get(key) + speed * deltaTime;
      this.orbitAngles.set(key, angle);

      const baseElevation = VOICE_POSITIONS[key]?.elevation || 0;
      let elevation = baseElevation;

      // During Phase 4, elevations rise — brain interprets as listener rising
      if (phase === 'dissolution') {
        elevation += ORBITAL.ELEVATION_RISE_RATE * deltaTime;
      }

      const azimuth = (angle * 180) / Math.PI;
      const distance = VOICE_POSITIONS[key]?.distance || 1;
      this.setPosition(panner, { azimuth, elevation, distance });
    }
  }
}
```

**Spatial layout:**
- Path 1 (AVD Music): starts center, pans based on user gesture during Phase 2-3
- Path 3 (Collective): slow orbit, elevation rises in Phase 4
- Path 4 voices: each at a fixed but distinct position (see VOICE_POSITIONS constant)

---

### Step 8: Coupling Engine

**CouplingEngine.js:**

The sigmoid decay that kills the conductor's agency.

```javascript
class CouplingEngine {
  constructor() {
    this.value = COUPLING.INITIAL;
  }

  // progress: 0-1 representing how far through the decay we are
  // Decay starts at Phase 2 end, completes at Phase 4 start
  update(totalElapsed) {
    const decayStart = PHASE_DURATIONS.INTRO + PHASE_DURATIONS.THRONE; // 2:45
    const decayEnd = decayStart + PHASE_DURATIONS.ASCENT; // 5:45

    if (totalElapsed <= decayStart) {
      this.value = COUPLING.INITIAL;
    } else if (totalElapsed >= decayEnd) {
      this.value = COUPLING.PHASE_4;
    } else {
      // Sigmoid decay
      const progress = (totalElapsed - decayStart) / (decayEnd - decayStart);
      // Sigmoid: 1 / (1 + e^(steepness * (x - 0.5)))
      const sigmoid = 1 / (1 + Math.exp(COUPLING.SIGMOID_STEEPNESS * (progress - 0.5)));
      this.value = sigmoid * COUPLING.INITIAL;
    }

    return this.value;
  }

  getValue() {
    return this.value;
  }
}
```

All gesture-to-audio mappings multiply their effect by `coupling.getValue()`.

---

### Step 9: Motion Handler + Gesture Mapper

**MotionHandler.js:**

```javascript
class MotionHandler {
  constructor() {
    this.hasPermission = false;
    this.hasMotion = false;
    this.data = {
      accelX: 0, accelY: 0, accelZ: 0,
      alpha: 0, beta: 0, gamma: 0,
      rms: 0, jerk: 0,
    };
    this.prevRms = 0;
    this.listeners = [];
  }

  async requestPermission() {
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      // iOS 13+
      const permission = await DeviceMotionEvent.requestPermission();
      this.hasPermission = permission === 'granted';
    } else {
      // Android — no permission needed
      this.hasPermission = true;
    }
    return this.hasPermission;
  }

  start() {
    if (!this.hasPermission) return;

    window.addEventListener('devicemotion', (e) => {
      const a = e.accelerationIncludingGravity || {};
      this.data.accelX = a.x || 0;
      this.data.accelY = a.y || 0;
      this.data.accelZ = a.z || 0;

      const rms = Math.sqrt(
        this.data.accelX ** 2 +
        this.data.accelY ** 2 +
        this.data.accelZ ** 2
      );
      this.data.jerk = Math.abs(rms - this.prevRms);
      this.data.rms = rms;
      this.prevRms = rms;
      this.hasMotion = true;
    }, { passive: true });

    window.addEventListener('deviceorientation', (e) => {
      this.data.alpha = e.alpha || 0; // compass
      this.data.beta = e.beta || 0;   // front-back tilt (-180 to 180)
      this.data.gamma = e.gamma || 0; // left-right tilt (-90 to 90)
    }, { passive: true });
  }

  getData() {
    return this.data;
  }
}
```

**GestureMapper.js:**

```javascript
class GestureMapper {
  constructor(couplingEngine) {
    this.coupling = couplingEngine;
  }

  // Returns normalized audio parameters (all 0-1)
  map(motionData) {
    const c = this.coupling.getValue();

    // Normalize gamma: -90 to 90 → 0 to 1
    const pan = clamp((motionData.gamma + 90) / 180, 0, 1) * c;

    // Normalize beta: -180 to 180, map center region (±30°) to filter
    const filterNorm = clamp((motionData.beta + 60) / 120, 0, 1) * c;

    // RMS magnitude → intensity (gravity is ~9.8, so normalize around that)
    const intensity = clamp((motionData.rms - 5) / 15, 0, 1) * c;

    // Jerk → rhythmic articulation
    const articulation = clamp(motionData.jerk / 5, 0, 1) * c;

    return { pan, filterNorm, intensity, articulation };
  }
}
```

---

### Step 10: Collective Engine

**CollectiveEngine.js:**

Synthesizes the "merged consciousness" from collective AVD data using Web Audio API.

```javascript
class CollectiveEngine {
  constructor(audioCtx, collectiveAVD) {
    this.ctx = audioCtx;
    this.avd = collectiveAVD; // { arousal: mean, valence: mean, depth: mean }

    // Synthesize a drone/pad from collective parameters
    this.oscillators = [];
    this.filter = null;
    this.reverb = null;
    this.masterGain = null;
  }

  start() {
    // Create 3-4 detuned oscillators for a pad texture
    const baseFreq = 55 + this.avd.arousal * 55; // 55-110 Hz range
    const waveform = this.avd.valence > 0.5 ? 'sine' : 'sawtooth';

    const harmonics = [1, 1.5, 2, 2.5 + this.avd.depth];
    harmonics.forEach((h, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = waveform;
      osc.frequency.value = baseFreq * h;
      // Slight detune for richness
      osc.detune.value = (Math.random() - 0.5) * 10;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.15 / (i + 1); // Decreasing gain per harmonic

      osc.connect(gain);
      this.oscillators.push({ osc, gain });
    });

    // Filter controlled by collective valence
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 200 + this.avd.valence * 2000;
    this.filter.Q.value = 1 + this.avd.depth * 3;

    // Reverb (ConvolverNode with generated impulse response)
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.generateImpulseResponse(
      2 + this.avd.depth * 6, // decay time
      this.avd.depth * 0.5     // wet amount via mix later
    );

    // Master gain — starts at 0, fades in during Phase 3
    this.masterGain = this.ctx.createGain();
    this.masterGain.value = 0;

    // Connect: oscillators → filter → reverb → masterGain
    this.oscillators.forEach(({ gain }) => gain.connect(this.filter));
    this.filter.connect(this.reverb);
    this.reverb.connect(this.masterGain);

    // Start all oscillators
    this.oscillators.forEach(({ osc }) => osc.start());
  }

  generateImpulseResponse(duration, decay) {
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  setGain(value) {
    this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.5);
  }

  getOutput() {
    return this.masterGain;
  }
}
```

**Phase schedule for collective gain:**
- Phase 1-2: gain = 0 (silent)
- Phase 3: gain ramps 0 → 0.5 (collective bleeds in alongside individual music)
- Phase 4: gain ramps 0.5 → 0.8 (collective dominates)
- Phase 5: gain fades 0.8 → 0

---

### Step 11: Voice System

**scripts.js — Pre-written voice content:**

```javascript
export const VOICE_SCRIPTS = {
  throne: {
    admirer: [
      { text: "The music responds to you. Every movement shapes the sound.", delay: 45 },
      { text: "You hear things others miss. That's rare.", delay: 75 },
      { text: "Listen deeper. Feel this in your body.", delay: 100 },
    ],
  },
  ascent: {
    admirer: [
      { text: "You're so attuned that the room is expanding around you.", delay: 10 },
      { text: "The music is becoming part of you. Or are you becoming part of it?", delay: 50 },
    ],
    guide: [
      { text: "Imagine the music as a room. The walls are further than you thought.", delay: 90 },
      { text: "The sound is above you now. Below you. Everywhere.", delay: 130 },
      { text: "Everyone who was here before you left something in this sound.", delay: 160 },
    ],
  },
  dissolution: {
    admirer: [
      { text: "Your arousal signature. Sixty-third percentile. Your depth. Above average but not unusual.", delay: 30 },
    ],
    witness: [
      { text: "Another one entered the song.", delay: 60 },
      { text: "They don't know where they end anymore.", delay: 120 },
      { text: "This was always the sound.", delay: 170 },
    ],
  },
};
```

**Delay values are seconds from phase start.**

**ElevenLabsAPI.js:**

```javascript
class ElevenLabsAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.voices = {
      admirer: 'VOICE_ID_1',  // To be set after creating voices in ElevenLabs
      guide: 'VOICE_ID_2',
      witness: 'VOICE_ID_3',
    };
  }

  async generateSpeech(voiceKey, text) {
    const voiceId = this.voices[voiceKey];
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: voiceKey === 'witness' ? 0.3 : 0.5,
            similarity_boost: 0.8,
            style: voiceKey === 'witness' ? 0.1 : 0.3,
          },
        }),
      }
    );

    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer;
  }
}
```

**VoiceScheduler.js:**
- On experience start, pre-generate ALL voice audio for all phases via ElevenLabs
- Decode each into AudioBuffer
- Store in a map: `{ phase → voiceKey → [{buffer, delay}] }`
- On phase change, schedule upcoming voice buffers using `AudioBufferSourceNode.start(ctx.currentTime + delay)`
- Each voice routes through its own PannerNode (positioned by SpatialEngine)

**MVP fallback:** If ElevenLabs API key is not set or fails, display voice text on screen (small, dim text at bottom of black screen) as silent oracle.

---

### Step 12: Dark Screen + Exit Screen

**DarkScreen.jsx:**
- Pure black (#000000) fullscreen
- Prevents screen sleep: use `navigator.wakeLock.request('screen')` if available
- Shows NO UI during the experience except:
  - Phase 1: "Close your eyes. Hold the phone." for 3 seconds then fades
  - Phase 5 exit: screen slowly brightens from black to #050508 over 15 seconds
- If ElevenLabs voices fail, show voice text as dim text (color: rgba(255,255,255,0.15)) at bottom center

**ExitScreen.jsx:**
- Dark background matching PostListener aesthetic
- "You were always part of this."
- Shows two AVD coordinates:
  - "You: A={arousal} V={valence} D={depth}" 
  - "Everyone: A={collectiveMean.arousal} V={collectiveMean.valence} D={collectiveMean.depth}"
- Visual: simple polar/radar chart showing individual vs collective overlay
- Button: "Again" (restart) or close

---

### Step 13: App.jsx — The Main Loop

```jsx
// Simplified structure
function App() {
  const [phase, setPhase] = useState('entry');
  const avd = useAVDReader();
  const audioRef = useRef(null);
  const phaseManagerRef = useRef(null);

  const startExperience = async () => {
    // 1. Create AudioContext
    // 2. Initialize all engines
    // 3. Pre-generate voices (or load fallback)
    // 4. Load music buffers
    // 5. Start PhaseManager
    // 6. Transition to 'intro' phase
    // 7. Start requestAnimationFrame loop
  };

  // The main loop — called every frame
  const tick = (timestamp) => {
    const pm = phaseManagerRef.current;
    pm.update(timestamp);

    // Update coupling
    coupling.update(pm.totalElapsed);

    // Read motion data + map to audio params
    const motion = motionHandler.getData();
    const mapped = gestureMapper.map(motion);

    // Apply mapped params to audio (Path 1)
    audioEngine.setPathOneParams(mapped);

    // Update binaural beat frequency based on phase
    binauralEngine.setBeatFrequency(getTargetBeat(pm));

    // Update modulation depth based on phase
    modulationEngine.setDepth(getTargetModDepth(pm));

    // Update spatial orbits
    spatialEngine.updateOrbits(pm.deltaTime, pm.currentPhase);

    // Update crossfade between individual and collective
    audioEngine.setCrossfade(getCrossfadeValue(pm));

    requestAnimationFrame(tick);
  };

  if (phase === 'entry') return <EntryScreen onStart={startExperience} />;
  if (phase === 'exit') return <ExitScreen avd={avd} />;
  return <DarkScreen phase={phase} />;
}
```

---

### Step 14: Collective Data Persistence

**CollectiveStore.js:**

For MVP, use a simple JSON approach:
- On experience complete, POST the user's AVD vector to a serverless function
- Serverless function (Vercel API route) appends to a JSON file or KV store
- On experience start, GET the current collective state (mean + count)

```
/api/collective
  GET  → returns { mean: {a,v,d}, count: N }
  POST → body: {a,v,d} → appends to store, returns updated mean
```

If no backend is available for MVP, hardcode a "seed" collective AVD representing ~20 fictional previous users and just accumulate in localStorage.

---

### Step 15: Music Selection (MVP)

For MVP, pre-generate 5-6 tracks that cover the AVD space. Select the closest match to the user's AVD vector.

**Track library:**

| File | Arousal | Valence | Depth | Character |
|------|---------|---------|-------|-----------|
| high-arousal-high-valence.mp3 | 0.8 | 0.8 | 0.5 | Energetic, bright, danceable |
| high-arousal-low-valence.mp3 | 0.8 | 0.2 | 0.5 | Intense, dark, driving |
| low-arousal-high-valence.mp3 | 0.2 | 0.8 | 0.5 | Gentle, warm, peaceful |
| low-arousal-low-valence.mp3 | 0.2 | 0.2 | 0.7 | Melancholic, deep, ambient |
| mid-range.mp3 | 0.5 | 0.5 | 0.5 | Balanced, neutral |
| collective-seed.mp3 | 0.5 | 0.5 | 0.6 | The "collective" sound |

Select by minimum Euclidean distance in AVD space:
```javascript
const distance = Math.sqrt(
  (track.a - user.a) ** 2 +
  (track.v - user.v) ** 2 +
  (track.d - user.d) ** 2
);
```

Tracks should be 3+ minutes long (loop-friendly), generated via ElevenLabs or Suno.

---

## Design Tokens

Match PostListener's aesthetic for visual consistency across the two apps:

```css
/* Colors */
--bg-primary: #050508;
--bg-dark: #000000;      /* DarkScreen is pure black */
--text-primary: #e8dcc8;
--text-dim: rgba(255, 255, 255, 0.15);
--accent: #b0965a;       /* Amber — same as PostListener */

/* Typography */
--font-serif: 'Instrument Serif', serif;
--font-mono: 'JetBrains Mono', monospace;

/* The Dissolution Chamber aesthetic is DARKER than PostListener */
/* PostListener = dark with amber warmth */
/* Dissolution Chamber = near-black with minimal text */
```

---

## Testing Checklist

1. [ ] AVD reads correctly from URL param `?avd=0.65,0.35,0.72`
2. [ ] AVD reads correctly from localStorage fallback
3. [ ] Error state when no AVD is available
4. [ ] iOS motion permission prompt works
5. [ ] AudioContext unlocks on user gesture
6. [ ] Screen goes black and stays black (no sleep)
7. [ ] Phase transitions fire at correct times (use console.log)
8. [ ] Binaural beats audible through headphones (check L/R channels separately)
9. [ ] Phone tilt produces audible filter/panning changes in Phase 2
10. [ ] Coupling decay: conduct in Phase 2 (responsive) → conduct in Phase 4 (nothing happens)
11. [ ] Voices play at scheduled times with correct spatial positioning
12. [ ] Collective drone fades in during Phase 3
13. [ ] Individual music fades out during Phase 3-4
14. [ ] Silence in Phase 5 is actual silence (no residual hum)
15. [ ] Exit screen shows with AVD data
16. [ ] Full 10-minute run completes without errors on OnePlus 12

---

## Performance Targets

```
Frame rate:           60fps during Phase 2-3 (gesture processing)
Audio latency:        <10ms gesture-to-audio response
Voice pre-gen:        All voices loaded before experience starts
Total load time:      <5 seconds on 4G
Memory:               <200MB (audio buffers are the main cost)
Battery:              Screen is off (black) — minimal drain
```

---

## Questions Before You Start

1. What is the ElevenLabs API key? (Store in .env as VITE_ELEVENLABS_KEY)
2. Are the pre-generated music tracks available in /public/music/? If not, start with Web Audio synthesis as placeholder (similar to the conductor prototype).
3. Should the collective data API be a Vercel serverless function or localStorage-only for MVP?
