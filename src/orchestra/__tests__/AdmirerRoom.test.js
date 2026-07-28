import { describe, it, expect } from 'vitest'
import { rollToAzimuthOffset, MAX_AZIMUTH_OFFSET_DEG } from '../AdmirerRoom.js'

describe('rollToAzimuthOffset', () => {
  it('returns 0 at neutral roll', () => {
    expect(rollToAzimuthOffset(0)).toBe(0)
  })

  it('returns 0 inside the deadzone', () => {
    expect(rollToAzimuthOffset(2)).toBe(0)
    expect(rollToAzimuthOffset(-2)).toBe(0)
  })

  it('reaches the max offset at the full-roll angle', () => {
    expect(rollToAzimuthOffset(40)).toBeCloseTo(MAX_AZIMUTH_OFFSET_DEG, 5)
    expect(rollToAzimuthOffset(-40)).toBeCloseTo(-MAX_AZIMUTH_OFFSET_DEG, 5)
  })

  it('clamps roll beyond the full-roll angle', () => {
    expect(rollToAzimuthOffset(90)).toBeCloseTo(MAX_AZIMUTH_OFFSET_DEG, 5)
    expect(rollToAzimuthOffset(-90)).toBeCloseTo(-MAX_AZIMUTH_OFFSET_DEG, 5)
  })

  it('is signed and strictly between 0 and the max in the active range', () => {
    expect(rollToAzimuthOffset(20)).toBeGreaterThan(0)
    expect(rollToAzimuthOffset(20)).toBeLessThan(MAX_AZIMUTH_OFFSET_DEG)
    expect(rollToAzimuthOffset(-20)).toBeLessThan(0)
    expect(rollToAzimuthOffset(-20)).toBeGreaterThan(-MAX_AZIMUTH_OFFSET_DEG)
  })

  it('treats null and NaN as 0', () => {
    expect(rollToAzimuthOffset(null)).toBe(0)
    expect(rollToAzimuthOffset(undefined)).toBe(0)
    expect(rollToAzimuthOffset(NaN)).toBe(0)
  })
})

// ── the speaking duck ────────────────────────────────────────────────────────
// The per-movement beds duck while the Prompter speaks over them and lift back
// when the line ends. These tests exercise the real graph builders against a
// minimal Web-Audio fake, so the wiring (a dedicated duck stage, separate from
// the gesture-driven gain) is verified rather than assumed.

function fakeParam(value) {
  return { value, _targets: [], setTargetAtTime(v) { this.value = v; this._targets.push(v) } }
}

function makeFakeCtx() {
  const created = { gains: [], panners: [], sources: [], filters: [] }
  const node = (extra = {}) => ({
    connect() {}, disconnect() {}, ...extra,
  })
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    destination: node(),
    _created: created,
    createGain() {
      const g = node({ gain: fakeParam(1), channelCount: 1, channelCountMode: '', channelInterpretation: '' })
      created.gains.push(g)
      return g
    },
    createPanner() {
      const p = node({
        panningModel: '', distanceModel: '', refDistance: 1, maxDistance: 1, rolloffFactor: 1,
        positionX: fakeParam(0), positionY: fakeParam(0), positionZ: fakeParam(0),
      })
      created.panners.push(p)
      return p
    },
    createBufferSource() {
      const s = node({
        buffer: null, loop: false, _started: false, _stopped: false,
        start() { this._started = true }, stop() { this._stopped = true },
        addEventListener() {},
      })
      created.sources.push(s)
      return s
    },
    createBiquadFilter() {
      const f = node({ type: '', frequency: fakeParam(0), Q: fakeParam(0) })
      created.filters.push(f)
      return f
    },
    createDelay() { return node({ delayTime: fakeParam(0) }) },
    createConvolver() { return node({ buffer: null }) },
    createBuffer(_ch, len) { return { getChannelData: () => new Float32Array(len), duration: 1 } },
  }
  return ctx
}

// A room whose graph is built against the fake ctx.
async function makeRoom() {
  const { default: AdmirerRoom } = await import('../AdmirerRoom.js')
  return new AdmirerRoom(makeFakeCtx())
}

const buf = { duration: 2 }

describe('AdmirerRoom — SPEAKING_DUCK', () => {
  it('is a real attenuation, not silence', async () => {
    const { SPEAKING_DUCK } = await import('../AdmirerRoom.js')
    expect(SPEAKING_DUCK).toBeGreaterThan(0)
    expect(SPEAKING_DUCK).toBeLessThan(1)
  })

  it('exposes setDuck on every per-movement bed', async () => {
    const room = await makeRoom()
    const handles = [
      room.playTexturePair(buf, buf),
      room.playFilteredBed(buf),
      room.playRiseBed(buf),
      room.playRingSources([{ buffer: buf, azimuthDeg: 0 }, { buffer: buf, azimuthDeg: 60 }]),
    ]
    for (const h of handles) {
      expect(h).toBeTruthy()
      expect(typeof h.setDuck).toBe('function')
    }
  })

  it('ducks and restores without disturbing the gesture-driven gain', async () => {
    const room = await makeRoom()
    const h = room.playRiseBed(buf)
    // The gesture sets the bed's swell...
    h.setSwell(1)
    const gains = room.ctx._created.gains
    const swelled = gains.find((g) => g.gain._targets.length && g.gain.value > 0.9)
    expect(swelled, 'setSwell should have written a gain').toBeTruthy()
    const swellValue = swelled.gain.value

    // ...and ducking must not overwrite it — the duck is its own stage.
    const { SPEAKING_DUCK } = await import('../AdmirerRoom.js')
    h.setDuck(SPEAKING_DUCK)
    expect(swelled.gain.value).toBe(swellValue)
    const ducked = gains.find((g) => g.gain.value === SPEAKING_DUCK)
    expect(ducked, 'a duck stage should have been ramped').toBeTruthy()

    h.setDuck(1)
    expect(ducked.gain.value).toBe(1)
    expect(swelled.gain.value).toBe(swellValue)
  })

  it('clamps out-of-range and non-finite duck values', async () => {
    const room = await makeRoom()
    const h = room.playFilteredBed(buf)
    const gains = room.ctx._created.gains
    h.setDuck(5)
    expect(gains.some((g) => g.gain.value === 1)).toBe(true)
    h.setDuck(-2)
    expect(gains.some((g) => g.gain.value === 0)).toBe(true)
    h.setDuck(Number.NaN) // falls back to no duck rather than silencing the bed
    expect(gains.some((g) => g.gain.value === 1)).toBe(true)
  })

  it('is inert after the bed is stopped', async () => {
    const room = await makeRoom()
    const h = room.playRiseBed(buf)
    h.setDuck(0.5)
    const gains = room.ctx._created.gains
    const ducked = gains.find((g) => g.gain.value === 0.5)
    expect(ducked).toBeTruthy()
    h.stop()
    h.setDuck(1) // must not touch a torn-down graph
    expect(ducked.gain.value).toBe(0.5)
  })
})
