import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchTracks } from '../itunesSearch'

describe('searchTracks', () => {
  let originalFetch
  beforeEach(() => {
    originalFetch = global.fetch
  })
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns a normalized track list from iTunes results', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        resultCount: 2,
        results: [
          {
            trackName: 'Karma Police',
            artistName: 'Radiohead',
            releaseDate: '1997-08-25T07:00:00Z',
            trackId: 12345,
            artworkUrl60: 'https://example.com/a.jpg',
          },
          {
            trackName: 'No Surprises',
            artistName: 'Radiohead',
            releaseDate: '1998-01-12T07:00:00Z',
            trackId: 12346,
            artworkUrl60: 'https://example.com/b.jpg',
          },
        ],
      }),
    })
    const tracks = await searchTracks('radiohead karma')
    expect(tracks).toHaveLength(2)
    expect(tracks[0]).toEqual({
      title: 'Karma Police',
      artist: 'Radiohead',
      year: 1997,
      id: 12345,
      artworkUrl: 'https://example.com/a.jpg',
    })
    expect(tracks[1].year).toBe(1998)
  })

  it('returns empty array when iTunes returns no results', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ resultCount: 0, results: [] }),
    })
    const tracks = await searchTracks('asdfqwer')
    expect(tracks).toEqual([])
  })

  it('handles tracks without releaseDate', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { trackName: 'X', artistName: 'Y', trackId: 1 },
        ],
      }),
    })
    const tracks = await searchTracks('x')
    expect(tracks[0].year).toBeNull()
  })

  it('throws when fetch returns non-ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    await expect(searchTracks('x')).rejects.toThrow(/iTunes/i)
  })

  it('returns empty array for empty query', async () => {
    global.fetch = vi.fn()
    const tracks = await searchTracks('')
    expect(tracks).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('encodes query parameters correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    })
    await searchTracks('radiohead & friends')
    const calledUrl = global.fetch.mock.calls[0][0]
    expect(calledUrl).toContain('term=radiohead%20%26%20friends')
  })

  it('rejects with AbortError when signal is pre-aborted', async () => {
    global.fetch = vi.fn((_url, opts) => {
      // Simulate the browser's behavior: if the signal is already aborted,
      // fetch rejects with an AbortError.
      if (opts?.signal?.aborted) {
        return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })
    })
    const controller = new AbortController()
    controller.abort()
    await expect(searchTracks('radiohead', controller.signal)).rejects.toThrow(/abort/i)
  })
})
