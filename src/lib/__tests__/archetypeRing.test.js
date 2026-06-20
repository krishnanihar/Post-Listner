import { describe, it, expect } from 'vitest'
import {
  archetypeRing, nearestArchetypeToYaw, archetypeAnchorVector, preloadDecision,
} from '../archetypeRing.js'
import { ARCHETYPES } from '../archetypes.js'

describe('archetypeRing', () => {
  const ring = archetypeRing()

  it('places every archetype once, spread across the frontal arc', () => {
    expect(ring.length).toBe(ARCHETYPES.length)
    const az = ring.map((r) => r.azimuthDeg)
    expect(Math.min(...az)).toBeCloseTo(-75, 6)
    expect(Math.max(...az)).toBeCloseTo(75, 6)
    expect(new Set(ring.map((r) => r.id)).size).toBe(ARCHETYPES.length)
  })

  it('orders cold→warm left→right (valence ascending with azimuth)', () => {
    const sorted = [...ring].sort((a, b) => a.azimuthDeg - b.azimuthDeg)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].anchor[1]).toBeGreaterThanOrEqual(sorted[i - 1].anchor[1])
    }
  })

  it('nearestArchetypeToYaw returns the closest world to where you face', () => {
    const left = [...ring].sort((a, b) => a.azimuthDeg - b.azimuthDeg)[0]
    const right = [...ring].sort((a, b) => b.azimuthDeg - a.azimuthDeg)[0]
    expect(nearestArchetypeToYaw(-75, ring)).toBe(left.id)
    expect(nearestArchetypeToYaw(75, ring)).toBe(right.id)
  })

  it('archetypeAnchorVector returns the signed centroid as {a,v,d}', () => {
    const sky = archetypeAnchorVector('sky-seeker')
    expect(sky).toMatchObject({ a: expect.any(Number), v: expect.any(Number), d: expect.any(Number) })
    expect(sky.v).toBeCloseTo(0.5, 6)
  })
})

describe('preloadDecision', () => {
  it('picks the nearest archetype and reports no change when stable', () => {
    const first = preloadDecision(null, { a: 0.9, v: 0.9, d: 0.9 })
    expect(first.archetypeId).toBe('sky-seeker')
    expect(first.changed).toBe(true) // null → something is a change
    const again = preloadDecision('sky-seeker', { a: 0.9, v: 0.9, d: 0.9 })
    expect(again).toEqual({ archetypeId: 'sky-seeker', changed: false })
  })
  it('reports a change when the vector moves to a new nearest archetype', () => {
    const d = preloadDecision('sky-seeker', { a: 0.6, v: -0.6, d: 0.1 })
    expect(d.archetypeId).toBe('quiet-insurgent')
    expect(d.changed).toBe(true)
  })
})
