import { describe, it, expect } from 'vitest'
import { coarsenLocation, regionToLatLng, jitterInCell } from '../geo.js'

describe('coarsenLocation', () => {
  it('snaps a coordinate to the 1° grid as a "lat,lng" string', () => {
    expect(coarsenLocation(40.71, -74.01)).toBe('41,-74')
    expect(coarsenLocation(-23.55, -46.63)).toBe('-24,-47')
  })
  it('returns null for non-finite input', () => {
    expect(coarsenLocation(NaN, 10)).toBeNull()
    expect(coarsenLocation(10, undefined)).toBeNull()
  })
})

describe('regionToLatLng', () => {
  it('round-trips a coarsened region string', () => {
    expect(regionToLatLng('41,-74')).toEqual({ lat: 41, lng: -74 })
  })
  it('returns null for malformed input', () => {
    expect(regionToLatLng('')).toBeNull()
    expect(regionToLatLng('41')).toBeNull()
    expect(regionToLatLng('a,b')).toBeNull()
    expect(regionToLatLng(null)).toBeNull()
  })
})

describe('jitterInCell', () => {
  it('is deterministic for a given region + seed', () => {
    expect(jitterInCell('41,-74', 'entry-7')).toEqual(jitterInCell('41,-74', 'entry-7'))
  })
  it('places the point inside the 1° cell around the centre', () => {
    const p = jitterInCell('41,-74', 'entry-7')
    expect(Math.abs(p.lat - 41)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(p.lng - -74)).toBeLessThanOrEqual(0.5)
  })
  it('different seeds give different points', () => {
    expect(jitterInCell('41,-74', 'a')).not.toEqual(jitterInCell('41,-74', 'b'))
  })
  it('returns null for a malformed region', () => {
    expect(jitterInCell('nope', 'a')).toBeNull()
  })
})
