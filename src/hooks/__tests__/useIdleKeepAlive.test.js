import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIdleKeepAlive } from '../useIdleKeepAlive.js'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('useIdleKeepAlive', () => {
  it('does not ping when disabled', () => {
    const ping = vi.fn()
    renderHook(() => useIdleKeepAlive({ enabled: false, intervalMs: 100, ping }))
    vi.advanceTimersByTime(500)
    expect(ping).not.toHaveBeenCalled()
  })

  it('pings at the configured interval while enabled', () => {
    const ping = vi.fn()
    renderHook(() => useIdleKeepAlive({ enabled: true, intervalMs: 100, ping }))
    expect(ping).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(ping).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(ping).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(300)
    expect(ping).toHaveBeenCalledTimes(5)
  })

  it('stops pinging when toggled off', () => {
    const ping = vi.fn()
    const { rerender } = renderHook(
      ({ enabled }) => useIdleKeepAlive({ enabled, intervalMs: 100, ping }),
      { initialProps: { enabled: true } }
    )
    vi.advanceTimersByTime(200)
    expect(ping).toHaveBeenCalledTimes(2)
    rerender({ enabled: false })
    vi.advanceTimersByTime(500)
    expect(ping).toHaveBeenCalledTimes(2)
  })

  it('cleans up timer on unmount', () => {
    const ping = vi.fn()
    const { unmount } = renderHook(() => useIdleKeepAlive({ enabled: true, intervalMs: 100, ping }))
    vi.advanceTimersByTime(150)
    expect(ping).toHaveBeenCalledTimes(1)
    unmount()
    vi.advanceTimersByTime(500)
    expect(ping).toHaveBeenCalledTimes(1)
  })
})
