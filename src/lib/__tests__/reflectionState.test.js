import { describe, it, expect, beforeEach } from 'vitest'
import {
  setWarmth, setDepth, setEnergy, setWorld, getReflection, resetReflection,
  warmthBucket, depthBucket, energyBucket,
} from '../reflectionState.js'

describe('reflectionState', () => {
  beforeEach(() => resetReflection())

  it('captures and returns the per-beat buckets', () => {
    setWarmth('warm'); setDepth('inward'); setEnergy('low'); setWorld('hearth-keeper')
    expect(getReflection()).toEqual({
      warmth: 'warm', depth: 'inward', energy: 'low', world: 'hearth-keeper',
    })
  })

  it('reset clears everything', () => {
    setWarmth('cold'); setWorld('sky-seeker')
    resetReflection()
    expect(getReflection()).toEqual({ warmth: null, depth: null, energy: null, world: null })
  })

  it('warmthBucket: v>=0 warm, v<0 cold', () => {
    expect(warmthBucket(0.6)).toBe('warm')
    expect(warmthBucket(-0.6)).toBe('cold')
    expect(warmthBucket(0)).toBe('warm')
  })

  it('depthBucket: d>=0 inward (forward/dark), d<0 open', () => {
    expect(depthBucket(0.6)).toBe('inward')
    expect(depthBucket(-0.6)).toBe('open')
  })

  it('energyBucket: three swell-magnitude bands', () => {
    expect(energyBucket(0.2)).toBe('low')
    expect(energyBucket(0.45)).toBe('high-held')
    expect(energyBucket(0.8)).toBe('high-rode')
  })
})
