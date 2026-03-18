import BinauralEngine from './BinauralEngine.js';
import ModulationEngine from './ModulationEngine.js';
import SpatialEngine from './SpatialEngine.js';
import CollectiveEngine from './CollectiveEngine.js';
import { VOICE_POSITIONS } from '../utils/constants.js';
import { clamp } from '../utils/math.js';
import { AMBIENT_SOUNDS, COLLECTIVE_TRACK } from '../voices/scripts.js';

/**
 * Master audio engine managing all signal paths.
 *
 * Path 1 (Music/Demo): Sources → demoGain/musicFilter → musicGain → intensityGain → musicDuck → panner → compressor
 * Path 2 (Binaural):   BinauralEngine → compressor
 * Path 3 (Collective):  CollectiveEngine → modGain → panner → compressor
 * Path 4 (Voices):     VoiceScheduler manages sources → panners → gain → compressor
 * Path 5 (Textures):   Whispers/Fragments/Crowd → gain → compressor
 */
export default class AudioEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.buffers = new Map(); // filePath → AudioBuffer

    // Master bus
    this.compressor = null;

    // Sub-engines
    this.binaural = null;
    this.modulation = null;
    this.spatial = null;
    this.collective = null;

    // Path 1: Music / Demo
    this.musicSource = null;
    this.musicFilter = null;
    this.musicGain = null;       // phase-driven gain only
    this.intensityGain = null;   // motion-driven gain (separate node)
    this.musicDuck = null;       // sidechain duck node (voices duck music)
    this.musicPanner = null;

    // Demo track
    this.demoSource = null;
    this.demoGain = null;

    // Path 3: Collective modulation gain
    this.collectiveModGain = null;
    this.collectivePanner = null;

    // Path 4: Voice gain + reverb
    this.voiceGain = null;
    this.voiceReverb = null;
    this.voiceReverbGain = null;

    // Path 5: Texture gain
    this.textureGain = null;
  }

  /**
   * Preload all MP3 files and return progress via callback.
   */
  async preloadAll(filePaths, onProgress) {
    let loaded = 0;
    const total = filePaths.length;
    const results = await Promise.allSettled(
      filePaths.map(async (path) => {
        try {
          const response = await fetch(path);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.buffers.set(path, audioBuffer);
        } catch (err) {
          console.warn(`Failed to load: ${path}`, err);
        }
        loaded++;
        onProgress?.(loaded / total);
      })
    );
    return this.buffers;
  }

  /**
   * Initialize all signal paths and sub-engines.
   */
  init(collectiveAVD) {
    // Gentle compressor — preserves dynamics, catches peaks
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 0;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.1;
    this.compressor.connect(this.ctx.destination);

    // --- Path 1: Music / Demo shared chain ---
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 8000;
    this.musicFilter.Q.value = 1;

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0;

    this.intensityGain = this.ctx.createGain();
    this.intensityGain.gain.value = 1.0;

    this.musicDuck = this.ctx.createGain();
    this.musicDuck.gain.value = 1.0;

    this.musicPanner = this.ctx.createStereoPanner();
    this.musicPanner.pan.value = 0;

    // Demo gain — feeds into shared filter chain
    this.demoGain = this.ctx.createGain();
    this.demoGain.gain.value = 0.35;

    // Chain: demo → demoGain ─╮
    //        music → musicFilter ←╯ → musicGain → intensityGain → musicDuck → panner → compressor
    this.demoGain.connect(this.musicFilter);
    this.musicFilter.connect(this.musicGain);
    this.musicGain.connect(this.intensityGain);
    this.intensityGain.connect(this.musicDuck);
    this.musicDuck.connect(this.musicPanner);
    this.musicPanner.connect(this.compressor);

    // --- Path 2: Binaural ---
    this.binaural = new BinauralEngine(this.ctx);
    this.binaural.start();
    this.binaural.getOutput().connect(this.compressor);

    // --- Path 3: Collective ---
    this.collective = new CollectiveEngine(this.ctx, collectiveAVD);
    this.collective.start();

    // Modulation gain node (LFO target)
    this.collectiveModGain = this.ctx.createGain();
    this.collectiveModGain.gain.value = 0.65;

    // Spatial panner for collective
    this.spatial = new SpatialEngine(this.ctx);
    this.collectivePanner = this.spatial.createPanner('collective', {
      azimuth: 0, elevation: 10, distance: 1.5,
    });

    this.collective.getOutput().connect(this.collectiveModGain);
    this.collectiveModGain.connect(this.collectivePanner);
    this.collectivePanner.connect(this.compressor);

    // Modulation engine attaches LFO to collective mod gain
    this.modulation = new ModulationEngine(this.ctx);
    this.modulation.connect(this.collectiveModGain);

    // --- Path 4: Voices (dry + reverb send) ---
    this.voiceGain = this.ctx.createGain();
    this.voiceGain.gain.value = 1.95;
    this.voiceGain.connect(this.compressor);

    // Voice reverb bus — externalization cue for HRTF
    this.voiceReverb = this.ctx.createConvolver();
    this.voiceReverb.buffer = this._generateVoiceIR(1.5, 0.4);
    this.voiceReverbGain = this.ctx.createGain();
    this.voiceReverbGain.gain.value = 0.35;
    this.voiceReverb.connect(this.voiceReverbGain);
    this.voiceReverbGain.connect(this.compressor);

    // Create spatial panners for each voice category (used as base positions)
    for (const [key, pos] of Object.entries(VOICE_POSITIONS)) {
      this.spatial.createPanner(key.toLowerCase(), pos);
    }

    // --- Path 5: Textures ---
    this.textureGain = this.ctx.createGain();
    this.textureGain.gain.value = 0;
    this.textureGain.connect(this.compressor);
  }

  /**
   * Start playing the PostListener demo track (looping through INTRO+THRONE).
   */
  startDemoTrack(path) {
    const buffer = this.buffers.get(path);
    if (!buffer) {
      console.warn('Demo buffer not found:', path);
      return;
    }
    this.demoSource = this.ctx.createBufferSource();
    this.demoSource.buffer = buffer;
    this.demoSource.loop = true;
    this.demoSource.connect(this.demoGain);
    this.demoSource.start();
  }

  /**
   * Crossfade demo track out over `duration` seconds.
   * Called at ASCENT start — demo fades, collective/chamber take over via PHASE_PARAMS.
   */
  crossfadeDemoToCollective(duration = 60) {
    const now = this.ctx.currentTime;
    if (this.demoGain) {
      this.demoGain.gain.setValueAtTime(0.35, now);
      this.demoGain.gain.linearRampToValueAtTime(0, now + duration);
    }
  }

  /**
   * Start playing the selected music track (looping).
   */
  startMusic(trackPath) {
    const buffer = this.buffers.get(trackPath);
    if (!buffer) {
      console.warn('Music buffer not found:', trackPath);
      return;
    }

    this.musicSource = this.ctx.createBufferSource();
    this.musicSource.buffer = buffer;
    this.musicSource.loop = true;
    this.musicSource.connect(this.musicFilter);
    this.musicSource.start();
  }

  /**
   * Start ambient crowd sounds through collective engine.
   */
  startAmbient() {
    for (const path of AMBIENT_SOUNDS) {
      const buffer = this.buffers.get(path);
      if (buffer) {
        this.collective.playAmbient(buffer);
      }
    }
  }

  /**
   * Start the collective MP3 track through collective engine.
   */
  startCollectiveTrack() {
    const buffer = this.buffers.get(COLLECTIVE_TRACK);
    if (!buffer) {
      console.warn('Collective track buffer not found:', COLLECTIVE_TRACK);
      return;
    }
    this.collective.playCollectiveTrack(buffer);
  }

  /**
   * Apply gesture-mapped parameters to Path 1 (music/demo).
   */
  setMusicParams({ pan, filterNorm, intensity, articulation }) {
    const now = this.ctx.currentTime;
    if (this.musicPanner) {
      this.musicPanner.pan.setTargetAtTime(
        (pan - 0.5) * 2, // Convert 0-1 to -1 to 1
        now,
        0.05  // faster response for panning
      );
    }
    if (this.musicFilter) {
      // Map filterNorm (0-1) to frequency range (200 - 8000 Hz)
      const freq = 200 + filterNorm * 7800;
      this.musicFilter.frequency.setTargetAtTime(freq, now, 0.05);
    }
    if (this.intensityGain && intensity !== undefined) {
      // Intensity drives a separate gain node — no fighting with phase gain
      const gain = 0.8 + intensity * 0.4; // 0.8x to 1.2x
      this.intensityGain.gain.setTargetAtTime(gain, now, 0.05);
    }
  }

  setMusicGain(value) {
    if (!this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.5);
  }

  setTextureGain(value) {
    if (!this.textureGain) return;
    this.textureGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.5);
  }

  /**
   * Generate a short impulse response for voice externalization.
   */
  _generateVoiceIR(duration, decay) {
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

  stopAll() {
    try { this.musicSource?.stop(); } catch {}
    try { this.demoSource?.stop(); } catch {}
    this.binaural?.stop();
    this.modulation?.stop();
    this.collective?.stop();
  }
}
