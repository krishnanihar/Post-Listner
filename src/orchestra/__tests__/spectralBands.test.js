import { describe, it, expect } from 'vitest'
import { BAND_SPEC, BAND_EDGES, BAND_NAMES, buildBandSplitter } from '../spectralBands.js'

// Minimal mock AudioContext — records node creation + connections.
function mockCtx() {
  const created = { biquad: [], gain: [] }
  const connections = []
  const mkNode = (kind) => {
    const node = {
      kind,
      type: null,
      frequency: { value: 0 },
      Q: { value: 0 },
      gain: { value: 0 },
      connect(dest) { connections.push([this, dest]); return dest },
      disconnect() {},
    }
    return node
  }
  return {
    created,
    connections,
    createBiquadFilter() { const n = mkNode('biquad'); created.biquad.push(n); return n },
    createGain() { const n = mkNode('gain'); created.gain.push(n); return n },
  }
}

describe('BAND_SPEC', () => {
  it('covers the 4 stem slots with contiguous non-overlapping bands', () => {
    expect(BAND_NAMES).toEqual(['bass', 'drums', 'vocals', 'other'])
    expect(BAND_SPEC.bass).toEqual({ hp: null, lp: BAND_EDGES.low })
    expect(BAND_SPEC.drums).toEqual({ hp: BAND_EDGES.low, lp: BAND_EDGES.lowMid })
    expect(BAND_SPEC.vocals).toEqual({ hp: BAND_EDGES.lowMid, lp: BAND_EDGES.highMid })
    expect(BAND_SPEC.other).toEqual({ hp: BAND_EDGES.highMid, lp: null })
  })

  it('edges ascend', () => {
    expect(BAND_EDGES.low).toBeLessThan(BAND_EDGES.lowMid)
    expect(BAND_EDGES.lowMid).toBeLessThan(BAND_EDGES.highMid)
  })
})

describe('buildBandSplitter', () => {
  it('returns 4 band output gain nodes keyed vocals/drums/bass/other', () => {
    const ctx = mockCtx()
    const source = { connect() {}, disconnect() {} }
    const { outputs } = buildBandSplitter(ctx, source)
    expect(Object.keys(outputs).sort()).toEqual(['bass', 'drums', 'other', 'vocals'])
    for (const name of BAND_NAMES) expect(outputs[name].kind).toBe('gain')
  })

  it('uses 2 cascaded biquads per crossover edge (LR4)', () => {
    const ctx = mockCtx()
    const source = { connect() {}, disconnect() {} }
    buildBandSplitter(ctx, source)
    // bass:1 edge, drums:2, vocals:2, other:1 → 6 edges → 12 biquads.
    expect(ctx.created.biquad.length).toBe(12)
    // 4 band-output gains.
    expect(ctx.created.gain.length).toBe(4)
    // Every biquad is Butterworth Q.
    for (const b of ctx.created.biquad) expect(b.Q.value).toBeCloseTo(0.7071, 3)
  })

  it('dispose() disconnects without throwing', () => {
    const ctx = mockCtx()
    const source = { connect() {}, disconnect() {} }
    const { dispose } = buildBandSplitter(ctx, source)
    expect(() => dispose()).not.toThrow()
  })
})
