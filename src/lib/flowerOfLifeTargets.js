// Particle targets along the 7-circle flower-of-life that the
// AdmirerScene3D's MiddleShaderPlane draws.
//
// Geometry: one center circle + 6 surrounding circles at 60° intervals,
// each touching the center (inter-center distance = radius). Same pattern
// as MiddleShaderPlane's FLOWER_CENTERS.
//
// Output coords are in the ±50 origin-centered space the particle physics
// expects (matching glyphRasterizer's halfExtent). LATTICE_R is the circle
// radius IN THAT SPACE — sized so the flower fits comfortably inside the
// viewport and visually aligns with the shader-rendered flower it forms into.

const SIN_60 = 0.8660254038
const LATTICE_R = 10

export const FLOWER_CENTERS = [
  [0, 0],
  [LATTICE_R, 0],
  [LATTICE_R * 0.5, LATTICE_R * SIN_60],
  [-LATTICE_R * 0.5, LATTICE_R * SIN_60],
  [-LATTICE_R, 0],
  [-LATTICE_R * 0.5, -LATTICE_R * SIN_60],
  [LATTICE_R * 0.5, -LATTICE_R * SIN_60],
]

export const FLOWER_LATTICE_R = LATTICE_R
// Outermost reach of a particle on a peripheral circle outline: 2R from origin.
export const FLOWER_EXTENT = LATTICE_R * 2

// Pure: build `count` target positions distributed evenly along the 7 circle
// outlines. Points per circle differ by at most 1; each circle gets a small
// phase offset so adjacent circles don't share a visible seam at angle 0.
export function buildFlowerOfLifeTargets(count, rand = Math.random) {
  const targets = []
  const perCircle = Math.floor(count / FLOWER_CENTERS.length)
  const remainder = count - perCircle * FLOWER_CENTERS.length
  for (let i = 0; i < FLOWER_CENTERS.length; i++) {
    const [cx, cy] = FLOWER_CENTERS[i]
    const n = perCircle + (i < remainder ? 1 : 0)
    // Golden-ratio phase per circle so the seams are scattered.
    const phase = i * 0.618034 * Math.PI * 2
    for (let j = 0; j < n; j++) {
      // Tiny per-point jitter so the outline doesn't look mechanically
      // sampled. Jitter is much smaller than LINE_WIDTH so the form is
      // unmistakably circle-outlines.
      const jitter = (rand() - 0.5) * 0.2
      const a = (j / n) * Math.PI * 2 + phase
      targets.push({
        x: cx + Math.cos(a) * (LATTICE_R + jitter),
        y: cy + Math.sin(a) * (LATTICE_R + jitter),
      })
    }
  }
  return targets
}
