import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import LeanLift from '../LeanLift.jsx'

// Regression test for the B1 ship-blocker (audit 2026-07-03): leanLift must
// never permanently stall when no phone-motion brink-crossing ever occurs —
// orientation permission denied on iOS, or a device with no sensors. Before the
// fix, leanLift/listen (unlike rise/face) had no safety-net timeout, so a single
// "Don't Allow" tap dead-ended the whole experience before the Orchestra.
//
// We fake ONLY setTimeout/clearTimeout, leaving requestAnimationFrame real so
// the gesture rAF loop stays inert during our synchronous timer advance (with no
// motion, live.pan holds at 0.5 and the brink is never crossed).

describe('LeanLift — safety-net (B1 dead-end fix)', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('force-commits the last sub-round after the safety window when the brink is never crossed', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    const live = { current: { pan: 0.5, filterNorm: 0.5, relYaw: 0, swell: 0, downbeatCount: 0 } }
    const onCommit = vi.fn()
    const onAdvance = vi.fn()
    const subfaces = [
      { prompt: 'a', leftLabel: 'l', rightLabel: 'r', gain: 0.8 },
      { prompt: 'b', leftLabel: 'l', rightLabel: 'r', gain: 0.4 },
    ]

    render(
      <LeanLift
        live={live}
        onCommit={onCommit}
        onAdvance={onAdvance}
        committed={false}
        subfaces={subfaces}
      />,
    )

    // Before the safety window elapses, nothing is committed.
    vi.advanceTimersByTime(19000)
    expect(onCommit).not.toHaveBeenCalled()

    // After the 20s backstop it force-commits the LAST sub-round (index 1) with
    // the current neutral read — so the reducer advances and the arc can't hang.
    vi.advanceTimersByTime(1500)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(0.5, subfaces.length - 1)
  })
})
