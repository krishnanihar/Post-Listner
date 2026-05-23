import { describe, it, expect } from 'vitest'
import {
  TILE_IDS,
  PARTICLE_BUDGET,
  pickRandomTileId,
  extractActivePixels,
  downsampleTargets,
  normalizeTargets,
} from '../glyphRasterizer.js'

describe('TILE_IDS / pickRandomTileId / PARTICLE_BUDGET', () => {
  it('exposes exactly 15 tile ids (Layer_16 excluded)', () => {
    expect(TILE_IDS.length).toBe(15)
    expect(TILE_IDS).not.toContain('Layer_16')
    expect(TILE_IDS).toContain('Layer_2')
    expect(TILE_IDS).toContain('Layer_17')
  })

  it('pickRandomTileId returns a TILE_IDS member for any rand() in [0,1)', () => {
    for (const v of [0, 0.123, 0.5, 0.7, 0.99, 0.99999]) {
      const id = pickRandomTileId(() => v)
      expect(TILE_IDS).toContain(id)
    }
  })

  it('PARTICLE_BUDGET is 800', () => {
    expect(PARTICLE_BUDGET).toBe(800)
  })
})

// Build a tiny ImageData-shaped object for testing extractActivePixels.
// data is RGBA (4 bytes per pixel) in row-major order. We construct a
// 4x2 image: rows of (white, black, transparent, dark-gray).
function makeImageData() {
  // 4 cols * 2 rows = 8 pixels, 32 bytes.
  const data = new Uint8ClampedArray([
    // Row 0
    255, 255, 255, 255,    //  (0,0) white opaque        — NOT dark
      0,   0,   0, 255,    //  (1,0) black opaque        — DARK
      0,   0,   0,   0,    //  (2,0) anything transparent — NOT dark (alpha)
     30,  30,  30, 255,    //  (3,0) dark gray opaque    — DARK
    // Row 1
    128, 128, 128, 255,    //  (0,1) mid gray            — NOT dark (above luminance threshold)
     50,  50,  50, 200,    //  (1,1) dark gray, alpha ok — DARK
    255,   0,   0, 255,    //  (2,1) pure red opaque     — NOT dark (luminance > 128)
      0,   0,   0,  50,    //  (3,1) black low alpha     — NOT dark (alpha < 128)
  ])
  return { data, width: 4, height: 2 }
}

describe('extractActivePixels', () => {
  it('returns pixels with alpha >= 128 AND luminance < 128', () => {
    const pixels = extractActivePixels(makeImageData(), { alphaMin: 128, luminanceMax: 128 })
    // Expect (1,0), (3,0), (1,1) — all three "active" pixels above.
    expect(pixels).toHaveLength(3)
    // Each pixel has { x, y }.
    expect(pixels).toContainEqual({ x: 1, y: 0 })
    expect(pixels).toContainEqual({ x: 3, y: 0 })
    expect(pixels).toContainEqual({ x: 1, y: 1 })
  })

  it('returns an empty array when the image is fully white', () => {
    const data = new Uint8ClampedArray(4 * 4)
    data.fill(255) // all RGBA white
    const pixels = extractActivePixels({ data, width: 1, height: 1 }, { alphaMin: 128, luminanceMax: 128 })
    expect(pixels).toEqual([])
  })

  it('uses default thresholds when options are omitted', () => {
    // Defaults: alphaMin=128, luminanceMax=128. Same outcome as above.
    const pixels = extractActivePixels(makeImageData())
    expect(pixels).toHaveLength(3)
  })
})

describe('downsampleTargets', () => {
  it('returns the input array when its length <= budget', () => {
    const arr = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]
    const result = downsampleTargets(arr, 10)
    expect(result).toEqual(arr) // exact same content, order may differ but length identical
    expect(result).toHaveLength(3)
  })

  it('returns exactly budget items when input is larger', () => {
    const arr = Array.from({ length: 100 }, (_, i) => ({ x: i, y: 0 }))
    const result = downsampleTargets(arr, 25)
    expect(result).toHaveLength(25)
  })

  it('is deterministic with a seeded rand', () => {
    const arr = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 }))
    // Same seeded rand → same output.
    const seeded = () => 0.5
    const a = downsampleTargets(arr, 10, seeded)
    const b = downsampleTargets(arr, 10, seeded)
    expect(a).toEqual(b)
  })
})

describe('normalizeTargets', () => {
  it('maps a centered pixel to (0, 0) in normalised space', () => {
    const pixels = [{ x: 50, y: 50 }]
    const result = normalizeTargets(pixels, { width: 100, height: 100 }, 50)
    // Center of a 100x100 image → centre of ±50 space → (0, 0)
    expect(result[0].x).toBeCloseTo(0, 4)
    expect(result[0].y).toBeCloseTo(0, 4)
  })

  it('maps the corners to ±halfExtent', () => {
    const pixels = [
      { x: 0, y: 0 },         // top-left
      { x: 100, y: 100 },     // bottom-right
    ]
    const result = normalizeTargets(pixels, { width: 100, height: 100 }, 50)
    expect(result[0].x).toBeCloseTo(-50, 4)
    expect(result[0].y).toBeCloseTo(-50, 4)
    expect(result[1].x).toBeCloseTo(50, 4)
    expect(result[1].y).toBeCloseTo(50, 4)
  })

  it('preserves aspect ratio when image is non-square', () => {
    // 200x100 image — the larger dimension defines the ±50 range.
    // scale = (2*50) / max(200,100) = 0.5 for both axes.
    // Pixel at (100, 50) (centre) → (0, 0).
    // Pixel at (200, 100): x=(200-100)*0.5=50, y=(100-50)*0.5=25.
    const pixels = [{ x: 100, y: 50 }, { x: 200, y: 100 }]
    const result = normalizeTargets(pixels, { width: 200, height: 100 }, 50)
    expect(result[0].x).toBeCloseTo(0, 4)
    expect(result[0].y).toBeCloseTo(0, 4)
    expect(result[1].x).toBeCloseTo(50, 4)
    expect(result[1].y).toBeCloseTo(25, 4)
  })
})
