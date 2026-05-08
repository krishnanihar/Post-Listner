import { describe, test, expect, beforeEach, vi } from 'vitest'
import { audioEngine } from '../../engine/audio.js'

describe('audioEngine.playDrone', () => {
  beforeEach(() => {
    // jsdom doesn't provide AudioContext; stub the minimum surface
    // playDrone needs.
    if (!audioEngine.ctx) {
      const fakeNode = () => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: { value: 0, setValueAtTime: vi.fn() },
        gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      })
      audioEngine.ctx = {
        currentTime: 0,
        destination: {},
        createOscillator: vi.fn(fakeNode),
        createGain: vi.fn(fakeNode),
      }
    }
  })

  test('playDrone returns a function that stops the drone', () => {
    const stop = audioEngine.playDrone(60, 0.05)
    expect(typeof stop).toBe('function')
    expect(() => stop()).not.toThrow()
  })

  test('playDrone uses the given frequency', () => {
    audioEngine.playDrone(60, 0.05)
    expect(audioEngine.ctx.createOscillator).toHaveBeenCalled()
  })
})
