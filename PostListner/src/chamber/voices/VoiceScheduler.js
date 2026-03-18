import { VOICE_SCHEDULE } from './scripts.js';
import { VOICE_POSITIONS } from '../utils/constants.js';

export default class VoiceScheduler {
  constructor(audioCtx, buffers, spatialEngine, voiceGainNode) {
    this.ctx = audioCtx;
    this.buffers = buffers; // Map: filePath → AudioBuffer
    this.spatial = spatialEngine;
    this.voiceGain = voiceGainNode;
    this.scheduledSources = [];
  }

  /**
   * Schedule all voices for a given phase.
   * Called on each phase transition.
   */
  schedulePhase(phaseName) {
    // Stop any currently playing scheduled sources
    this.stopAll();

    const schedule = VOICE_SCHEDULE[phaseName];
    if (!schedule) return;

    const now = this.ctx.currentTime;

    for (const [voiceCategory, entries] of Object.entries(schedule)) {
      // Determine spatial position for this voice category
      const posKey = this._getCategoryPosition(voiceCategory);

      for (const entry of entries) {
        const buffer = this.buffers.get(entry.file);
        if (!buffer) continue;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const entryGain = this.ctx.createGain();
        // Fade in/out for smooth voice appearance
        entryGain.gain.value = 0;
        entryGain.gain.setTargetAtTime(1.0, now + entry.delay, 0.3);
        // Schedule fade out near end of buffer
        const fadeOutTime = now + entry.delay + buffer.duration - 0.5;
        if (fadeOutTime > now + entry.delay) {
          entryGain.gain.setTargetAtTime(0, fadeOutTime, 0.3);
        }

        source.connect(entryGain);

        // Route through spatial panner if available
        const panner = this.spatial.getPanner(posKey);
        if (panner) {
          entryGain.connect(panner);
          panner.connect(this.voiceGain);
        } else {
          entryGain.connect(this.voiceGain);
        }

        source.start(now + entry.delay);
        this.scheduledSources.push(source);
      }
    }
  }

  _getCategoryPosition(category) {
    const map = {
      admirer: 'admirer',
      guide: 'guide',
      witness: 'witness',
      whispers: 'witness', // Whispers come from behind
      fragments: 'guide',  // Fragments orbit
    };
    return map[category] || 'admirer';
  }

  stopAll() {
    for (const source of this.scheduledSources) {
      try { source.stop(); } catch {}
    }
    this.scheduledSources = [];
  }
}
