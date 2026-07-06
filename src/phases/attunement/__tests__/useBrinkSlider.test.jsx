import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useBrinkSlider, SAFETY_MS } from '../../../hooks/useBrinkSlider.js'

// The brink-slider state machine is shared by LeanLift ('pan') and Listen
// ('filterNorm'). LeanLift.test.jsx exercises it through the LeanLift component;
// these cover the hook directly on both axes.
//
// We fake ONLY setTimeout/clearTimeout, leaving requestAnimationFrame real so
// the gesture rAF loop stays inert during a synchronous timer advance (with no
// motion the axis holds at 0.5 and the brink is never crossed).

describe('useBrinkSlider', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('force-commits the last sub-round with the read axis value after the safety window', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    const live = { current: { pan: 0.5, filterNorm: 0.5 } }
    const onCommit = vi.fn()
    const onAdvance = vi.fn()

    renderHook(() =>
      useBrinkSlider({
        live,
        axisKey: 'pan',
        onCommit,
        onAdvance,
        committed: false,
        roundsLength: 2,
      }),
    )

    // Nothing commits before the backstop elapses.
    vi.advanceTimersByTime(SAFETY_MS - 1000)
    expect(onCommit).not.toHaveBeenCalled()

    // After the backstop it force-commits the LAST sub-round with the current
    // neutral read of the named axis.
    vi.advanceTimersByTime(1500)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(0.5, 1)
  })

  it('reads the axisKey it is given (filterNorm)', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    const live = { current: { pan: 0.5, filterNorm: 0.5 } }
    const onCommit = vi.fn()
    const onAdvance = vi.fn()

    renderHook(() =>
      useBrinkSlider({
        live,
        axisKey: 'filterNorm',
        onCommit,
        onAdvance,
        committed: false,
        roundsLength: 1,
      }),
    )

    vi.advanceTimersByTime(SAFETY_MS + 500)
    expect(onCommit).toHaveBeenCalledWith(0.5, 0)
  })

  it('advances after 1100ms once committed flips true', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    const live = { current: { pan: 0.5, filterNorm: 0.5 } }
    const onCommit = vi.fn()
    const onAdvance = vi.fn()

    const { rerender } = renderHook(
      ({ committed }) =>
        useBrinkSlider({
          live,
          axisKey: 'pan',
          onCommit,
          onAdvance,
          committed,
          roundsLength: 1,
        }),
      { initialProps: { committed: false } },
    )

    // Not committed yet — no advance scheduled.
    vi.advanceTimersByTime(2000)
    expect(onAdvance).not.toHaveBeenCalled()

    rerender({ committed: true })
    vi.advanceTimersByTime(1099)
    expect(onAdvance).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })
})
