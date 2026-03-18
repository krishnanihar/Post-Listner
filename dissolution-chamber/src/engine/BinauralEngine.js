import { BINAURAL } from '../utils/constants.js';

export default class BinauralEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.leftOsc = null;
    this.rightOsc = null;
    this.merger = null;
    this.gainNode = null;
  }

  start() {
    this.merger = this.ctx.createChannelMerger(2);
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0; // Fades in during INTRO

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

  setBeatFrequency(beatFreq) {
    if (!this.rightOsc) return;
    this.rightOsc.frequency.setTargetAtTime(
      BINAURAL.CARRIER_FREQ + beatFreq,
      this.ctx.currentTime,
      0.5
    );
  }

  setGain(value) {
    if (!this.gainNode) return;
    this.gainNode.gain.setTargetAtTime(value, this.ctx.currentTime, 0.3);
  }

  stop() {
    this.leftOsc?.stop();
    this.rightOsc?.stop();
  }

  getOutput() {
    return this.gainNode;
  }
}
