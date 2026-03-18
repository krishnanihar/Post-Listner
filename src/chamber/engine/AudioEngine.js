import BinauralEngine from './BinauralEngine.js';
import ModulationEngine from './ModulationEngine.js';
import SpatialEngine from './SpatialEngine.js';
import CollectiveEngine from './CollectiveEngine.js';
import { VOICE_POSITIONS, CONDUCTING } from '../utils/constants.js';
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

    // Demo gain — parallel input to shared filter chain
    this.demoGain = this.ctx.createGain();
    this.demoGain.gain.value = 0;  // starts silent, phase-driven

    // Demo and chamber are parallel inputs to the shared filter
    // demo → demoGain ──╮
    //                    ├→ musicFilter → intensityGain → musicDuck → panner → compressor
    // chamber → musicGain ─╯
    this.demoGain.connect(this.musicFilter);
    this.musicGain.connect(this.musicFilter);
    this.musicFilter.connect(this.intensityGain);
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
   * No longer needed — demo gain is phase-driven via setDemoGain().
   */
  crossfadeDemoToCollective(duration = 60) {}

  setDemoGain(value) {
    if (!this.demoGain) return;
    this.demoGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.8);
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
    this.musicSource.connect(this.musicGain);
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
  setMusicParams({ pan, filterNorm, gestureGain, articulation, downbeat }) {
    const now = this.ctx.currentTime;

    // --- PAN (divergent: pan + subtle pitch detune) ---
    if (this.musicPanner) {
      const panValue = (pan - 0.5) * 2; // 0-1 → -1 to 1
      this.musicPanner.pan.setTargetAtTime(panValue, now, CONDUCTING.PAN_TC);
    }

    // --- FILTER CUTOFF (from beta tilt) ---
    if (this.musicFilter) {
      const freq = 200 + filterNorm * 7800;
      this.musicFilter.frequency.setTargetAtTime(freq, now, CONDUCTING.FILTER_FREQ_TC);
    }

    // --- DYNAMICS (from gesture size — the primary conducting control) ---
    if (this.intensityGain) {
      const gain = CONDUCTING.GESTURE_SIZE_GAIN_MIN +
        gestureGain * (CONDUCTING.GESTURE_SIZE_GAIN_MAX - CONDUCTING.GESTURE_SIZE_GAIN_MIN);
      this.intensityGain.gain.setTargetAtTime(gain, now, CONDUCTING.GESTURE_SIZE_SMOOTHING_TC);
    }

    // --- ARTICULATION (jerk → filter Q transient) ---
    if (this.musicFilter && articulation > CONDUCTING.ARTICULATION_THRESHOLD) {
      const targetQ = CONDUCTING.ARTICULATION_Q_BASE +
        articulation * (CONDUCTING.ARTICULATION_Q_MAX - CONDUCTING.ARTICULATION_Q_BASE);
      // Fast attack
      this.musicFilter.Q.setTargetAtTime(targetQ, now, 0.01);
      // Schedule decay back to base Q
      this.musicFilter.Q.setTargetAtTime(
        CONDUCTING.ARTICULATION_Q_BASE,
        now + 0.02,
        CONDUCTING.ARTICULATION_DECAY_TC
      );
    }

    // --- DOWNBEAT ACCENT ---
    if (downbeat && downbeat.fired) {
      this._applyDownbeat(downbeat.intensity);
    }
  }

  /**
   * Apply a conducting downbeat accent: gain spike + Q spike + noise transient.
   */
  _applyDownbeat(intensity) {
    const now = this.ctx.currentTime;

    // --- Gain spike on intensity node ---
    if (this.intensityGain) {
      const currentGain = this.intensityGain.gain.value;
      const spikeMultiplier = CONDUCTING.DOWNBEAT_GAIN_SPIKE_MIN +
        intensity * (CONDUCTING.DOWNBEAT_GAIN_SPIKE_MAX - CONDUCTING.DOWNBEAT_GAIN_SPIKE_MIN);
      const spikeGain = Math.min(1.2, currentGain * spikeMultiplier);

      this.intensityGain.gain.cancelScheduledValues(now);
      this.intensityGain.gain.setValueAtTime(spikeGain, now);
      this.intensityGain.gain.setTargetAtTime(
        currentGain,
        now + 0.01,
        CONDUCTING.DOWNBEAT_GAIN_DECAY_TC
      );
    }

    // --- Q spike on music filter ---
    if (this.musicFilter) {
      const targetQ = CONDUCTING.DOWNBEAT_Q_MIN +
        intensity * (CONDUCTING.DOWNBEAT_Q_MAX - CONDUCTING.DOWNBEAT_Q_MIN);
      this.musicFilter.Q.cancelScheduledValues(now);
      this.musicFilter.Q.setValueAtTime(targetQ, now);
      this.musicFilter.Q.setTargetAtTime(
        CONDUCTING.ARTICULATION_Q_BASE,
        now + 0.01,
        CONDUCTING.DOWNBEAT_Q_DECAY_TC
      );
    }

    // --- Percussive noise transient ---
    this._playDownbeatTransient(intensity);
  }

  /**
   * Play a very short filtered noise burst as tactile audio feedback for the downbeat.
   */
  _playDownbeatTransient(intensity) {
    const now = this.ctx.currentTime;
    const duration = CONDUCTING.DOWNBEAT_TRANSIENT_DURATION;
    const gain = CONDUCTING.DOWNBEAT_TRANSIENT_GAIN * intensity;

    // Create noise buffer
    const sampleCount = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter centered on 2kHz — gives a woody "tick" character
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500 + intensity * 2000; // 1500-3500 Hz
    filter.Q.value = 2;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter).connect(gainNode).connect(this.compressor);
    source.start(now);
    source.stop(now + duration + 0.01);
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
   * Briefly swell collective gain then return to current level.
   * Creates a momentary "envelopment" sensation.
   */
  pulseCollectiveGain(peakGain = 0.95, duration = 1.5) {
    if (!this.collectiveModGain) return;
    const now = this.ctx.currentTime;
    const currentGain = this.collectiveModGain.gain.value;

    this.collectiveModGain.gain.setTargetAtTime(peakGain, now, 0.15);
    this.collectiveModGain.gain.setTargetAtTime(currentGain, now + 0.5, 0.4);
  }

  /**
   * Briefly align all collective oscillators in phase for a moment of
   * harmonic clarity, then return to normal.
   */
  pulseCollectiveHarmony(duration = 0.5) {
    if (!this.collective?.oscillators) return;
    const now = this.ctx.currentTime;

    this.collective.oscillators.forEach(({ osc }) => {
      const currentDetune = osc.detune.value;
      osc.detune.setTargetAtTime(0, now, 0.05);
      osc.detune.setTargetAtTime(currentDetune, now + duration, 0.2);
    });
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
