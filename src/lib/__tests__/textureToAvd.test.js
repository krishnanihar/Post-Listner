// src/lib/__tests__/textureToAvd.test.js
import { describe, it, expect } from 'vitest'
import {
  TEXTURE_BASE,
  READ_TRUST_ALPHA,
  textureToTarget,
  blendTarget,
} from '../textureToAvd.js'

describe('textureToAvd — constants', () => {
  it('has the four spec textures with signed base vectors', () => {
    expect(Object.keys(TEXTURE_BASE).sort()).toEqual(['calm', 'exalted', 'melancholic', 'sharp'])
    expect(TEXTURE_BASE.calm).toEqual({ a: -0.5, v: 0.6, d: 0 })
    expect(TEXTURE_BASE.exalted).toEqual({ a: 0.6, v: 0.6, d: 0.6 })
  })
  it('uses read-trust alpha 0.6', () => {
    expect(READ_TRUST_ALPHA).toBe(0.6)
  })
})

describe('textureToAvd — textureToTarget', () => {
  it('returns the base vector at full intensity', () => {
    expect(textureToTarget('sharp', 1)).toEqual({ a: 0.6, v: -0.5, d: -0.2 })
  })
  it('scales the base vector by intensity', () => {
    const t = textureToTarget('calm', 0.5)
    expect(t).toEqual({ a: -0.25, v: 0.3, d: 0 })
  })
  it('clamps intensity to [0,1]', () => {
    expect(textureToTarget('calm', 5)).toEqual(TEXTURE_BASE.calm)
    expect(textureToTarget('calm', -1)).toEqual({ a: -0, v: 0, d: 0 })
  })
  it('returns neutral for an unknown texture', () => {
    expect(textureToTarget('bogus', 1)).toEqual({ a: 0, v: 0, d: 0 })
  })
})

describe('textureToAvd — blendTarget', () => {
  it('blends observed and intent at alpha (default 0.6)', () => {
    const observed = { a: 1, v: 1, d: 1 }
    const intent = { a: 0, v: 0, d: 0 }
    expect(blendTarget(observed, intent)).toEqual({ a: 0.6, v: 0.6, d: 0.6 })
  })
  it('honors a custom alpha and a nonzero intent', () => {
    const observed = { a: 1, v: 0, d: 0 }
    const intent = { a: -1, v: 0, d: 0 }
    expect(blendTarget(observed, intent, 0.5)).toEqual({ a: 0, v: 0, d: 0 })
  })
  it('defaults intent to neutral when omitted', () => {
    expect(blendTarget({ a: 0.5, v: 0.5, d: 0.5 })).toEqual({ a: 0.3, v: 0.3, d: 0.3 })
  })
})
