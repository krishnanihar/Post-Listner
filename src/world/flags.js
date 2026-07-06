// Nocturne feature flags. All Nocturne rendering + theme sits behind
// VITE_ENABLE_NOCTURNE (default off → the shipped cream/dark theme is
// byte-identical; WorldStage renders nothing; phaseTheme.inkForPhase unchanged).
// Same discipline as VITE_ENABLE_LIVE_MUSIC_GEN. Read once at module load.

export const NOCTURNE_ENABLED =
  import.meta.env.VITE_ENABLE_NOCTURNE === 'true'

// Act-II legibility flags (canon §7). Default off; byte-identical audio when off.
export const THRONE_INTRO_RAMP_ENABLED =
  import.meta.env.VITE_ENABLE_THRONE_INTRO_RAMP === 'true'

export const FALTER_ENABLED =
  import.meta.env.VITE_ENABLE_FALTER === 'true'
