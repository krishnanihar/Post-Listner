import { describe, it, expect } from 'vitest'
import { stepParticle, PHYSICS } from '../glyphPhysics.js'

// Build a particle in a known state. Defaults to un-released, no velocity,
// at the origin, target far on the +x axis, scatter at origin too.
function p(overrides = {}) {
  return {
    x: 0, y: 0,
    vx: 0, vy: 0,
    tx: 100, ty: 0,
    sx: 0, sy: 0,
    releasedAt: 0,
    settledAt: 0,
    ...overrides,
  }
}

describe('stepParticle', () => {
  const dt = 1 / 60 // 16.67ms
  const zeroForce = { x: 0, y: 0 }
  const now = 1000

  it('does not move an un-released particle at scatter with no force', () => {
    const particle = p({ x: 5, y: 5, sx: 5, sy: 5 }) // already at scatter
    stepParticle(particle, dt, zeroForce, now)
    expect(particle.x).toBeCloseTo(5, 4)
    expect(particle.y).toBeCloseTo(5, 4)
    expect(particle.vx).toBeCloseTo(0, 4)
    expect(particle.vy).toBeCloseTo(0, 4)
  })

  it('pushes an un-released particle in the direction of motion force', () => {
    const particle = p({ sx: 0, sy: 0 })
    stepParticle(particle, dt, { x: 10, y: 0 }, now)
    expect(particle.vx).toBeGreaterThan(0)
    expect(particle.x).toBeGreaterThan(0)
    expect(particle.y).toBeCloseTo(0, 4)
  })

  it('spring-pulls a released particle toward its target', () => {
    const particle = p({ releasedAt: now - 50, tx: 100, ty: 0 })
    stepParticle(particle, dt, zeroForce, now)
    // After one frame the spring force points toward +x.
    expect(particle.vx).toBeGreaterThan(0)
    expect(particle.x).toBeGreaterThan(0)
  })

  it('spring-pulls an un-released particle toward its scatter', () => {
    // Displaced from scatter (10,10) toward origin. Spring should pull back.
    const particle = p({ x: 0, y: 0, sx: 10, sy: 10 })
    stepParticle(particle, dt, zeroForce, now)
    expect(particle.vx).toBeGreaterThan(0)
    expect(particle.vy).toBeGreaterThan(0)
  })

  it('a settled particle responds weakly to motion force (~10x lower)', () => {
    // Two identical particles, one settled, one mid-release. Same motion force.
    // The settled one's velocity gain should be roughly 10x smaller.
    const force = { x: 100, y: 0 }
    const released = p({ releasedAt: now - 50, x: 100, y: 0, tx: 100, ty: 0 }) // at target, freshly released
    const settled  = p({ releasedAt: now - 5000, settledAt: now - 3000, x: 100, y: 0, tx: 100, ty: 0 })
    stepParticle(released, dt, force, now)
    stepParticle(settled, dt, force, now)
    // The settled particle's lateral velocity should be much smaller.
    expect(Math.abs(settled.vx)).toBeLessThan(Math.abs(released.vx) / 5)
  })

  it('damping reduces an existing velocity each step toward zero', () => {
    const particle = p({ vx: 50, vy: 0, x: 0, y: 0, sx: 0, sy: 0 })
    const before = particle.vx
    stepParticle(particle, dt, zeroForce, now)
    expect(particle.vx).toBeLessThan(before)
    expect(particle.vx).toBeGreaterThan(0) // still some motion, just damped
  })

  it('produces no NaN or infinity values for typical inputs', () => {
    const particle = p({ vx: 1, vy: -2, x: 3, y: -4, tx: 50, ty: 60, releasedAt: now - 100 })
    for (let i = 0; i < 60; i++) {
      stepParticle(particle, dt, { x: Math.sin(i), y: Math.cos(i) }, now + i * 16)
    }
    expect(Number.isFinite(particle.x)).toBe(true)
    expect(Number.isFinite(particle.y)).toBe(true)
    expect(Number.isFinite(particle.vx)).toBe(true)
    expect(Number.isFinite(particle.vy)).toBe(true)
  })

  it('exports PHYSICS constants', () => {
    expect(typeof PHYSICS.SPRING_RELEASED).toBe('number')
    expect(typeof PHYSICS.SPRING_UNRELEASED).toBe('number')
    expect(typeof PHYSICS.DAMPING).toBe('number')
    expect(typeof PHYSICS.MOTION_FORCE).toBe('number')
    expect(typeof PHYSICS.SETTLED_MOTION_COUPLING).toBe('number')
    expect(PHYSICS.SETTLED_MOTION_COUPLING).toBeLessThan(0.5) // weak
  })
})
