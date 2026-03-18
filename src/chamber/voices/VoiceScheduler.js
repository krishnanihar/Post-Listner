import { VOICE_SCHEDULE } from './scripts.js';
import { VOICE_POSITIONS, VOICE_SPREAD } from '../utils/constants.js';

export default class VoiceScheduler {
  constructor(audioCtx, buffers, spatialEngine, voiceGainNode, voiceReverbNode) {
    this.ctx = audioCtx;
    this.buffers = buffers; // Map: filePath → AudioBuffer
    this.spatial = spatialEngine;
    this.voiceGain = voiceGainNode;
    this.voiceReverb = voiceReverbNode; // shared ConvolverNode reverb send
    this.scheduledSources = [];
    this.activePanners = [];  // per-voice panners to disconnect on cleanup
  }

  /**
   * Schedule all voices for a given phase.
   * Each voice gets its own PannerNode at a unique azimuth offset.
   */
  schedulePhase(phaseName) {
    this.stopAll();

    const schedule = VOICE_SCHEDULE[phaseName];
    if (!schedule) return;

    const now = this.ctx.currentTime;

    for (const [voiceCategory, entries] of Object.entries(schedule)) {
      const basePos = this._getBasePosition(voiceCategory);
      const spread = VOICE_SPREAD[voiceCategory] || 20;
      const count = entries.length;

      for (let i = 0; i < count; i++) {
        const entry = entries[i];
        const buffer = this.buffers.get(entry.file);
        if (!buffer) continue;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const entryGain = this.ctx.createGain();
        entryGain.gain.value = 0;
        entryGain.gain.setTargetAtTime(1.0, now + entry.delay, 0.3);
        const fadeOutTime = now + entry.delay + buffer.duration - 0.5;
        if (fadeOutTime > now + entry.delay) {
          entryGain.gain.setTargetAtTime(0, fadeOutTime, 0.3);
        }

        source.connect(entryGain);

        // Per-voice panner with azimuth offset from category center
        const azimuthOffset = count > 1
          ? spread * (i / (count - 1) - 0.5)
          : 0;
        const voicePos = {
          azimuth: basePos.azimuth + azimuthOffset,
          elevation: basePos.elevation + (i % 3) * 5, // slight elevation variation
          distance: basePos.distance,
        };

        // Use equalpower for ambient scatter (whispers/fragments), HRTF for main voices
        const isAmbient = voiceCategory === 'whispers' || voiceCategory === 'fragments';
        const panningModel = isAmbient ? 'equalpower' : 'HRTF';

        const pannerKey = `${voiceCategory}_${i}_${phaseName}`;
        const panner = this.spatial.createPanner(pannerKey, voicePos, panningModel);

        entryGain.connect(panner);
        panner.connect(this.voiceGain);

        // Reverb send — farther voices get more reverb for depth
        if (this.voiceReverb) {
          const reverbSend = this.ctx.createGain();
          // Scale reverb by normalized distance (more distant = more wet)
          const reverbAmount = Math.min(basePos.distance / 6, 0.8);
          reverbSend.gain.value = reverbAmount;
          entryGain.connect(reverbSend);
          reverbSend.connect(this.voiceReverb);
        }

        source.start(now + entry.delay);
        this.scheduledSources.push(source);
        this.activePanners.push(pannerKey);
      }
    }
  }

  _getBasePosition(category) {
    const map = {
      admirer: VOICE_POSITIONS.ADMIRER,
      guide: VOICE_POSITIONS.GUIDE,
      witness: VOICE_POSITIONS.WITNESS,
      whispers: { azimuth: 220, elevation: 10, distance: 4 },   // behind-left, scattered
      fragments: { azimuth: 310, elevation: 5, distance: 3.5 },  // behind-right, scattered
    };
    return map[category] || VOICE_POSITIONS.ADMIRER;
  }

  stopAll() {
    for (const source of this.scheduledSources) {
      try { source.stop(); } catch {}
    }
    this.scheduledSources = [];

    // Remove per-voice panners from spatial engine
    for (const key of this.activePanners) {
      this.spatial.removePanner(key);
    }
    this.activePanners = [];
  }
}
