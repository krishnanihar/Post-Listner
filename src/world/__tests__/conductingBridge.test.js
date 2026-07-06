import { describe, it, expect, beforeEach } from 'vitest'
import {
  pushConducting,
  setBloom,
  setFalter,
  activateConducting,
  deactivateConducting,
  getConducting,
} from '../conductingBridge.js'

describe('conductingBridge', () => {
  beforeEach(() => {
    deactivateConducting()
    // reset fields via a neutral push
    pushConducting({ pan: 0.5, filterNorm: 0.5, gestureGain: 0, yaw: 0, articulation: 0, downbeat: { fired: false } })
    setBloom(0)
    setFalter(0)
  })

  it('returns the SAME object each call (zero alloc)', () => {
    expect(getConducting()).toBe(getConducting())
  })

  it('mutates fields in place from a gesture', () => {
    pushConducting({ pan: 0.8, filterNorm: 0.2, gestureGain: 0.6, yaw: 90, articulation: 0.3, downbeat: { fired: false } })
    const s = getConducting()
    expect(s.pan).toBe(0.8)
    expect(s.filterNorm).toBe(0.2)
    expect(s.glow).toBe(0.6)
    expect(s.yaw).toBe(90)
    expect(s.articulation).toBe(0.3)
  })

  it('finite-guards bad gesture fields', () => {
    pushConducting({ pan: NaN, filterNorm: undefined, gestureGain: Infinity, yaw: null, downbeat: null })
    const s = getConducting()
    expect(s.pan).toBe(0.5)
    expect(s.filterNorm).toBe(0.5)
    expect(s.glow).toBe(0)
    expect(s.yaw).toBe(0)
  })

  it('increments downbeatSeq only on a fired downbeat', () => {
    const before = getConducting().downbeatSeq
    pushConducting({ pan: 0.5, filterNorm: 0.5, gestureGain: 0, downbeat: { fired: false } })
    expect(getConducting().downbeatSeq).toBe(before)
    pushConducting({ pan: 0.5, filterNorm: 0.5, gestureGain: 0, downbeat: { fired: true, intensity: 0.7 } })
    expect(getConducting().downbeatSeq).toBe(before + 1)
    expect(getConducting().downbeatIntensity).toBe(0.7)
  })

  it('clamps bloom and falter into [0,1]', () => {
    setBloom(5)
    expect(getConducting().breadth).toBe(1)
    setBloom(-2)
    expect(getConducting().breadth).toBe(0)
    setFalter(9)
    expect(getConducting().falter).toBe(1)
  })

  it('activate resets the transient state and sets active', () => {
    setBloom(0.9)
    setFalter(0.5)
    activateConducting()
    const s = getConducting()
    expect(s.active).toBe(true)
    expect(s.breadth).toBe(0)
    expect(s.falter).toBe(0)
    expect(s.downbeatSeq).toBe(0)
  })

  it('deactivate clears active', () => {
    activateConducting()
    deactivateConducting()
    expect(getConducting().active).toBe(false)
  })

  it('ignores a null gesture', () => {
    pushConducting({ pan: 0.7, filterNorm: 0.3, gestureGain: 0.4, downbeat: { fired: false } })
    pushConducting(null)
    expect(getConducting().pan).toBe(0.7) // unchanged
  })
})
