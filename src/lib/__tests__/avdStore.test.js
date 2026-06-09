import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAvd,
  getTurnCount,
  commitTurn,
  setAvd,
  subscribeAvd,
  resetAvd,
} from '../avdStore.js'

describe('avdStore', () => {
  beforeEach(() => { resetAvd() })

  it('starts neutral at (0,0,0) with zero turns', () => {
    expect(getAvd()).toEqual({ a: 0, v: 0, d: 0 })
    expect(getTurnCount()).toBe(0)
  })

  it('commitTurn steps toward target (cold-start eta) and increments the turn count', () => {
    commitTurn({ a: 1, v: -1, d: 1 })
    const s = getAvd()
    expect(s.a).toBeCloseTo(0.35, 6)
    expect(s.v).toBeCloseTo(-0.35, 6)
    expect(s.d).toBeCloseTo(0.21, 6)
    expect(getTurnCount()).toBe(1)
  })

  it('uses the steady eta once past the cold-start turns', () => {
    for (let i = 0; i < 3; i++) commitTurn({ a: 0, v: 0, d: 0 })
    const before = getAvd().a
    commitTurn({ a: 1, v: 0, d: 0 })
    expect(getAvd().a - before).toBeCloseTo(0.18, 6)
  })

  it('setAvd writes the vector directly and clamps to [-1,1]', () => {
    setAvd({ a: 5, v: -5, d: 0.3 })
    expect(getAvd()).toEqual({ a: 1, v: -1, d: 0.3 })
  })

  it('setAvd leaves unspecified axes unchanged', () => {
    setAvd({ a: 0.4 })
    expect(getAvd()).toEqual({ a: 0.4, v: 0, d: 0 })
  })

  it('notifies subscribers immediately and on every change', () => {
    const calls = []
    const unsub = subscribeAvd((v) => calls.push(v))
    setAvd({ a: 0.2 })
    expect(calls[0]).toEqual({ a: 0, v: 0, d: 0 })
    expect(calls[1]).toEqual({ a: 0.2, v: 0, d: 0 })
    unsub()
  })

  it('resetAvd returns to neutral, zeroes turns, and notifies', () => {
    setAvd({ a: 0.5 })
    commitTurn({ a: 1, v: 1, d: 1 })
    const listener = vi.fn()
    const unsub = subscribeAvd(listener)
    listener.mockClear()
    resetAvd()
    expect(getAvd()).toEqual({ a: 0, v: 0, d: 0 })
    expect(getTurnCount()).toBe(0)
    expect(listener).toHaveBeenCalledWith({ a: 0, v: 0, d: 0 })
    unsub()
  })

  it('unsubscribe stops further notifications', () => {
    const listener = vi.fn()
    const unsub = subscribeAvd(listener)
    listener.mockClear()
    unsub()
    setAvd({ a: 0.9 })
    expect(listener).not.toHaveBeenCalled()
  })

  it('setAvd ignores non-finite values, keeping the current axis', () => {
    setAvd({ a: 0.5 })
    setAvd({ a: NaN, v: undefined, d: 'x' })
    expect(getAvd()).toEqual({ a: 0.5, v: 0, d: 0 })
  })

  it('commitTurn returns the new vector', () => {
    const returned = commitTurn({ a: 1, v: 0, d: 0 })
    expect(returned).toEqual(getAvd())
  })

  it('commitTurn with default gain/confidence matches the plain EWMA step', () => {
    commitTurn({ a: 1, v: 0, d: 0 })
    expect(getAvd().a).toBeCloseTo(0.35, 6) // cold-start eta, factor 1
  })

  it('gain scales the step down', () => {
    commitTurn({ a: 1, v: 0, d: 0 }, { gain: 0.3 })
    expect(getAvd().a).toBeCloseTo(0.35 * 0.3, 6) // 0.105
  })

  it('confidence and gain multiply', () => {
    commitTurn({ a: 1, v: 0, d: 0 }, { confidence: 0.5, gain: 0.8 })
    expect(getAvd().a).toBeCloseTo(0.35 * 0.4, 6) // factor = 0.5*0.8 = 0.4 → 0.14
  })
})
