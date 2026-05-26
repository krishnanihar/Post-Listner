import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getFormationStage,
  advanceFormationStage,
  subscribeFormationStage,
  resetFormationStage,
} from '../formationStage.js'

afterEach(() => {
  resetFormationStage()
})

describe('formationStage', () => {
  it('starts at stage 0', () => {
    expect(getFormationStage()).toBe(0)
  })

  it('advances forward', () => {
    advanceFormationStage(1)
    expect(getFormationStage()).toBe(1)
    advanceFormationStage(2)
    expect(getFormationStage()).toBe(2)
  })

  it('never goes backward', () => {
    advanceFormationStage(2)
    advanceFormationStage(1)
    expect(getFormationStage()).toBe(2)
  })

  it('ignores repeats at the current stage', () => {
    const fn = vi.fn()
    subscribeFormationStage(fn)
    fn.mockClear()
    advanceFormationStage(0)
    expect(fn).not.toHaveBeenCalled()
  })

  it('immediately emits the current stage on subscribe', () => {
    advanceFormationStage(1)
    const fn = vi.fn()
    subscribeFormationStage(fn)
    expect(fn).toHaveBeenCalledWith(1)
  })

  it('notifies subscribers on advance', () => {
    const fn = vi.fn()
    const unsub = subscribeFormationStage(fn)
    fn.mockClear()
    advanceFormationStage(1)
    expect(fn).toHaveBeenCalledWith(1)
    unsub()
    advanceFormationStage(2)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('resets to 0 and notifies', () => {
    advanceFormationStage(2)
    const fn = vi.fn()
    subscribeFormationStage(fn)
    fn.mockClear()
    resetFormationStage()
    expect(getFormationStage()).toBe(0)
    expect(fn).toHaveBeenCalledWith(0)
  })

  it('resetFormationStage at 0 does not notify', () => {
    const fn = vi.fn()
    subscribeFormationStage(fn)
    fn.mockClear()
    resetFormationStage()
    expect(fn).not.toHaveBeenCalled()
  })
})
