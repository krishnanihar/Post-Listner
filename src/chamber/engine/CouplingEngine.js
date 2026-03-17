import { COUPLING, PHASE_DURATIONS } from '../utils/constants.js';

export default class CouplingEngine {
  constructor() {
    this.value = COUPLING.INITIAL;
  }

  /**
   * Updates coupling value based on total elapsed time.
   * Coupling decays sigmoidally from 1.0 to 0.0 over the ASCENT phase.
   */
  update(totalElapsed) {
    const decayStart = PHASE_DURATIONS.INTRO + PHASE_DURATIONS.THRONE; // 165s
    const decayEnd = decayStart + PHASE_DURATIONS.ASCENT; // 345s

    if (totalElapsed <= decayStart) {
      this.value = COUPLING.INITIAL;
    } else if (totalElapsed >= decayEnd) {
      this.value = COUPLING.PHASE_4;
    } else {
      const progress = (totalElapsed - decayStart) / (decayEnd - decayStart);
      const sigmoid = 1 / (1 + Math.exp(COUPLING.SIGMOID_STEEPNESS * (progress - 0.5)));
      this.value = sigmoid * COUPLING.INITIAL;
    }

    return this.value;
  }

  getValue() {
    return this.value;
  }
}
