import { describe, it, expect } from 'vitest'
import { drawTraceGlyph, drawTrace, GLYPH_AMBER } from '../traceModel.js'

// A fake canvas + 2D context recording the calls, enough to exercise the pure
// draw math headless (no real DOM canvas needed).
function fakeCanvas(w = 300, h = 600) {
  const calls = []
  const ctx = {
    calls,
    setTransform: () => calls.push('setTransform'),
    clearRect: () => calls.push('clearRect'),
    beginPath: () => calls.push('beginPath'),
    arc: (...a) => calls.push(['arc', ...a]),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  }
  return {
    clientWidth: w,
    clientHeight: h,
    width: 0,
    height: 0,
    getContext: () => ctx,
    _ctx: ctx,
  }
}

describe('traceModel — drawTraceGlyph (extracted Throne glyph)', () => {
  it('uses the heritage amber', () => {
    expect(GLYPH_AMBER).toBe('212,160,83')
  })

  it('draws the core dot + glow without throwing', () => {
    const canvas = fakeCanvas()
    const fx = { rings: [], reduced: false }
    expect(() => drawTraceGlyph(canvas, { pan: 0.5, filterNorm: 0.5, gestureGain: 0.3 }, fx, 1000)).not.toThrow()
    expect(canvas._ctx.calls).toContain('clearRect')
    expect(canvas._ctx.calls).toContain('fill')
  })

  it('sizes the canvas to the DPR-scaled client box', () => {
    const canvas = fakeCanvas(300, 600)
    drawTraceGlyph(canvas, { pan: 0.5, filterNorm: 0.5, gestureGain: 0 }, { rings: [], reduced: false }, 0)
    // dpr in jsdom is 1 → canvas pixel size matches client size
    expect(canvas.width).toBe(300)
    expect(canvas.height).toBe(600)
  })

  it('is finite-guarded against NaN gesture fields', () => {
    const canvas = fakeCanvas()
    expect(() =>
      drawTraceGlyph(canvas, { pan: NaN, filterNorm: NaN, gestureGain: NaN }, { rings: [], reduced: false }, 0),
    ).not.toThrow()
  })

  it('expires downbeat rings older than ~900ms', () => {
    const canvas = fakeCanvas()
    const fx = { rings: [{ start: 0, intensity: 0.5 }], reduced: false }
    drawTraceGlyph(canvas, { pan: 0.5, filterNorm: 0.5, gestureGain: 0 }, fx, 1000) // age > 1
    expect(fx.rings.length).toBe(0)
  })

  it('keeps a fresh downbeat ring', () => {
    const canvas = fakeCanvas()
    const fx = { rings: [{ start: 900, intensity: 0.5 }], reduced: false }
    drawTraceGlyph(canvas, { pan: 0.5, filterNorm: 0.5, gestureGain: 0 }, fx, 1000) // age ~0.11
    expect(fx.rings.length).toBe(1)
    expect(canvas._ctx.calls).toContain('stroke') // the ring was drawn
  })

  it('does nothing on a zero-size canvas', () => {
    const canvas = fakeCanvas(0, 0)
    drawTraceGlyph(canvas, { pan: 0.5, filterNorm: 0.5, gestureGain: 0 }, { rings: [], reduced: false }, 0)
    expect(canvas._ctx.calls.length).toBe(0)
  })
})

describe('traceModel — drawTrace (Act-I replay)', () => {
  it('draws every stroke at full reveal', () => {
    const ctx = fakeCanvas()._ctx
    const trace = [
      { x: 0.2, y: 0.3, size: 0.5 },
      { x: 0.7, y: 0.6, size: 0.8 },
    ]
    const n = drawTrace(ctx, trace, 300, 600, { reveal: 1 })
    expect(n).toBe(2)
  })

  it('gates strokes by reveal for the reflect replay', () => {
    const ctx = fakeCanvas()._ctx
    const trace = [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }, { x: 0.4, y: 0.4 }]
    expect(drawTrace(ctx, trace, 300, 600, { reveal: 0.5 })).toBe(2)
    expect(drawTrace(ctx, trace, 300, 600, { reveal: 0 })).toBe(0)
  })

  it('is a no-op for an empty trace', () => {
    const ctx = fakeCanvas()._ctx
    expect(drawTrace(ctx, [], 300, 600)).toBe(0)
    expect(drawTrace(ctx, null, 300, 600)).toBe(0)
  })
})
