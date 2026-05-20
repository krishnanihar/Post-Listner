// Pure acoustic-parameter presets for the shared "room" that hosts both the
// Admirer conversation (intimate) and the Orchestra (expanded). roomAt(t)
// interpolates between them: t=0 intimate closed room, t=1 orchestra hall.
// The audio engine (Task 13) consumes these numbers; this module has no
// Web Audio dependency and is fully unit-tested.

export const INTIMATE = {
  reverbWet: 0.16,            // convolver send level — dry, close
  reflectionGain: 0.10,       // early-reflection bus gain
  reflectionDelayScale: 0.45, // multiplies base reflection delays — near walls
  directGain: 1.0,            // direct (un-reverbed) voice level
  dampingHz: 5200,            // master lowpass cutoff — slightly damped/close
}

export const EXPANDED = {
  reverbWet: 0.55,
  reflectionGain: 0.30,
  reflectionDelayScale: 1.0,  // full-size ~5x4x3m room
  directGain: 0.85,
  dampingHz: 9000,            // brighter, open
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

// Smoothstep so the room opens organically rather than linearly.
export function easeExpansion(t) {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

export function roomAt(t) {
  const e = easeExpansion(t)
  return {
    reverbWet:            lerp(INTIMATE.reverbWet, EXPANDED.reverbWet, e),
    reflectionGain:       lerp(INTIMATE.reflectionGain, EXPANDED.reflectionGain, e),
    reflectionDelayScale: lerp(INTIMATE.reflectionDelayScale, EXPANDED.reflectionDelayScale, e),
    directGain:           lerp(INTIMATE.directGain, EXPANDED.directGain, e),
    dampingHz:            lerp(INTIMATE.dampingHz, EXPANDED.dampingHz, e),
  }
}
