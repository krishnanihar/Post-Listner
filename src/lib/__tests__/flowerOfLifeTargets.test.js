import { describe, expect, it } from 'vitest'
import {
  FLOWER_CENTERS,
  FLOWER_LATTICE_R,
  FLOWER_EXTENT,
  buildFlowerOfLifeTargets,
} from '../flowerOfLifeTargets.js'

describe('flowerOfLifeTargets', () => {
  it('exposes 7 circle centers matching the shader hex pattern', () => {
    expect(FLOWER_CENTERS).toHaveLength(7)
    expect(FLOWER_CENTERS[0]).toEqual([0, 0])
    for (let i = 1; i < 7; i++) {
      const [x, y] = FLOWER_CENTERS[i]
      const d = Math.sqrt(x * x + y * y)
      expect(d).toBeCloseTo(FLOWER_LATTICE_R, 5)
    }
  })

  it('FLOWER_EXTENT equals 2 * LATTICE_R', () => {
    expect(FLOWER_EXTENT).toBeCloseTo(FLOWER_LATTICE_R * 2, 5)
  })

  it('builds exactly `count` targets', () => {
    const ts = buildFlowerOfLifeTargets(800, () => 0.5)
    expect(ts).toHaveLength(800)
  })

  it('distributes points across all 7 circles', () => {
    const ts = buildFlowerOfLifeTargets(700, () => 0.5)
    const counts = FLOWER_CENTERS.map(([cx, cy]) => {
      let n = 0
      for (const p of ts) {
        const dx = p.x - cx
        const dy = p.y - cy
        const d = Math.sqrt(dx * dx + dy * dy)
        if (Math.abs(d - FLOWER_LATTICE_R) < 0.5) n++
      }
      return n
    })
    counts.forEach((c) => expect(c).toBeGreaterThanOrEqual(90))
  })

  it('targets lie near a circle outline (within jitter band)', () => {
    const ts = buildFlowerOfLifeTargets(800, () => 0.5)
    for (const p of ts) {
      const onSomeCircle = FLOWER_CENTERS.some(([cx, cy]) => {
        const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
        return Math.abs(d - FLOWER_LATTICE_R) < 0.2
      })
      expect(onSomeCircle).toBe(true)
    }
  })

  it('is deterministic for a given rand', () => {
    const rand = () => 0.5
    const a = buildFlowerOfLifeTargets(50, rand)
    const b = buildFlowerOfLifeTargets(50, rand)
    expect(a).toEqual(b)
  })
})
