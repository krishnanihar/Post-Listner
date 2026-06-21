import { describe, it, expect } from 'vitest'
import { isBrinkCrossing, LEAN_BRINK, LEAN_DEADZONE } from '../leanCommit.js'

describe('isBrinkCrossing', () => {
  it('fires the instant the balance crosses the brink moving outward (right)', () => {
    expect(isBrinkCrossing({ b: 0.6, prevB: 0.5 })).toBe(true)
  })
  it('fires crossing outward on the left (negative) side', () => {
    expect(isBrinkCrossing({ b: -0.6, prevB: -0.5 })).toBe(true)
  })
  it('does not fire below the brink', () => {
    expect(isBrinkCrossing({ b: 0.4, prevB: 0.2 })).toBe(false)
  })
  it('does not fire when retreating (moving back toward center)', () => {
    expect(isBrinkCrossing({ b: 0.6, prevB: 0.7 })).toBe(false)
  })
  it('does not fire when jitter sits on the threshold (no movement)', () => {
    expect(isBrinkCrossing({ b: 0.58, prevB: 0.58 })).toBe(false)
  })
  it('does not fire once already committed (fired guard)', () => {
    expect(isBrinkCrossing({ b: 0.9, prevB: 0.5, fired: true })).toBe(false)
  })
  it('does not fire when the previous frame was already past the brink (only the first crossing)', () => {
    expect(isBrinkCrossing({ b: 0.7, prevB: 0.6 })).toBe(false)
    expect(isBrinkCrossing({ b: -0.7, prevB: -0.6 })).toBe(false)
  })
  it('respects a custom brink', () => {
    expect(isBrinkCrossing({ b: 0.5, prevB: 0.3, brink: 0.45 })).toBe(true)
    expect(isBrinkCrossing({ b: 0.5, prevB: 0.3, brink: 0.62 })).toBe(false)
  })
  it('exposes sane constants', () => {
    expect(LEAN_BRINK).toBeGreaterThan(LEAN_DEADZONE)
    expect(LEAN_BRINK).toBeLessThan(1)
  })
})
