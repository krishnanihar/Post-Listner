import { describe, it, expect } from 'vitest'
import {
  ASKS, SEALS, TRANSITIONS,
  ASK_KEYS, SEAL_KEYS, TRANSITION_KEYS,
  askClipId, sealClipId, askText, sealText,
  allClipIds, allLines,
} from '../prompterScript.js'
import { MOVEMENTS, getMovement } from '../attunementMovements.js'
import { READING } from '../reflectionScript.js'

describe('prompterScript — clip ids', () => {
  it('builds the ask id shape the runtime plays', () => {
    // Admirer.onScoreAsk plays `ask-${movementId}`; this contract is what makes
    // the score's onAsk fire a real clip.
    expect(askClipId('leanLift')).toBe('ask-leanLift')
    expect(sealClipId('face')).toBe('seal-face')
  })

  it('exposes every clip id exactly once', () => {
    const ids = allClipIds()
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('ask-rise')
    expect(ids).toContain('seal-listen')
    expect(ids).toContain('bloom-hall')
  })

  it('allLines covers every id in allClipIds with non-empty text', () => {
    const lines = allLines()
    const ids = allClipIds()
    expect(Object.keys(lines).sort()).toEqual([...ids].sort())
    for (const [id, text] of Object.entries(lines)) {
      expect(typeof text, id).toBe('string')
      expect(text.trim().length, id).toBeGreaterThan(0)
    }
  })

  it('returns null for a movement with no line', () => {
    expect(askText('bloom')).toBeNull()
    expect(sealText('era')).toBeNull()
  })
})

describe('prompterScript — the canon’s invariants', () => {
  const texts = Object.values(allLines())

  it('never speaks an archetype name (canon Invariant 3)', () => {
    // The reading copy is unnamed for the same reason; the Prompter must not
    // leak the routing label the AVD vector resolved to.
    const names = Object.keys(READING).flatMap((id) => [id, id.replace(/-/g, ' ')])
    for (const text of texts) {
      for (const name of names) {
        expect(text.toLowerCase(), `"${text}" leaks ${name}`).not.toContain(name)
      }
    }
  })

  it('never speaks a number', () => {
    // "six of them are around you" is fine; "6" is not — the room describes,
    // it does not report measurements.
    for (const text of texts) {
      expect(text, `"${text}" contains a digit`).not.toMatch(/\d/)
    }
  })

  it('never calls the voice "the admirer" (renamed to the Prompter)', () => {
    for (const text of texts) {
      expect(text.toLowerCase()).not.toContain('admirer')
    }
  })

  it('names the role only in the arrival self-reference', () => {
    const withPrompter = Object.entries(allLines())
      .filter(([, t]) => t.toLowerCase().includes('prompter'))
      .map(([id]) => id)
    expect(withPrompter).toEqual(['prompter-intro'])
  })
})

describe('prompterScript ↔ attunementMovements wiring', () => {
  it('gives every gesture beat a spoken ask', () => {
    for (const id of ['leanLift', 'listen', 'rise', 'face', 'era']) {
      expect(getMovement(id).ask, id).toBe(ASKS[id])
      expect(getMovement(id).ask, id).toBeTruthy()
    }
  })

  it('leaves arrival, reflect and bloom silent on entry', () => {
    // arrival is opened by the welcome clips, reflect narrates its own script,
    // and bloom is the silent act-1 → act-2 handoff.
    for (const id of ['arrival', 'reflect', 'bloom']) {
      expect(getMovement(id).ask, id).toBeNull()
    }
  })

  it('only declares asks for movements that actually exist', () => {
    const movementIds = new Set(MOVEMENTS.map((m) => m.id))
    for (const id of ASK_KEYS) expect(movementIds.has(id), id).toBe(true)
    for (const id of SEAL_KEYS) expect(movementIds.has(id), id).toBe(true)
  })

  it('seals exactly the four beats that write a trace stroke', () => {
    // Admirer.jsx seals a stroke (and plays seal-<beat>) for these four.
    expect([...SEAL_KEYS].sort()).toEqual(['face', 'leanLift', 'listen', 'rise'])
  })

  it('keeps the transition ids stable (they are filenames)', () => {
    expect([...TRANSITION_KEYS].sort()).toEqual([
      'bloom-hall', 'constellation-line', 'prompter-intro', 'reflect-open', 'season-door',
    ])
    expect(Object.keys(TRANSITIONS).length).toBe(5)
    expect(Object.keys(SEALS).length).toBe(4)
  })
})
