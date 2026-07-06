import { describe, it, expect } from 'vitest'
import {
  makeScene,
  mergeScene,
  lerpScene,
  lampColor,
  poolRadiusPx,
  compositeScene,
  clamp01,
  MAX_SOURCES,
} from '../lightField.js'

describe('lightField — makeScene', () => {
  it('produces a neutral intimate resting scene', () => {
    const s = makeScene()
    expect(s.pool).toEqual({ x: 0.5, y: 0.5, radius: 0.28 })
    expect(s.warmth).toBe(0.5)
    expect(s.breadth).toBe(0)
    expect(s.intensity).toBe(1)
    expect(s.sources).toEqual([])
  })
  it('clamps warmth/breadth into [0,1]', () => {
    const s = makeScene({ warmth: 5, breadth: -3 })
    expect(s.warmth).toBe(1)
    expect(s.breadth).toBe(0)
  })
  it('caps sources at MAX_SOURCES', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ x: 0, y: 0, radius: 0.1, intensity: 1, warmth: 0.5, i }))
    const s = makeScene({ sources: many })
    expect(s.sources.length).toBe(MAX_SOURCES)
  })
})

describe('lightField — mergeScene', () => {
  it('merges pool fields and overrides warmth/breadth', () => {
    const base = makeScene({ warmth: 0.2, breadth: 0.1, pool: { x: 0.3 } })
    const next = mergeScene(base, { breadth: 0.9, pool: { radius: 0.5 } })
    expect(next.warmth).toBe(0.2)      // untouched
    expect(next.breadth).toBe(0.9)     // overridden
    expect(next.pool.x).toBe(0.3)      // preserved
    expect(next.pool.radius).toBe(0.5) // merged
  })
})

describe('lightField — lampColor', () => {
  it('is ember at warmth 0', () => {
    expect(lampColor(0)).toEqual({ r: 0x8c, g: 0x5a, b: 0x28 })
  })
  it('is candle at warmth 0.5', () => {
    expect(lampColor(0.5)).toEqual({ r: 0xd4, g: 0xa0, b: 0x53 })
  })
  it('is white-gold at warmth 1', () => {
    expect(lampColor(1)).toEqual({ r: 0xf0, g: 0xe3, b: 0xc8 })
  })
  it('interpolates monotonically brighter with warmth', () => {
    const lo = lampColor(0.1)
    const hi = lampColor(0.9)
    expect(hi.r + hi.g + hi.b).toBeGreaterThan(lo.r + lo.g + lo.b)
  })
  it('clamps out-of-range warmth', () => {
    expect(lampColor(-1)).toEqual(lampColor(0))
    expect(lampColor(9)).toEqual(lampColor(1))
  })
  it('writes into a provided out object (zero-alloc) and returns it', () => {
    const out = { r: 0, g: 0, b: 0 }
    const ret = lampColor(0.5, out)
    expect(ret).toBe(out) // same reference — no allocation
    expect(out).toEqual({ r: 0xd4, g: 0xa0, b: 0x53 })
  })
  it('reuses the out object across calls without cross-contamination', () => {
    const out = { r: 0, g: 0, b: 0 }
    lampColor(0, out)
    expect(out).toEqual({ r: 0x8c, g: 0x5a, b: 0x28 })
    lampColor(1, out)
    expect(out).toEqual({ r: 0xf0, g: 0xe3, b: 0xc8 })
  })
})

describe('lightField — poolRadiusPx (bloom coupling)', () => {
  const pool = { x: 0.5, y: 0.5, radius: 0.28 }
  it('is intimate at breadth 0', () => {
    const r = poolRadiusPx(pool, 0, 400, 800)
    expect(r).toBeCloseTo(0.28 * 400, 6)
  })
  it('opens toward the hall at breadth 1', () => {
    const r = poolRadiusPx(pool, 1, 400, 800)
    expect(r).toBeCloseTo(0.85 * 800, 6)
  })
  it('grows monotonically with breadth', () => {
    const a = poolRadiusPx(pool, 0.25, 400, 800)
    const b = poolRadiusPx(pool, 0.75, 400, 800)
    expect(b).toBeGreaterThan(a)
  })
})

describe('lightField — lerpScene', () => {
  it('returns endpoints at k=0 and k=1', () => {
    const a = makeScene({ breadth: 0, warmth: 0.2 })
    const b = makeScene({ breadth: 1, warmth: 0.8 })
    expect(lerpScene(a, b, 0).breadth).toBeCloseTo(0, 6)
    expect(lerpScene(a, b, 1).breadth).toBeCloseTo(1, 6)
    expect(lerpScene(a, b, 0.5).warmth).toBeCloseTo(0.5, 6)
  })
  it('fades in a new source from zero intensity', () => {
    const a = makeScene()
    const b = makeScene({ sources: [{ x: 0.2, y: 0.2, radius: 0.1, intensity: 1, warmth: 0.5 }] })
    const mid = lerpScene(a, b, 0.5)
    expect(mid.sources[0].intensity).toBeCloseTo(0.5, 6)
  })
})

// A minimal fake 2D context to smoke compositeScene without a real canvas.
function fakeCtx() {
  const calls = []
  return {
    calls,
    setTransform: () => calls.push('setTransform'),
    fillRect: () => calls.push('fillRect'),
    beginPath: () => calls.push('beginPath'),
    arc: () => calls.push('arc'),
    fill: () => calls.push('fill'),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    globalCompositeOperation: '',
    fillStyle: '',
  }
}

describe('lightField — compositeScene', () => {
  it('paints the background then the primary pool without throwing', () => {
    const ctx = fakeCtx()
    const scene = makeScene({ warmth: 0.6, breadth: 0.3 })
    expect(() => compositeScene(ctx, scene, 400, 800, 0)).not.toThrow()
    expect(ctx.calls).toContain('fillRect') // background
    expect(ctx.calls).toContain('fill')     // pool
  })
  it('paints each secondary source', () => {
    const ctx = fakeCtx()
    const scene = makeScene({
      sources: [
        { x: 0.2, y: 0.2, radius: 0.1, intensity: 1, warmth: 0.5 },
        { x: 0.8, y: 0.3, radius: 0.1, intensity: 1, warmth: 0.5 },
      ],
    })
    compositeScene(ctx, scene, 400, 800, 0)
    const fills = ctx.calls.filter((c) => c === 'fill').length
    // one for the pool + one per source
    expect(fills).toBe(3)
  })
  it('is deterministic in tMs (breath phase)', () => {
    const ctxA = fakeCtx()
    const ctxB = fakeCtx()
    const scene = makeScene({ breadth: 0.5 })
    compositeScene(ctxA, scene, 400, 800, 1234)
    compositeScene(ctxB, scene, 400, 800, 1234)
    expect(ctxA.calls).toEqual(ctxB.calls)
  })
})

describe('lightField — clamp01', () => {
  it('handles non-finite as 0', () => {
    expect(clamp01(NaN)).toBe(0)
    expect(clamp01(Infinity)).toBe(0)
  })
})
