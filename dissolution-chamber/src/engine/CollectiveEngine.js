export const COLLECTIVE_TRACK = '/music/collectiveend.mp3';

export default class CollectiveEngine {
  constructor(audioCtx, collectiveAVD) {
    this.ctx = audioCtx;
    this.avd = collectiveAVD; // { arousal, valence, depth }
    this.trackSource = null;
    this.filter = null;
    this.reverb = null;
    this.masterGain = null;
    this.ambientSources = [];
  }

  start() {
    // Create master gain — starts at 0, fades in during Phase 3
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;

    // Create filter controlled by collective valence
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 200 + this.avd.valence * 2000;
    this.filter.Q.value = 1 + this.avd.depth * 3;

    // Create reverb with generated impulse response
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this._generateImpulseResponse(
      2 + this.avd.depth * 6,
      this.avd.depth * 0.5
    );

    // Connect: filter → reverb → masterGain
    this.filter.connect(this.reverb);
    this.reverb.connect(this.masterGain);

    // Also route dry signal for clarity
    this.filter.connect(this.masterGain);
  }

  /**
   * Play the pre-generated collective track through the signal chain (looping).
   */
  playTrack(buffer) {
    this.trackSource = this.ctx.createBufferSource();
    this.trackSource.buffer = buffer;
    this.trackSource.loop = true;
    this.trackSource.connect(this.filter);
    this.trackSource.start();
  }

  /**
   * Play ambient crowd MP3 buffers through the collective signal chain.
   */
  playAmbient(buffer) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.08; // Very subtle

    source.connect(gain);
    gain.connect(this.filter);
    source.start();
    this.ambientSources.push({ source, gain });
  }

  _generateImpulseResponse(duration, decay) {
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
    if (!this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.5);
  }

  getOutput() {
    return this.masterGain;
  }

  stop() {
    try { this.trackSource?.stop(); } catch {}
    this.ambientSources.forEach(({ source }) => {
      try { source.stop(); } catch {}
    });
  }
}
