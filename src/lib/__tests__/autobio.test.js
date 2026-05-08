import { describe, it, expect } from 'vitest'
import { validateSong, summarizeAutobio } from '../autobio'

describe('validateSong', () => {
  it('accepts a complete song entry', () => {
    expect(validateSong({ title: 'Karma Police', artist: 'Radiohead', year: 1997 }))
      .toEqual({ valid: true, reason: null })
  })

  it('accepts a song without a year (free-text fallback)', () => {
    const result = validateSong({ title: 'Karma Police', artist: 'Radiohead', year: null })
    expect(result.valid).toBe(true)
  })

  it('rejects a song missing both title and artist', () => {
    expect(validateSong({ title: '', artist: '', year: null }).valid).toBe(false)
  })

  it('rejects a song missing title', () => {
    expect(validateSong({ title: '', artist: 'Radiohead', year: 1997 }).valid).toBe(false)
  })

  it('rejects null or undefined input', () => {
    expect(validateSong(null).valid).toBe(false)
    expect(validateSong(undefined).valid).toBe(false)
  })
})

describe('summarizeAutobio', () => {
  it('returns empty summary for no songs', () => {
    const result = summarizeAutobio([])
    expect(result.songs).toEqual([])
    expect(result.eraSummary).toEqual({ median: null, span: 0, clustered: false, tightCluster: false })
  })

  it('extracts years and computes era cluster', () => {
    const songs = [
      { title: 'A', artist: 'X', year: 2001 },
      { title: 'B', artist: 'Y', year: 2003 },
      { title: 'C', artist: 'Z', year: 2005 },
    ]
    const result = summarizeAutobio(songs)
    expect(result.songs).toHaveLength(3)
    expect(result.eraSummary.median).toBe(2003)
    expect(result.eraSummary.clustered).toBe(true)
  })

  it('handles songs without year', () => {
    const songs = [
      { title: 'A', artist: 'X', year: null },
      { title: 'B', artist: 'Y', year: 2003 },
    ]
    const result = summarizeAutobio(songs)
    expect(result.songs).toHaveLength(2)
    expect(result.eraSummary.median).toBe(2003)
  })
})
