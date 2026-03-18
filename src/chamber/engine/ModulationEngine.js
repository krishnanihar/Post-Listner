export default class ModulationEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.lfo = null;
    this.depthGain = null;
  }

  /**
   * Connects the LFO to a target GainNode's gain AudioParam.
   * The target gain oscillates around 0.65 with amplitude controlled by depth.
   */
  connect(targetGainNode) {
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 10; // Mid-alpha

    this.depthGain = this.ctx.createGain();
    this.depthGain.gain.value = 0; // No modulation initially

    this.lfo.connect(this.depthGain);
    this.depthGain.connect(targetGainNode.gain);

    // Set base gain around which LFO modulates
    targetGainNode.gain.value = 0.65;

    this.lfo.start();
  }

  setDepth(depth) {
    if (!this.depthGain) return;
    this.depthGain.gain.setTargetAtTime(depth, this.ctx.currentTime, 0.5);
  }

  setFrequency(freq) {
    if (!this.lfo) return;
    this.lfo.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.3);
  }

  stop() {
    this.lfo?.stop();
  }
}
