// Respect the OS "reduce motion" accessibility setting (Ship-Blockers §4 a11y
// floor). Pure read of the media query, guarded for environments without
// matchMedia (returns false). Used to gate AMBIENT (non-essential) motion;
// essential interactive motion (Orchestra conducting) is left alone per
// WCAG 2.5.4. Mirrors the useDeviceMode matchMedia idiom.

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
