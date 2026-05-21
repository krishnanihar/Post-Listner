import { describe, it, expect } from 'vitest'
import {
  MSG_TYPES, ROLES, encodeMessage, decodeMessage, isGestureMessage, isEntryMessage,
} from '../relayProtocol.js'

describe('relayProtocol — constants', () => {
  it('exports the four conductor→viewer message types', () => {
    expect(MSG_TYPES.GESTURE).toBe('gesture')
    expect(MSG_TYPES.PHASE).toBe('phase')
    expect(MSG_TYPES.AUDIO).toBe('audio')
    expect(MSG_TYPES.SESSION_END).toBe('session:end')
  })

  it('exports the entry message type', () => {
    expect(MSG_TYPES.ENTRY).toBe('entry')
  })

  it('exports the two roles', () => {
    expect(ROLES.CONDUCTOR).toBe('conductor')
    expect(ROLES.VIEWER).toBe('viewer')
  })
})

describe('relayProtocol — encode/decode', () => {
  it('encodes a gesture message as JSON string', () => {
    const msg = { type: 'gesture', gestureGain: 0.5, articulation: 0.2 }
    const encoded = encodeMessage(msg)
    expect(typeof encoded).toBe('string')
    expect(JSON.parse(encoded)).toEqual(msg)
  })

  it('decodes a JSON string back to an object', () => {
    const json = '{"type":"phase","phase":"orchestra"}'
    expect(decodeMessage(json)).toEqual({ type: 'phase', phase: 'orchestra' })
  })

  it('returns null on malformed JSON', () => {
    expect(decodeMessage('not json')).toBe(null)
  })

  it('returns null on missing type field', () => {
    expect(decodeMessage('{"foo":"bar"}')).toBe(null)
  })
})

describe('relayProtocol — type guards', () => {
  it('isGestureMessage accepts a well-formed gesture', () => {
    expect(isGestureMessage({ type: 'gesture', gestureGain: 0.5 })).toBe(true)
  })

  it('isGestureMessage rejects other types', () => {
    expect(isGestureMessage({ type: 'phase', phase: 'orchestra' })).toBe(false)
    expect(isGestureMessage({})).toBe(false)
    expect(isGestureMessage(null)).toBe(false)
  })

  it('isEntryMessage accepts a well-formed entry', () => {
    expect(isEntryMessage({
      type: 'entry',
      song: 'hearth-keeper/acoustic-soft-2000s',
      summary: 'a quiet line',
      glyph: { v: 1, pts: [[0, 0, 0]], dur: 0 },
    })).toBe(true)
  })

  it('isEntryMessage rejects a missing or malformed glyph', () => {
    expect(isEntryMessage({ type: 'entry', song: 'x', summary: 'y' })).toBe(false)
    expect(isEntryMessage({ type: 'entry', glyph: {} })).toBe(false)
    expect(isEntryMessage({ type: 'entry', glyph: { v: 1, dur: 0 } })).toBe(false)
    expect(isEntryMessage({ type: 'phase', phase: 'orchestra' })).toBe(false)
    expect(isEntryMessage(null)).toBe(false)
  })
})
