// Factory for the Admirer agent's client tools. The factory takes
// host-phase callbacks so React state and audio playback can react
// to tool invocations. Every tool function returns a small JSON-safe
// result the agent can use as the tool-call return value.

import {
  addLexicon,
  addRestricted,
  getRestricted,
} from './sessionStore.js'
import { getFragment } from './fragmentBank.js'
import { mapDescriptorsToStems } from './descriptorsToStems.js'
import { getAvd, getTurnCount } from './avdStore.js'
import { mapAvdToStems } from './avdToStems.js'

// Callbacks the host phase can wire (all optional):
//   onPlayFragment({id, url, descriptors})    — called when playFragment fires
//   onStartGeneration({archetypeId, variationId, stems, masterUrl})
//   onCommitEntry({summary, ts})              — called when commitEntry fires
//   onCommitArtifact({label, content})        — called when commitArtifact fires
//   onMarkRestricted(repertoire)              — called when markRestricted fires
//   onRecordLexicon({term, userPhrasing})     — called when recordLexicon fires
//   onNextQuestion()                          — returns the next authored seed (or null)
//   onRecordAnswer({seedId, texture, intensity, rationale})
export function buildAdmirerTools(callbacks = {}) {
  const cb = callbacks

  return {
    recordLexicon: ({ term, userPhrasing } = {}) => {
      if (!term || !userPhrasing) return { ok: false, reason: 'missing term or phrasing' }
      addLexicon(term, userPhrasing)
      cb.onRecordLexicon?.({ term, userPhrasing })
      return { ok: true }
    },

    commitArtifact: ({ label, content } = {}) => {
      cb.onCommitArtifact?.({ label, content })
      return { ok: true }
    },

    markRestricted: ({ repertoire } = {}) => {
      if (!repertoire) return { ok: false, reason: 'missing repertoire' }
      addRestricted(repertoire)
      cb.onMarkRestricted?.(repertoire)
      return { ok: true }
    },

    // playFragment BLOCKS the agent (the tool is registered
    // expects_response: true). The host's onPlayFragment plays the clip,
    // shows the Yes/No buttons, and resolves with the user's rating; that
    // string is the tool result the agent reads to pick the next fragment.
    playFragment: async ({ fragmentId } = {}) => {
      const f = getFragment(fragmentId)
      if (!f) return 'error: unknown fragment'
      if (!cb.onPlayFragment) return 'none'
      const rating = await cb.onPlayFragment(f)
      return rating || 'none'
    },

    startGeneration: (descriptors = {}) => {
      const restricted = getRestricted()
      // Once the conversation has moved the AVD vector (≥1 committed turn), the
      // vector chooses the archetype; era still picks the variation. With no
      // committed turns (vector still neutral — e.g. recordAnswer never fired)
      // fall back to the legacy descriptor pick so song variety never regresses.
      const bundle = getTurnCount() > 0
        ? mapAvdToStems(getAvd(), { restricted, era: descriptors.era })
        : mapDescriptorsToStems(descriptors, { restricted })
      cb.onStartGeneration?.(bundle)
      return {
        ok: true,
        archetypeId: bundle.archetypeId,
        variationId: bundle.variationId,
      }
    },

    commitEntry: ({ summary } = {}) => {
      const entry = { summary: summary || '', ts: Date.now() }
      cb.onCommitEntry?.(entry)
      return { ok: true }
    },

    // nextQuestion BLOCKS the agent (registered expects_response: true). The
    // host selects the next authored seed and returns its text; the agent
    // speaks that line, lightly re-voiced. Returns { done: true } when the
    // session's question budget is spent — the agent then moves on (fragments
    // / startGeneration).
    nextQuestion: async () => {
      if (!cb.onNextQuestion) return { done: true }
      const seed = await cb.onNextQuestion()
      if (!seed) return { done: true }
      return {
        seedId: seed.id,
        kind: seed.kind,
        text: seed.text,
        ...(seed.options ? { options: seed.options.map((o) => o.label) } : {}),
      }
    },

    // recordAnswer is the agent's structured texture judgment of the user's
    // spoken answer (Admirer spec §3.3). The host blends it into an AVD target
    // and commits the turn.
    recordAnswer: ({ seedId, texture, intensity, rationale } = {}) => {
      cb.onRecordAnswer?.({ seedId, texture, intensity, rationale })
      return { ok: true }
    },
  }
}
