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
  // The `ask` fields were all null while the spoken-cue path was unbuilt (the
  // on-screen cues carried every prompt). They now carry the Prompter's spoken
  // invitation for the gesture beats — see lib/prompterScript.js, which owns
  // the wording, and prompterScript.test.js for the copy invariants.
  it('gives every gesture beat a non-empty spoken ask', () => {
    for (const id of ['leanLift', 'listen', 'rise', 'face', 'era']) {
      const ask = getMovement(id).ask
      expect(typeof ask, id).toBe('string')
      expect(ask.trim().length, id).toBeGreaterThan(0)
    }
  })

  it('leaves arrival, reflect and bloom with ask: null', () => {
    for (const id of ['arrival', 'reflect', 'bloom']) {
      expect(getMovement(id).ask, id).toBe(null)
    }
  })

  it('declares an ask for every movement or explicitly null — never undefined', () => {
    // useAttunementScore guards on `m?.ask`, so an undefined field would read
    // as "silent" by accident rather than by decision.
    for (const id of MOVEMENT_ORDER) {
      expect(getMovement(id), id).toHaveProperty('ask')
      expect(getMovement(id).ask, id).not.toBeUndefined()
    }
  })
})
