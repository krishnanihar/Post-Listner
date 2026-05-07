import { describe, it, expect } from 'vitest'
import {
  buildBecauseLine,
  buildMemoryCallback,
  buildTimeOfDayLine,
  buildLatencyLine,
  buildTemporalFrame,
} from '../forerLines'

const fakePhaseData = (overrides = {}) => ({
  spectrum: {
    pairs: [
      { choice: 'right', label: 'warmth', reactionMs: 2200 },
      { choice: 'right', label: 'shimmer', reactionMs: 1800 },
      { choice: 'left', label: 'weight', reactionMs: 3000 },
    ],
    hoveredButNotChosen: [],
  },
  depth: { finalLayer: 5 },
  textures: { preferred: ['strings'], rejected: [], neutral: [] },
  moment: { totalTaps: 14, peakTapRate: 1.4 },
  ...overrides,
})

describe('buildBecauseLine', () => {
  it('returns an array of 3 short fragments', () => {
    const fragments = buildBecauseLine(fakePhaseData())
    expect(fragments).toHaveLength(3)
    for (const f of fragments) {
      expect(typeof f).toBe('string')
      expect(f.toLowerCase().startsWith('because')).toBe(true)
    }
  })

  it('mentions a real spectrum word, the depth, and a tempo descriptor', () => {
    const fragments = buildBecauseLine(fakePhaseData())
    const joined = fragments.join(' ').toLowerCase()
    expect(joined).toContain('warmth')
  })

  it('uses score-flow totalDownbeats to pick a tempo descriptor', () => {
    // 60 downbeats over 30s = 120 BPM → "tapped with momentum" (>= 100, < 130).
    const phaseData = {
      spectrum: {
        pairs: [{ choice: 'right', label: 'warmth', reactionMs: 2000 }],
        hoveredButNotChosen: [],
      },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalDownbeats: 60, avgGestureGain: 0.5, tactus: [] },
    }
    const fragments = buildBecauseLine(phaseData)
    expect(fragments[2].toLowerCase()).toContain('momentum')
  })

  it('falls back to "held still" when no tempo is recorded', () => {
    const phaseData = {
      spectrum: {
        pairs: [{ choice: 'right', label: 'warmth' }],
        hoveredButNotChosen: [],
      },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalDownbeats: 0, avgGestureGain: 0, tactus: [] },
    }
    const fragments = buildBecauseLine(phaseData)
    expect(fragments[2].toLowerCase()).toContain('held still')
  })
})

describe('buildMemoryCallback', () => {
  it('returns a string that names a kept texture or chosen word', () => {
    const line = buildMemoryCallback(fakePhaseData())
    expect(typeof line).toBe('string')
    expect(line.toLowerCase()).toMatch(/strings|warmth|shimmer/)
  })

  it('returns null when no texture is kept and no spectrum pair has a label', () => {
    const line = buildMemoryCallback({
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0 },
    })
    expect(line).toBeNull()
  })

  it('prefers autobio songs over textures when present', () => {
    const phaseData = {
      spectrum: { pairs: [{ choice: 'right', label: 'warmth' }], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: ['strings'], rejected: [], neutral: [] },
      moment: { totalDownbeats: 30 },
      autobio: {
        songs: [
          { title: 'Karma Police', artist: 'Radiohead', year: 1997, prompt: 'became_someone' },
        ],
        eraSummary: { median: 1997, span: 0, clustered: false },
      },
    }
    const line = buildMemoryCallback(phaseData)
    expect(line).toContain('Karma Police')
    expect(line).toContain('1997')
  })

  it('falls back to textures when autobio.songs is empty', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: ['strings'], rejected: [], neutral: [] },
      moment: { totalDownbeats: 30 },
      autobio: { songs: [], eraSummary: null },
    }
    const line = buildMemoryCallback(phaseData)
    expect(line).toContain('strings')
  })

  it('handles autobio song without year', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalDownbeats: 0 },
      autobio: {
        songs: [{ title: 'Some Song', artist: '', year: null, prompt: 'first_yours' }],
        eraSummary: { median: null, span: 0, clustered: false },
      },
    }
    const line = buildMemoryCallback(phaseData)
    expect(line).toContain('Some Song')
    // No year should mean no year-specific phrasing crash
    expect(line).not.toContain('null')
  })
})

describe('buildTimeOfDayLine', () => {
  it('returns a late-hour line at midnight', () => {
    const at = new Date('2026-05-08T23:30:00')
    expect(buildTimeOfDayLine(at).toLowerCase()).toContain('hour')
  })

  it('returns an early-morning line at 6am', () => {
    const at = new Date('2026-05-08T06:30:00')
    expect(buildTimeOfDayLine(at).toLowerCase()).toMatch(/early|got here/)
  })

  it('returns a midday line at noon', () => {
    const at = new Date('2026-05-08T12:30:00')
    expect(buildTimeOfDayLine(at).toLowerCase()).toContain('middle')
  })

  it('returns an evening line at 8pm', () => {
    const at = new Date('2026-05-08T20:00:00')
    expect(typeof buildTimeOfDayLine(at)).toBe('string')
  })
})

describe('buildLatencyLine', () => {
  it('returns a "took your time" line for slow average reaction', () => {
    const phaseData = fakePhaseData({
      spectrum: {
        pairs: [{ reactionMs: 4000 }, { reactionMs: 4500 }, { reactionMs: 5000 }],
        hoveredButNotChosen: [],
      },
    })
    expect(buildLatencyLine(phaseData).toLowerCase()).toContain('time')
  })

  it('returns a "knew what you wanted" line for fast average reaction', () => {
    const phaseData = fakePhaseData({
      spectrum: {
        pairs: [{ reactionMs: 1200 }, { reactionMs: 1100 }, { reactionMs: 1000 }],
        hoveredButNotChosen: [],
      },
    })
    expect(buildLatencyLine(phaseData).toLowerCase()).toMatch(/knew|certain|wanted/)
  })

  it('returns null for empty data', () => {
    expect(buildLatencyLine({
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0 },
    })).toBeNull()
  })
})

describe('buildTemporalFrame', () => {
  it('formats the time and date and includes "Has never existed before"', () => {
    const at = new Date('2026-05-08T23:47:00')
    const line = buildTemporalFrame(at)
    expect(line).toContain('11:47')
    expect(line).toContain('2026')
    expect(line.toLowerCase()).toContain('never existed before')
  })
})
