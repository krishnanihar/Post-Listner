import { describe, it, expect } from 'vitest'
import { buildReflectionLines } from '../reflectionLines'

describe('buildReflectionLines', () => {
  const baseAvd = { a: 0.5, v: 0.5, d: 0.5 }

  it('produces four lines: spectrum, depth, textures, moment', () => {
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
      moment: { totalTaps: 14, peakTapRate: 1.6, tapsDuringBuild: 10, tapsDuringRelease: 4 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.spectrum).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.depth).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.textures).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
    expect(lines.moment).toMatchObject({ signal: expect.any(String), interpretation: expect.any(String) })
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

  it('textures line lists preferred names', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: ['strings', 'voice', 'field'], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.textures.signal).toContain('strings')
    expect(lines.textures.signal).toContain('voice')
    expect(lines.textures.signal).toContain('field')
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

  it('handles missing/zero data gracefully', () => {
    const phaseData = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 1, maxLayer: 1 },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, peakTapRate: 0, tapsDuringBuild: 0, tapsDuringRelease: 0 },
    }
    const lines = buildReflectionLines(baseAvd, phaseData)
    expect(lines.spectrum.signal).toBeTruthy()
    expect(lines.depth.signal).toBeTruthy()
    expect(lines.textures.signal).toBeTruthy()
    expect(lines.moment.signal).toBeTruthy()
  })
})
