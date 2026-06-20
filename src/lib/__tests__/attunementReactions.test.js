import { describe, it, expect } from 'vitest'
import { phraseReaction } from '../attunementReactions.js'

describe('phraseReaction', () => {
  it('lean warm + inward', () => {
    const s = phraseReaction('leanLift', { valence: 0.6, depth: 0.4 })
    expect(s).toMatch(/warm/i)
    expect(s).toMatch(/inward/i)
  })
  it('lean cool + open', () => {
    const s = phraseReaction('leanLift', { valence: -0.6, depth: -0.4 })
    expect(s).toMatch(/cool|austere/i)
    expect(s).toMatch(/open/i)
  })
  it('rise — rode the climax', () => {
    expect(phraseReaction('rise', { arousal: 0.8, hedonic: true })).toMatch(/rode|climax/i)
  })
  it('rise — held back', () => {
    expect(phraseReaction('rise', { arousal: 0.2, hedonic: false })).toMatch(/held back|back/i)
  })
  it('rise — a marked beat', () => {
    expect(phraseReaction('rise', { downbeat: true, intensity: 0.7 })).toMatch(/beat/i)
  })
  it('face — names the world', () => {
    expect(phraseReaction('face', { archetypeId: 'hearth-keeper' })).toMatch(/hearth-keeper/)
  })
  it('unknown / empty payload → empty string (nothing to say)', () => {
    expect(phraseReaction('arrival', {})).toBe('')
    expect(phraseReaction('face', {})).toBe('')
  })
})
