import { PHASE_DURATIONS, PHASE_START_TIMES } from '../utils/constants.js';

export const PHASES = {
  ENTRY: 'entry',
  INTRO: 'intro',
  THRONE: 'throne',
  ASCENT: 'ascent',
  DISSOLUTION: 'dissolution',
  SILENCE: 'silence',
  EXIT: 'exit',
};

// Ordered experience phases (excludes ENTRY and EXIT)
export const EXPERIENCE_PHASES = [
  PHASES.INTRO,
  PHASES.THRONE,
  PHASES.ASCENT,
  PHASES.DISSOLUTION,
  PHASES.SILENCE,
];

// Map phase name to duration and start time
export const PHASE_INFO = {
  [PHASES.INTRO]: {
    duration: PHASE_DURATIONS.INTRO,
    startTime: PHASE_START_TIMES.INTRO,
  },
  [PHASES.THRONE]: {
    duration: PHASE_DURATIONS.THRONE,
    startTime: PHASE_START_TIMES.THRONE,
  },
  [PHASES.ASCENT]: {
    duration: PHASE_DURATIONS.ASCENT,
    startTime: PHASE_START_TIMES.ASCENT,
  },
  [PHASES.DISSOLUTION]: {
    duration: PHASE_DURATIONS.DISSOLUTION,
    startTime: PHASE_START_TIMES.DISSOLUTION,
  },
  [PHASES.SILENCE]: {
    duration: PHASE_DURATIONS.SILENCE,
    startTime: PHASE_START_TIMES.SILENCE,
  },
};
