import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildAdmirerTools } from '../admirerTools'
import * as sessionStore from '../sessionStore'

describe('buildAdmirerTools', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('exposes all 6 tool names', () => {
    const tools = buildAdmirerTools({})
    expect(Object.keys(tools).sort()).toEqual([
      'commitArtifact',
      'commitEntry',
      'markRestricted',
      'playFragment',
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
