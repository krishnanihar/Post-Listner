import { describe, it, expect } from 'vitest'
import {
  MOVEMENTS, MOVEMENT_ORDER, getMovement, firstMovementId, nextMovementId,
} from '../attunementMovements.js'

describe('attunementMovements', () => {
  it('is the seven-beat arc in order', () => {
    expect(MOVEMENT_ORDER).toEqual(['arrival', 'leanLift', 'listen', 'rise', 'face', 'reflect', 'bloom'])
  })
  it('each movement carries a kind and a monotonic expansion target', () => {
    let prev = -1
    for (const id of MOVEMENT_ORDER) {
      const m = getMovement(id)
      expect(m.kind).toBeTruthy()
      expect(m.expansionTo).toBeGreaterThanOrEqual(prev)
      prev = m.expansionTo
    }
    expect(getMovement('bloom').expansionTo).toBe(1)
  })
  it('the move movements declare the signals they read', () => {
    expect(getMovement('leanLift').signals).toEqual(['pan'])
    expect(getMovement('listen').signals).toEqual(['filterNorm'])
    expect(getMovement('rise').signals).toEqual(['gestureGain', 'downbeat'])
    expect(getMovement('face').signals).toEqual(['yaw'])
  })
  it('firstMovementId is arrival; nextMovementId walks then returns null', () => {
    expect(firstMovementId()).toBe('arrival')
    expect(nextMovementId('arrival')).toBe('leanLift')
    expect(nextMovementId('face')).toBe('reflect')
    expect(nextMovementId('reflect')).toBe('bloom')
    expect(nextMovementId('bloom')).toBe(null)
  })
  it('getMovement returns null for an unknown id', () => {
    expect(getMovement('nope')).toBe(null)
  })
  it('every movement has ask: null (the on-screen cues carry the prompts; no agent)', () => {
    for (const id of MOVEMENT_ORDER) {
      expect(getMovement(id).ask).toBe(null)
    }
  })
})
