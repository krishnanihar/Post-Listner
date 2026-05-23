import { describe, it, expect } from 'vitest'
import { TILE_IDS, pickRandomTileId } from '../glyphSampler.js'

describe('glyphSampler', () => {
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

  it('pickRandomTileId never returns Layer_16', () => {
    for (let i = 0; i < 100; i++) {
      expect(pickRandomTileId(Math.random)).not.toBe('Layer_16')
    }
  })
})
