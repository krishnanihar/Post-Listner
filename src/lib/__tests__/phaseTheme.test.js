import { describe, it, expect, vi, beforeEach } from 'vitest'

// phaseTheme reads NOCTURNE_ENABLED at module load, so each branch is exercised
// by re-importing the module behind a mocked flag. This keeps both mappings
// covered regardless of which way the flag currently defaults — the Nocturne
// pass flipped the default to on, and the cream mapping must stay intact for
// the VITE_ENABLE_NOCTURNE=false opt-out.
async function loadPhaseTheme({ nocturne }) {
  vi.resetModules()
  vi.doMock('../../world/flags.js', () => ({
    NOCTURNE_ENABLED: nocturne,
    THRONE_INTRO_RAMP_ENABLED: nocturne,
    FALTER_ENABLED: nocturne,
  }))
  return import('../phaseTheme.js')
}

beforeEach(() => {
  vi.resetModules()
  vi.doUnmock('../../world/flags.js')
})

describe('inkForPhase — Nocturne on (the shipped default)', () => {
  it('returns the light ink for entry + admirer (the dark WorldStage)', async () => {
    const { inkForPhase } = await loadPhaseTheme({ nocturne: true })
    expect(inkForPhase('entry')).toBe('#E8E4DD')
    expect(inkForPhase('admirer')).toBe('#E8E4DD')
  })

  it('leaves settle on the cream record and orchestra dark', async () => {
    const { inkForPhase } = await loadPhaseTheme({ nocturne: true })
    expect(inkForPhase('settle')).toBe('#1C1814')
    expect(inkForPhase('orchestra')).toBe('#E8E4DD')
  })

  it('flips the secondary ink for entry + admirer too', async () => {
    const { ink2ForPhase } = await loadPhaseTheme({ nocturne: true })
    expect(ink2ForPhase('entry')).toBe('#8A7556')
    expect(ink2ForPhase('admirer')).toBe('#8A7556')
    expect(ink2ForPhase('settle')).toBe('#6B5840')
  })
})

describe('inkForPhase — Nocturne off (the VITE_ENABLE_NOCTURNE=false opt-out)', () => {
  it('returns the dark ink for the cream-paper phases', async () => {
    const { inkForPhase } = await loadPhaseTheme({ nocturne: false })
    expect(inkForPhase('entry')).toBe('#1C1814')
    expect(inkForPhase('admirer')).toBe('#1C1814')
    expect(inkForPhase('settle')).toBe('#1C1814')
  })

  it('returns the light cream ink for the orchestra phase (dark bg)', async () => {
    const { inkForPhase } = await loadPhaseTheme({ nocturne: false })
    expect(inkForPhase('orchestra')).toBe('#E8E4DD')
  })

  it('returns the cream secondary ink for the cream-paper phases', async () => {
    const { ink2ForPhase } = await loadPhaseTheme({ nocturne: false })
    expect(ink2ForPhase('entry')).toBe('#6B5840')
    expect(ink2ForPhase('admirer')).toBe('#6B5840')
  })
})

describe('inkForPhase — unknown phases', () => {
  it('falls back to the dark ink under either flag', async () => {
    const on = await loadPhaseTheme({ nocturne: true })
    expect(on.inkForPhase('unknown-phase')).toBe('#1C1814')
    const off = await loadPhaseTheme({ nocturne: false })
    expect(off.inkForPhase('unknown-phase')).toBe('#1C1814')
  })
})
