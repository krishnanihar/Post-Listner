import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDeviceMode } from '../useDeviceMode.js'

function mockMatchMedia(matches) {
  return vi.fn((query) => ({
    matches: query.includes('coarse') ? matches : !matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('useDeviceMode', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns "mobile" when pointer is coarse', () => {
    window.matchMedia = mockMatchMedia(true)
    const { result } = renderHook(() => useDeviceMode())
    expect(result.current).toBe('mobile')
  })

  it('returns "desktop" when pointer is fine', () => {
    window.matchMedia = mockMatchMedia(false)
    const { result } = renderHook(() => useDeviceMode())
    expect(result.current).toBe('desktop')
  })
})
