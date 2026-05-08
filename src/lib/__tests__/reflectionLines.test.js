import { describe, it, expect } from 'vitest'
import { buildReflectionLines } from '../reflectionLines'

describe('buildReflectionLines', () => {
  const baseAvd = { a: 0.5, v: 0.5, d: 0.5 }

  it('produces five lines: spectrum, depth, gems, moment, autobio', () => {
    const phaseData = {
      spectrum: {
        pairs: [
          { choice: 'left', label: 'shadow' }, { choice: 'right', label: 'warmth' },
          { choice: 'right', label: 'shimmer' }, { choice: 'right', label: 'air' },
          { choice: 'right', label: 'bloom' }, { choice: 'left', label: 'machine' },
          { choice: 'right', label: 'resolve' }, { choice: 'right', label: 'glass' },
        ],
        hoveredButNotChosen: [],
      },
      depth: { finalLayer: 5, maxLayer: 6 },
      textures: { preferred: ['strings', 'keys'], rejected: [], neutral: [] },
      gems: { excerpts: [{ id: 'sublimity', tilesSelected: ['awed', 'peaceful'] }] },
      moment: { totalDownbeats: 30, avgGestureGain: 0.4, tactus: [] },
      autobio: {
        songs: [{ title: 'A', artist: 'X', year: 2003 }],
        eraSummary: { median: 2003, span: 0, clustered: false },
      },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.spectrum).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.depth).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.gems).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.moment).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.autobio).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
  })

  it('spectrum line counts the dominant side and references it', () => {
    const phaseData = {
      spectrum: {
        pairs: Array.from({ length: 8 }, (_, i) => ({
          choice: i < 6 ? 'right' : 'left',
          label: i < 6 ? 'warmth' : 'shadow',
        })),
        hoveredButNotChosen: [],
      },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.spectrum.signal).toMatch(/6/)
    expect(lines.spectrum.signal.toLowerCase()).toMatch(/8/)
  })

  it('depth line includes the final layer count', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 7, maxLayer: 7 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.depth.signal).toMatch(/7/)
  })

  it('moment line includes a BPM-like number', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 14, peakTapRate: 1.5, tapsDuringBuild: 10, tapsDuringRelease: 4 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.moment.signal).toMatch(/\d+\s*BPM/i)
  })

  it('derives BPM from totalDownbeats when peakTapRate absent (score flow)', () => {
    // Moment.score.jsx writes { totalDownbeats, avgGestureGain, tactus } over a 30s phase.
    // 30 downbeats over 30s = 60 BPM.
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalDownbeats: 30, avgGestureGain: 0.4, tactus: [] },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.moment.signal).toMatch(/60\s*BPM/i)
  })

  it('reports stillness when no tempo data is recorded', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalDownbeats: 0, avgGestureGain: 0, tactus: [] },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.moment.signal.toLowerCase()).toContain('no tempo')
    expect(lines.moment.interpretation.toLowerCase()).toContain('stillness')
  })

  it('handles missing/zero data gracefully', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1, maxLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: { excerpts: [] },
      moment: { totalDownbeats: 0, avgGestureGain: 0, tactus: [] },
      autobio: { songs: [], eraSummary: null },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.spectrum.signal).toBeTruthy()
    expect(lines.depth.signal).toBeTruthy()
    expect(lines.gems.signal).toBeTruthy()
    expect(lines.moment.signal).toBeTruthy()
    expect(lines.autobio.signal).toBeTruthy()
  })

  it('gems line names the dominant tile', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: {
        excerpts: [
          { id: 'a', tilesSelected: ['nostalgic', 'tender'] },
          { id: 'b', tilesSelected: ['nostalgic'] },
          { id: 'c', tilesSelected: ['defiant'] },
        ],
      },
      moment: { totalDownbeats: 30 },
      autobio: { songs: [], eraSummary: null },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.gems.signal.toLowerCase()).toContain('nostalgic')
  })

  it('gems line falls back gracefully when no tiles selected', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: { excerpts: [] },
      moment: { totalDownbeats: 0 },
      autobio: { songs: [], eraSummary: null },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.gems.signal).toBeTruthy()
    expect(lines.gems.interpretation).toBeTruthy()
  })

  it('autobio line names a year when songs are present', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: { excerpts: [] },
      moment: { totalDownbeats: 30 },
      autobio: {
        songs: [
          { title: 'A', artist: 'X', year: 2001 },
          { title: 'B', artist: 'Y', year: 2003 },
          { title: 'C', artist: 'Z', year: 2005 },
        ],
        eraSummary: { median: 2003, span: 4, clustered: true, tightCluster: true },
      },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.autobio.signal).toContain('2003')
  })

  it('autobio surfaces formative-window language for tightCluster', () => {
    const phaseData = {
      autobio: {
        songs: [
          { title: 'Karma Police', artist: 'Radiohead', year: 1997 },
          { title: 'Paranoid Android', artist: 'Radiohead', year: 1997 },
          { title: 'No Surprises', artist: 'Radiohead', year: 1998 },
        ],
        eraSummary: { median: 1997, span: 1, clustered: true, tightCluster: true },
      },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.autobio.interpretation).toMatch(/formative window/i)
    expect(lines.autobio.signal).toMatch(/bump period|1997/i)
  })

  it('autobio surfaces decade language when clustered but not tight', () => {
    const phaseData = {
      autobio: {
        songs: [
          { title: 'Song A', artist: 'X', year: 1992 },
          { title: 'Song B', artist: 'Y', year: 1998 },
          { title: 'Song C', artist: 'Z', year: 2001 },
        ],
        eraSummary: { median: 1998, span: 9, clustered: true, tightCluster: false },
      },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.autobio.interpretation).toMatch(/centre of gravity|decade/i)
  })

  it('autobio line falls back gracefully when no songs', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: { excerpts: [] },
      moment: { totalDownbeats: 0 },
      autobio: { songs: [], eraSummary: null },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.autobio.signal).toBeTruthy()
  })
})
