import { describe, it, expect } from 'vitest'
import { createAvdRecorder } from '../avdRecorder.js'

describe('avdRecorder', () => {
  it('records a trajectory with start, manual samples, and a final point', () => {
    let cur = { a: 0, v: 0, d: 0 }
    const r = createAvdRecorder({ read: () => cur })
    r.start(0, { intervalMs: 0 })
    expect(r.isRecording()).toBe(true)
    cur = { a: 0.5, v: 0, d: 0 }
    r.sample(1000)
    cur = { a: 0.8, v: -0.2, d: 0.1 }
    const out = r.stop(2000)
    expect(r.isRecording()).toBe(false)
    expect(out.startedAt).toBe(0)
    expect(out.endedAt).toBe(2000)
    expect(out.finalVector).toEqual({ a: 0.8, v: -0.2, d: 0.1 })
    expect(out.trajectory.map((p) => p.t)).toEqual([0, 1000, 2000])
    expect(out.trajectory[1]).toEqual({ t: 1000, a: 0.5, v: 0, d: 0 })
  })
  it('sample is a no-op when not recording', () => {
    const r = createAvdRecorder({ read: () => ({ a: 0, v: 0, d: 0 }) })
    r.sample(500)
    const out = r.start(0, { intervalMs: 0 })
    expect(out).toBeUndefined()
  })
})
