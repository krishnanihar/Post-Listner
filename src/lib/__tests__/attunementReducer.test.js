import { describe, it, expect } from 'vitest'
import { initialState, reduce } from '../attunementReducer.js'

describe('attunementReducer', () => {
  it('starts active on the first movement', () => {
    const s = initialState()
    expect(s).toEqual({ movementId: 'arrival', status: 'active' })
  })
  it('COMMIT marks the current movement committed', () => {
    const s = reduce(initialState(), { type: 'COMMIT' })
    expect(s).toEqual({ movementId: 'arrival', status: 'committed' })
  })
  it('ADVANCE moves to the next movement, active again', () => {
    const s = reduce({ movementId: 'arrival', status: 'committed' }, { type: 'ADVANCE' })
    expect(s).toEqual({ movementId: 'leanLift', status: 'active' })
  })
  it('ADVANCE past the last movement enters the done state', () => {
    const s = reduce({ movementId: 'bloom', status: 'committed' }, { type: 'ADVANCE' })
    expect(s).toEqual({ movementId: 'bloom', status: 'done' })
  })
  it('ignores unknown actions', () => {
    const s = initialState()
    expect(reduce(s, { type: 'NOPE' })).toBe(s)
  })
})
