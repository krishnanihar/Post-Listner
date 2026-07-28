// Nocturne feature flags.
//
// As of the ui-refinements/audio-enhancement pass these default **on**: Nocturne
// is the shipped experience, not an experiment. The opt-out is explicit —
// VITE_ENABLE_NOCTURNE=false restores the original cream/dark theme (every
// call site still branches on the flag, so the flag-off build is unchanged).
// Same shape as VITE_ENABLE_LIVE_MUSIC_GEN, inverted. Read once at module load.

export const NOCTURNE_ENABLED =
  import.meta.env.VITE_ENABLE_NOCTURNE !== 'false'

// Act-II legibility flags (canon §7). Also default on now.
export const THRONE_INTRO_RAMP_ENABLED =
  import.meta.env.VITE_ENABLE_THRONE_INTRO_RAMP !== 'false'

// The one flag that alters the Act-II AUDIO graph (it inserts a dedicated
// hall-wet node, OrchestraEngine.falterGain). If the diegetic falter reads
// wrong on device, VITE_ENABLE_FALTER=false is the first thing to switch back.
export const FALTER_ENABLED =
  import.meta.env.VITE_ENABLE_FALTER !== 'false'
