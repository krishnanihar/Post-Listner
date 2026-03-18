import { TOTAL_DURATION } from '../utils/constants.js';
import { PHASES, EXPERIENCE_PHASES, PHASE_INFO } from './PhaseConfig.js';

export default class PhaseManager {
  constructor() {
    this.currentPhase = PHASES.INTRO;
    this.phaseElapsed = 0;
    this.totalElapsed = 0;
    this.phaseProgress = 0; // 0-1 within current phase
    this.deltaTime = 0;
    this._startTime = null;
    this._lastTimestamp = null;
    this._listeners = [];
    this._phaseChangeListeners = [];
  }

  start(timestamp) {
    this._startTime = timestamp;
    this._lastTimestamp = timestamp;
    this.currentPhase = PHASES.INTRO;
    this.phaseElapsed = 0;
    this.totalElapsed = 0;
    this.phaseProgress = 0;
    this.deltaTime = 0;
  }

  /**
   * Called every frame from rAF. timestamp is performance.now() in ms.
   * Returns true if experience is still running, false if complete.
   */
  update(timestamp) {
    if (this._startTime === null) {
      this.start(timestamp);
      return true;
    }

    this.deltaTime = (timestamp - this._lastTimestamp) / 1000;
    this._lastTimestamp = timestamp;
    this.totalElapsed = (timestamp - this._startTime) / 1000;

    if (this.totalElapsed >= TOTAL_DURATION) {
      this._setPhase(PHASES.EXIT);
      return false;
    }

    // Determine current phase from total elapsed time
    let newPhase = PHASES.INTRO;
    for (let i = EXPERIENCE_PHASES.length - 1; i >= 0; i--) {
      const phase = EXPERIENCE_PHASES[i];
      if (this.totalElapsed >= PHASE_INFO[phase].startTime) {
        newPhase = phase;
        break;
      }
    }

    if (newPhase !== this.currentPhase) {
      this._setPhase(newPhase);
    }

    // Calculate phase-local elapsed and progress
    const info = PHASE_INFO[this.currentPhase];
    if (info) {
      this.phaseElapsed = this.totalElapsed - info.startTime;
      this.phaseProgress = Math.min(this.phaseElapsed / info.duration, 1);
    }

    return true;
  }

  _setPhase(phase) {
    const prev = this.currentPhase;
    this.currentPhase = phase;
    this.phaseElapsed = 0;
    this.phaseProgress = 0;
    for (const fn of this._phaseChangeListeners) {
      fn(phase, prev);
    }
  }

  onPhaseChange(callback) {
    this._phaseChangeListeners.push(callback);
    return () => {
      this._phaseChangeListeners = this._phaseChangeListeners.filter((fn) => fn !== callback);
    };
  }

  /**
   * Get the uppercase phase key for constants lookup (e.g., 'throne' → 'THRONE')
   */
  getPhaseKey() {
    return this.currentPhase.toUpperCase();
  }
}
