import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildAdmirerTools } from '../admirerTools'
import * as sessionStore from '../sessionStore'
import { resetAvd, commitTurn } from '../avdStore.js'

describe('buildAdmirerTools', () => {
  beforeEach(() => {
    localStorage.clear()
    resetAvd() // keep startGeneration's descriptor-fallback tests order-independent
  })

  it('exposes all 8 tool names', () => {
    const tools = buildAdmirerTools({})
    expect(Object.keys(tools).sort()).toEqual([
      'commitArtifact',
      'commitEntry',
      'markRestricted',
      'nextQuestion',
      'playFragment',
      'recordAnswer',
      'recordLexicon',
      'startGeneration',
    ])
  })

  it('recordLexicon writes through to sessionStore', () => {
    const tools = buildAdmirerTools({})
    tools.recordLexicon({ term: 'Carnatic', userPhrasing: 'Carnatic' })
    expect(sessionStore.getLexicon()).toEqual({ Carnatic: 'Carnatic' })
  })

  it('markRestricted writes through to sessionStore', () => {
    const tools = buildAdmirerTools({})
    tools.markRestricted({ repertoire: 'temple bhajans' })
    expect(sessionStore.getRestricted()).toContain('temple bhajans')
  })

  it('playFragment calls onPlayFragment with the resolved fragment', () => {
    const onPlayFragment = vi.fn()
    const tools = buildAdmirerTools({ onPlayFragment })
    tools.playFragment({ fragmentId: 'warm-acoustic-now' })
    expect(onPlayFragment).toHaveBeenCalledOnce()
    const arg = onPlayFragment.mock.calls[0][0]
    expect(arg.id).toBe('warm-acoustic-now')
    expect(arg.url).toMatch(/\.mp3$/)
  })

  it('playFragment is a no-op for unknown ids', () => {
    const onPlayFragment = vi.fn()
    const tools = buildAdmirerTools({ onPlayFragment })
    tools.playFragment({ fragmentId: 'nope' })
    expect(onPlayFragment).not.toHaveBeenCalled()
  })

  it('startGeneration resolves a bundle and calls onStartGeneration', () => {
    const onStartGeneration = vi.fn()
    const tools = buildAdmirerTools({ onStartGeneration })
    tools.startGeneration({
      tempo: 'medium', mood: 'warm', era: 2014, instrumentation: 'acoustic',
    })
    expect(onStartGeneration).toHaveBeenCalledOnce()
    const bundle = onStartGeneration.mock.calls[0][0]
    expect(bundle.archetypeId).toBe('hearth-keeper')
    expect(bundle.stems).toBeTruthy()
  })

  it('startGeneration respects restricted_repertoires from sessionStore', () => {
    sessionStore.addRestricted('hearth-keeper')
    const onStartGeneration = vi.fn()
    const tools = buildAdmirerTools({ onStartGeneration })
    tools.startGeneration({ mood: 'warm' })
    const bundle = onStartGeneration.mock.calls[0][0]
    expect(bundle.archetypeId).not.toBe('hearth-keeper')
  })

  it('commitEntry appends a session entry and calls onCommitEntry', () => {
    const onCommitEntry = vi.fn()
    const tools = buildAdmirerTools({ onCommitEntry })
    tools.commitEntry({ summary: 'a session that went warm' })
    expect(sessionStore.getEntries().length).toBe(1)
    expect(onCommitEntry).toHaveBeenCalledOnce()
  })

  it('commitArtifact stores label + calls onCommitArtifact', () => {
    const onCommitArtifact = vi.fn()
    const tools = buildAdmirerTools({ onCommitArtifact })
    tools.commitArtifact({ label: 'my mom\'s tape', content: 'verbal description' })
    expect(onCommitArtifact).toHaveBeenCalledOnce()
    expect(onCommitArtifact.mock.calls[0][0].label).toBe("my mom's tape")
  })
})

describe('startGeneration — AVD routing', () => {
  beforeEach(() => resetAvd())

  it('uses the AVD path once a turn has committed', () => {
    commitTurn({ a: 1, v: 1, d: 1 }) // pushes toward sky-seeker; turnCount → 1
    let bundle = null
    const tools = buildAdmirerTools({ onStartGeneration: (b) => { bundle = b } })
    const res = tools.startGeneration({ era: 2015 })
    expect(res.ok).toBe(true)
    expect(bundle.archetypeId).toBe('sky-seeker')
  })

  it('falls back to the descriptor path when no turn has committed', () => {
    let bundle = null
    const tools = buildAdmirerTools({ onStartGeneration: (b) => { bundle = b } })
    tools.startGeneration({ mood: 'tense' }) // descriptorsToStems: tense → quiet-insurgent
    expect(bundle.archetypeId).toBe('quiet-insurgent')
  })
})
