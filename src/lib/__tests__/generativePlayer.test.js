import { describe, it, expect } from 'vitest'
import GenerativePlayer, { computeNormalizationGain } from '../generativePlayer.js'

// Minimal mock AudioContext for the player's node graph.
function mockCtx() {
  let now = 0
  const mkNode = (kind) => ({
    kind,
    type: null,
    frequency: { value: 0 },
    Q: { value: 0 },
    gain: {
      value: 0,
      setValueAtTime(v) { this.value = v },
      cancelScheduledValues() {},
      linearRampToValueAtTime(v) { this.value = v },
    },
    loop: false,
    buffer: null,
    connect() {},
    disconnect() {},
    start() {},
    stop() {},
  })
  return {
    currentTime: now,
    destination: { kind: 'destination' },
    createBufferSource() { return mkNode('source') },
    createGain() { return mkNode('gain') },
    createBiquadFilter() { return mkNode('biquad') },
  }
}

function mockBuffer(rms = 0.5, length = 1000) {
  const data = new Float32Array(length).fill(rms)
  return { duration: 3.5, length, getChannelData: () => data }
}

describe('computeNormalizationGain', () => {
  it('scales a quiet-but-audible buffer up toward the target', () => {
    const g = computeNormalizationGain(mockBuffer(0.05), 0.14)
    expect(g).toBeGreaterThan(1)
    expect(g).toBeLessThanOrEqual(4)
  })

  it('scales a hot buffer down toward the target', () => {
    const g = computeNormalizationGain(mockBuffer(0.9), 0.14)
    expect(g).toBeLessThan(1)
    expect(g).toBeGreaterThanOrEqual(0.25)
  })

  it('returns unity for a silent buffer (no pumping)', () => {
    expect(computeNormalizationGain(mockBuffer(0), 0.14)).toBe(1)
  })

  it('clamps to the [0.25, 4] range', () => {
    expect(computeNormalizationGain(mockBuffer(0.0001), 0.14)).toBeLessThanOrEqual(4)
    expect(computeNormalizationGain(mockBuffer(50), 0.14)).toBeGreaterThanOrEqual(0.25)
  })
})

describe('GenerativePlayer contract (StemPlayer drop-in)', () => {
  it('reports duration + a 4-key buffers shape from the single buffer', () => {
    const ctx = mockCtx()
    const p = new GenerativePlayer(ctx, mockBuffer())
    expect(p.duration).toBe(3.5)
    expect(Object.keys(p.buffers).sort()).toEqual(['bass', 'drums', 'other', 'vocals'])
    expect(p.buffers.vocals.duration).toBe(3.5)
  })

  it('start() builds the graph and detachAndGetSources() returns the 4 bands', () => {
    const ctx = mockCtx()
    const p = new GenerativePlayer(ctx, mockBuffer())
    p.start()
    expect(p.started).toBe(true)
    const sources = p.detachAndGetSources()
    expect(Object.keys(sources).sort()).toEqual(['bass', 'drums', 'other', 'vocals'])
    for (const k of ['vocals', 'drums', 'bass', 'other']) expect(sources[k]).toBeTruthy()
  })

  it('detachAndGetSources() is idempotent', () => {
    const ctx = mockCtx()
    const p = new GenerativePlayer(ctx, mockBuffer())
    p.start()
    const a = p.detachAndGetSources()
    const b = p.detachAndGetSources()
    expect(a).toBe(b)
  })

  it('detachAndGetSources() before start() returns null', () => {
    const ctx = mockCtx()
    const p = new GenerativePlayer(ctx, mockBuffer())
    expect(p.detachAndGetSources()).toBe(null)
  })

  it('setVolume / getVolume operate on the silent sum bus', () => {
    const ctx = mockCtx()
    const p = new GenerativePlayer(ctx, mockBuffer())
    expect(p.getVolume()).toBe(0)
    p.setVolume(0.7)
    expect(p.getVolume()).toBe(0.7)
  })

  it('stop() is safe before and after start', () => {
    const ctx = mockCtx()
    const p = new GenerativePlayer(ctx, mockBuffer())
    expect(() => p.stop()).not.toThrow()
    p.start()
    expect(() => p.stop()).not.toThrow()
  })

  it('exposes the same method surface StemPlayer does', () => {
    const ctx = mockCtx()
    const p = new GenerativePlayer(ctx, mockBuffer())
    for (const m of ['start', 'setVolume', 'getVolume', 'detachAndGetSources', 'stop', 'pause']) {
      expect(typeof p[m]).toBe('function')
    }
  })
})

describe('GenerativePlayer encoded-byte retention (for archiving)', () => {
  it('leaves encodedBytes null when constructed directly', () => {
    const ctx = mockCtx()
    const p = new GenerativePlayer(ctx, mockBuffer())
    expect(p.encodedBytes).toBe(null)
  })

  it('retains the fetched bytes after load(), and releaseEncoded() frees them', async () => {
    const arr = new Uint8Array([1, 2, 3, 4]).buffer
    const ctx = mockCtx()
    ctx.decodeAudioData = async () => mockBuffer()
    const origFetch = globalThis.fetch
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => arr })
    try {
      const p = await GenerativePlayer.load(ctx, 'http://example.com/track.mp3')
      // encodedBytes is a COPY (arr.slice(0)) so it survives decodeAudioData
      // detaching the original ArrayBuffer in a real browser.
      expect(p.encodedBytes).not.toBe(arr)
      expect(new Uint8Array(p.encodedBytes)).toEqual(new Uint8Array([1, 2, 3, 4]))
      expect(typeof p.releaseEncoded).toBe('function')
      p.releaseEncoded()
      expect(p.encodedBytes).toBe(null)
    } finally {
      globalThis.fetch = origFetch
    }
  })
})
