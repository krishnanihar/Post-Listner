// musicGen — the orchestration seam for per-session generative music.
//
// Feature-flagged behind VITE_ENABLE_LIVE_MUSIC_GEN. When OFF (default), this
// module is inert and the app runs the existing catalog stem path byte-for-byte.
// When ON, Admirer fires startGenerativeTrack() at era-commit (archetype is
// already fixed by the face beat; era fixes the variation/decade), and the
// generated track becomes the Act1→Act2 handoff if it's ready by bloom — else
// the speculative catalog player (loaded at Rise) is the fallback, so the sacred
// seam never depends on an unSLA'd network call.

import { generateMusicTrack } from '../engine/elevenlabs.js'
import { buildPrompt } from './avdToPlan.js'
import GenerativePlayer from './generativePlayer.js'

export const LIVE_MUSIC_GEN_ENABLED =
  import.meta.env.VITE_ENABLE_LIVE_MUSIC_GEN === 'true'

// How long bloom will wait for an in-flight generation before committing to the
// catalog fallback. Generation is ~18–21s and starts at era-commit (reflect +
// bloom cover it), so by bloom it's usually already resolved; this is a ceiling.
export const GEN_BLOOM_WAIT_MS = 4000

/**
 * Kick off generation and return a Promise that resolves to a started, SILENT
 * GenerativePlayer — or null on failure (caller falls back to the catalog).
 * Never rejects.
 * @param {{ctx:AudioContext, avd:{a,v,d}, archetypeId:string, eraYear?:number, durationMs?:number}} opts
 * @returns {Promise<GenerativePlayer|null>|null} null synchronously if disabled/no-ctx.
 */
export function startGenerativeTrack({ ctx, avd, archetypeId, eraYear, durationMs }) {
  if (!LIVE_MUSIC_GEN_ENABLED || !ctx) return null
  // music_v2 (the default model) generates from a PROMPT, not a composition plan
  // (verified 2026-07-06: v2 rejects composition_plan with 422). The prose prompt
  // encodes AVD + archetype + era + the sparse→full→resolve arc. (For the older
  // music_v1 + composition-plan path, buildCompositionPlan in avdToPlan.js is
  // still available.)
  const prompt = buildPrompt({ avd, archetypeId, eraYear })
  return generateMusicTrack(prompt, { durationMs })
    .then((url) => GenerativePlayer.load(ctx, url))
    .then((player) => {
      player.setVolume(0, 0)
      player.start()
      return player
    })
    .catch((err) => {
      console.warn('[musicGen] generation unavailable — catalog fallback', err)
      return null
    })
}
