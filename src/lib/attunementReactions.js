// src/lib/attunementReactions.js
// Turns a movement's commit payload into a short natural-language context line
// for the companion voice. ElevenLabs contextual updates take readable prose
// (not JSON) and inform the agent's next response. Pure — unit-tested.
export function phraseReaction(movementId, payload = {}) {
  switch (movementId) {
    case 'leanLift': {
      if (typeof payload.valence !== 'number' || typeof payload.depth !== 'number') return ''
      const warm = payload.valence >= 0 ? 'warm' : 'cool and austere'
      const depth = payload.depth >= 0 ? 'inward' : 'open'
      return `The listener leaned ${warm} and ${depth}.`
    }
    case 'rise':
      if (payload.downbeat) return `The listener marked the beat.`
      if (typeof payload.hedonic !== 'boolean') return ''
      return payload.hedonic
        ? `The listener rode the climax.`
        : `The listener held back from the climax.`
    case 'face':
      return payload.archetypeId
        ? `The listener turned to face the ${payload.archetypeId} world.`
        : ''
    default:
      return ''
  }
}
