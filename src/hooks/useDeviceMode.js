import { useState, useEffect } from 'react'

/**
 * useDeviceMode — return 'mobile' or 'desktop' based on input modality.
 *
 * The `(pointer: coarse)` media query is the modern, reliable way to
 * detect touch-first devices. It correctly classifies iPhones/iPads as
 * mobile and laptops/desktops as desktop, including hybrid devices like
 * Surface tablets in tablet-mode (mobile) vs laptop-mode (desktop).
 *
 * Updates if the input modality changes (rare — only Surface-style hybrids).
 */
export function useDeviceMode() {
  const [mode, setMode] = useState(() => detect())

  useEffect(() => {
    if (!window.matchMedia) return  // defensive — SSR or exotic test envs
    const mq = window.matchMedia('(pointer: coarse)')
    const handler = () => setMode(mq.matches ? 'mobile' : 'desktop')
    handler()  // sync once on mount in case SSR returned stale value
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return mode
}

function detect() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop'
  return window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop'
}
