// Factory for the Admirer agent's client tools. The factory takes
// host-phase callbacks so React state and audio playback can react
// to tool invocations. Every tool function returns a small JSON-safe
// result the agent can use as the tool-call return value.

import {
  addLexicon,
  addRestricted,
  appendEntry,
  getRestricted,
} from './sessionStore.js'
import { getFragment } from './fragmentBank.js'
import { mapDescriptorsToStems } from './descriptorsToStems.js'

// Callbacks the host phase can wire (all optional):
//   onPlayFragment({id, url, descriptors})    — called when playFragment fires
//   onStartGeneration({archetypeId, variationId, stems, masterUrl})
//   onCommitEntry({summary, ts})              — called when commitEntry fires
//   onCommitArtifact({label, content})        — called when commitArtifact fires
//   onMarkRestricted(repertoire)              — called when markRestricted fires
//   onRecordLexicon({term, userPhrasing})     — called when recordLexicon fires
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
      const bundle = mapDescriptorsToStems(descriptors, { restricted })
      cb.onStartGeneration?.(bundle)
      return {
        ok: true,
        archetypeId: bundle.archetypeId,
        variationId: bundle.variationId,
      }
    },

    commitEntry: ({ summary } = {}) => {
      const entry = { summary: summary || '', ts: Date.now() }
      appendEntry(entry)
      cb.onCommitEntry?.(entry)
      return { ok: true }
    },
  }
}
