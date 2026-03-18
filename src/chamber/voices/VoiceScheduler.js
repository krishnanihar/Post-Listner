import { VOICE_SCHEDULE } from './scripts.js';
import { VOICE_POSITIONS, VOICE_SPREAD, VOICE_CATEGORY_GAINS } from '../utils/constants.js';

export default class VoiceScheduler {
  constructor(audioCtx, buffers, spatialEngine, voiceGainNode, voiceReverbNode, musicDuckNode) {
    this.ctx = audioCtx;
    this.buffers = buffers; // Map: filePath → AudioBuffer
    this.spatial = spatialEngine;
    this.voiceGain = voiceGainNode;
    this.voiceReverb = voiceReverbNode; // shared ConvolverNode reverb send
    this.musicDuck = musicDuckNode;     // sidechain duck gain node
    this.scheduledSources = [];
    this.activePanners = [];  // per-voice panners to disconnect on cleanup
  }

  /**
   * Schedule all voices for a given phase.
   * Each voice gets its own PannerNode at a unique azimuth offset.
   * Music is ducked during merged voice time ranges.
   */
  schedulePhase(phaseName) {
    this.stopAll();

    const schedule = VOICE_SCHEDULE[phaseName];
    if (!schedule) return;

    const now = this.ctx.currentTime;

    // Collect voice time ranges for sidechain duck scheduling
    const voiceRanges = [];

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
        const categoryGain = VOICE_CATEGORY_GAINS[voiceCategory] || 1.0;
        entryGain.gain.setTargetAtTime(categoryGain, now + entry.delay, 0.3);
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
          const reverbAmount = Math.min(basePos.distance / 8, 0.5);
          reverbSend.gain.value = reverbAmount;
          entryGain.connect(reverbSend);
          reverbSend.connect(this.voiceReverb);
        }

        source.start(now + entry.delay);
        this.scheduledSources.push(source);
        this.activePanners.push(pannerKey);

        // Track voice time range for duck scheduling
        voiceRanges.push({
          start: entry.delay,
          end: entry.delay + buffer.duration,
        });
      }
    }

    // Schedule sidechain ducking on merged voice ranges
    this._scheduleDuck(now, voiceRanges);
  }

  /**
   * Merge overlapping voice ranges and schedule duck/release on musicDuck node.
   * Prevents pumping when voices overlap.
   */
  _scheduleDuck(now, ranges) {
    if (!this.musicDuck || ranges.length === 0) return;

    // Sort by start time
    ranges.sort((a, b) => a.start - b.start);

    // Merge overlapping ranges (with 0.3s grace period to avoid brief unducks)
    const merged = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r.start <= last.end + 0.3) {
        last.end = Math.max(last.end, r.end);
      } else {
        merged.push({ start: r.start, end: r.end });
      }
    }

    // Schedule duck at merged range start, release at end
    for (const range of merged) {
      // Duck: gain → 0.35 (~-9 dB) with 100ms attack (time constant ~33ms)
      this.musicDuck.gain.setTargetAtTime(0.35, now + range.start, 0.033);
      // Release: gain → 1.0 with 300ms release (time constant ~100ms)
      this.musicDuck.gain.setTargetAtTime(1.0, now + range.end, 0.1);
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

    // Reset duck to neutral
    if (this.musicDuck) {
      this.musicDuck.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicDuck.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
    }
  }
}
