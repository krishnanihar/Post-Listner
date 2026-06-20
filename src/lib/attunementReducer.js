// src/lib/attunementReducer.js
// Pure sequence state machine for the Attunement Room. The hook
// (useAttunementScore) decides *when* to dispatch COMMIT/ADVANCE from gesture
// + timer input; this module owns *what the state becomes*. Unit-tested.

import { firstMovementId, nextMovementId } from './attunementMovements.js'

export function initialState() {
  return { movementId: firstMovementId(), status: 'active' }
}

export function reduce(state, action) {
  switch (action.type) {
    case 'COMMIT':
      if (state.status !== 'active') return state
      return { ...state, status: 'committed' }
    case 'ADVANCE': {
      if (state.status !== 'committed') return state
      const next = nextMovementId(state.movementId)
      if (next === null) return { ...state, status: 'done' }
      return { movementId: next, status: 'active' }
    }
    default:
      return state
  }
}
