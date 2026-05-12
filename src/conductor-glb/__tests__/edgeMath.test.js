import { describe, it, expect } from 'vitest'
import { pointToSegmentDistance } from '../edgeMath.js'

describe('pointToSegmentDistance', () => {
  it('returns 0 for a point on the segment', () => {
    const d = pointToSegmentDistance(50, 50, 0, 0, 100, 100)
    expect(d).toBeCloseTo(0, 5)
  })

  it('returns perpendicular distance for a point off the middle of a horizontal segment', () => {
    const d = pointToSegmentDistance(50, 30, 0, 0, 100, 0)
    expect(d).toBeCloseTo(30, 5)
  })

  it('returns endpoint distance when projection falls outside the segment', () => {
    const d = pointToSegmentDistance(-30, 0, 0, 0, 100, 0)
    expect(d).toBeCloseTo(30, 5)
  })

  it('handles a zero-length segment without dividing by zero', () => {
    const d = pointToSegmentDistance(3, 4, 10, 10, 10, 10)
    expect(d).toBeCloseTo(Math.hypot(7, 6), 5)
  })
})
