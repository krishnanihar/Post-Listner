import { describe, it, expect, beforeEach } from 'vitest'
import {
  setScene,
  replaceScene,
  getScene,
  strike,
  getStrikes,
  pruneStrikes,
  openHall,
  pushTraceStroke,
  getTrace,
  resetTrace,
  subscribeWorld,
  getWorldState,
  resetWorld,
  tipPool,
  setLiveBreadth,
} from '../worldStore.js'

describe('worldStore', () => {
  beforeEach(() => { resetWorld() })

  it('starts at a neutral resting scene with no strikes or trace', () => {
    const { scene, strikes, trace } = getWorldState()
    expect(scene.breadth).toBe(0)
    expect(strikes).toEqual([])
    expect(trace).toEqual([])
  })

  it('setScene merges partials', () => {
    setScene({ warmth: 0.2 })
    setScene({ breadth: 0.7 })
    const s = getScene()
    expect(s.warmth).toBe(0.2)
    expect(s.breadth).toBe(0.7)
  })

  it('replaceScene sets the whole scene', () => {
    setScene({ warmth: 0.9 })
    replaceScene({ warmth: 0.1, breadth: 0.5 })
    const s = getScene()
    expect(s.warmth).toBe(0.1)
    expect(s.breadth).toBe(0.5)
  })

  it('openHall sets breadth', () => {
    openHall(0.4)
    expect(getScene().breadth).toBe(0.4)
    openHall(5)
    expect(getScene().breadth).toBe(1) // clamped
  })

  it('strike enqueues rings and clamps inputs', () => {
    strike(0.3, 0.6, 0.8, 1000)
    const s = getStrikes()
    expect(s.length).toBe(1)
    expect(s[0]).toMatchObject({ x: 0.3, y: 0.6, intensity: 0.8, start: 1000 })
    strike(5, -1, 9, 1010) // clamped
    expect(getStrikes()[1]).toMatchObject({ x: 1, y: 0, intensity: 1 })
  })

  it('strike ignores calls with a missing or non-finite start (no dead epoch-0 strike)', () => {
    strike(0.5, 0.5, 0.5) // start omitted
    strike(0.5, 0.5, 0.5, undefined)
    strike(0.5, 0.5, 0.5, NaN)
    strike(0.5, 0.5, 0.5, Infinity)
    expect(getStrikes().length).toBe(0)
  })

  it('strike list is bounded to the ring size', () => {
    for (let i = 0; i < 40; i++) strike(0.5, 0.5, 0.5, i)
    expect(getStrikes().length).toBeLessThanOrEqual(16)
  })

  it('strike compacts the overflow in place (same array reference)', () => {
    strike(0.5, 0.5, 0.5, 0)
    const ref = getStrikes()
    for (let i = 1; i < 40; i++) strike(0.5, 0.5, 0.5, i)
    expect(getStrikes()).toBe(ref) // same array object, not a reassigned slice
    expect(ref.length).toBeLessThanOrEqual(16)
  })

  it('pruneStrikes drops strikes older than the window', () => {
    strike(0.5, 0.5, 0.5, 1000)
    strike(0.5, 0.5, 0.5, 4000)
    pruneStrikes(4200, 3600) // 4200-1000=3200<3600 keep both? 4200-1000=3200 keep, 4200-4000=200 keep
    expect(getStrikes().length).toBe(2)
    pruneStrikes(5000, 900) // 5000-1000=4000 drop, 5000-4000=1000 drop
    expect(getStrikes().length).toBe(0)
  })

  it('accumulates trace strokes and survives until reset', () => {
    pushTraceStroke({ x: 0.2, y: 0.3, size: 0.6, kind: 'lean', beat: 'leanLift' })
    pushTraceStroke({ x: 0.7, y: 0.1, kind: 'strike', beat: 'rise' })
    const t = getTrace()
    expect(t.length).toBe(2)
    expect(t[0]).toMatchObject({ x: 0.2, y: 0.3, size: 0.6, kind: 'lean', beat: 'leanLift' })
    expect(t[1].size).toBe(0.5) // default
  })

  it('resetTrace clears only the trace', () => {
    setScene({ warmth: 0.4 })
    pushTraceStroke({ x: 0.1, y: 0.1 })
    resetTrace()
    expect(getTrace()).toEqual([])
    expect(getScene().warmth).toBe(0.4) // scene untouched
  })

  it('resetWorld clears everything', () => {
    setScene({ breadth: 0.9 })
    strike(0.5, 0.5, 0.5, 1)
    pushTraceStroke({ x: 0.1, y: 0.1 })
    resetWorld()
    const { scene, strikes, trace } = getWorldState()
    expect(scene.breadth).toBe(0)
    expect(strikes).toEqual([])
    expect(trace).toEqual([])
  })

  it('notifies subscribers on subscribe and on change, with no payload (pull via getWorldState)', () => {
    const calls = []
    const unsub = subscribeWorld((...args) => {
      calls.push(args.length)
      return getWorldState().scene.breadth
    })
    expect(calls).toEqual([0]) // initial call, no payload
    openHall(0.5)
    expect(getWorldState().scene.breadth).toBe(0.5)
    expect(calls).toEqual([0, 0]) // still no payload
    unsub()
    openHall(0.9)
    expect(calls).toEqual([0, 0]) // no longer receiving
  })

  it('tipPool sets a clamped -1..1 live pool nudge without notifying subscribers', () => {
    const seen = []
    const unsub = subscribeWorld(() => seen.push(1))
    const before = seen.length
    tipPool(0.12)
    expect(getWorldState().poolTip).toBeCloseTo(0.12, 6)
    tipPool(5) // clamped
    expect(getWorldState().poolTip).toBe(1)
    tipPool(-5) // clamped
    expect(getWorldState().poolTip).toBe(-1)
    tipPool(NaN) // non-finite → 0
    expect(getWorldState().poolTip).toBe(0)
    expect(seen.length).toBe(before) // no notify
    unsub()
  })

  it('setLiveBreadth overrides breadth 0..1 or releases with null, without notifying', () => {
    const seen = []
    const unsub = subscribeWorld(() => seen.push(1))
    const before = seen.length
    setLiveBreadth(0.3)
    expect(getWorldState().liveBreadth).toBeCloseTo(0.3, 6)
    setLiveBreadth(5) // clamped
    expect(getWorldState().liveBreadth).toBe(1)
    setLiveBreadth(null)
    expect(getWorldState().liveBreadth).toBe(null)
    expect(seen.length).toBe(before) // no notify
    unsub()
  })

  it('resetWorld releases the live channels', () => {
    tipPool(0.5)
    setLiveBreadth(0.7)
    resetWorld()
    expect(getWorldState().poolTip).toBe(0)
    expect(getWorldState().liveBreadth).toBe(null)
  })
})
