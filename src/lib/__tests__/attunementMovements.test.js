import { describe, it, expect } from 'vitest'
import {
  MOVEMENTS, MOVEMENT_ORDER, getMovement, firstMovementId, nextMovementId,
} from '../attunementMovements.js'

describe('attunementMovements', () => {
  it('is the eight-beat arc in order', () => {
    expect(MOVEMENT_ORDER).toEqual(['arrival', 'leanLift', 'listen', 'rise', 'face', 'era', 'reflect', 'bloom'])
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
    expect(nextMovementId('face')).toBe('era')
    expect(nextMovementId('era')).toBe('reflect')
    expect(nextMovementId('reflect')).toBe('bloom')
    expect(nextMovementId('bloom')).toBe(null)
  })
  it('getMovement returns null for an unknown id', () => {
    expect(getMovement('nope')).toBe(null)
  })
  it('leanLift carries 2 sub-rounds; SR2 commits at a lower (refining) gain', () => {
    const subs = getMovement('leanLift').subfaces
    expect(subs).toHaveLength(2)
    for (const s of subs) {
      expect(typeof s.prompt).toBe('string')
      expect(typeof s.leftLabel).toBe('string')
      expect(typeof s.rightLabel).toBe('string')
      expect(typeof s.gain).toBe('number')
    }
    expect(subs[1].gain).toBeLessThan(subs[0].gain) // SR2 refines, doesn't yank
  })
  it('listen carries 2 sub-rounds with top/bottom labels; SR2 refines', () => {
    const subs = getMovement('listen').subfaces
    expect(subs).toHaveLength(2)
    for (const s of subs) {
      expect(typeof s.prompt).toBe('string')
      expect(typeof s.topLabel).toBe('string')
      expect(typeof s.bottomLabel).toBe('string')
      expect(typeof s.gain).toBe('number')
    }
    expect(subs[1].gain).toBeLessThan(subs[0].gain)
  })
  it('every movement has ask: null (the on-screen cues carry the prompts; no agent)', () => {
    for (const id of MOVEMENT_ORDER) {
      expect(getMovement(id).ask).toBe(null)
    }
  })
})
