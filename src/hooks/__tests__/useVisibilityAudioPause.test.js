import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVisibilityAudioPause } from '../useVisibilityAudioPause.js'

function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useVisibilityAudioPause', () => {
  afterEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  })

  it('suspends when hidden and resumes when visible', () => {
    const ctx = {
      state: 'running',
      suspend: vi.fn(() => { ctx.state = 'suspended' }),
      resume: vi.fn(() => { ctx.state = 'running' }),
    }
    renderHook(() => useVisibilityAudioPause(() => ctx, true))
    setHidden(true)
    expect(ctx.suspend).toHaveBeenCalled()
    setHidden(false)
    expect(ctx.resume).toHaveBeenCalled()
  })

  it('no-ops when the context is null', () => {
    renderHook(() => useVisibilityAudioPause(() => null, true))
    expect(() => setHidden(true)).not.toThrow()
  })

  it('does nothing when disabled', () => {
    const ctx = { state: 'running', suspend: vi.fn(), resume: vi.fn() }
    renderHook(() => useVisibilityAudioPause(() => ctx, false))
    setHidden(true)
    expect(ctx.suspend).not.toHaveBeenCalled()
  })
})
