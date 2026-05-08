import { useCallback, useEffect, useRef } from 'react'

// In-memory cache shared across all useAdmirer instances. Once a line is
// fetched, the same Blob URL is reused for the rest of the session.
// Key is the lineId itself — text + register are resolved server-side
// from a fixed allowlist, so the lineId fully identifies the audio.
const cache = new Map() // lineId → { url: string, promise: Promise<string> }

async function fetchLine(lineId) {
  const res = await fetch('/api/admirer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineId }),
  })
  if (!res.ok) {
    throw new Error(`admirer fetch failed: ${res.status}`)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

function ensureCached(lineId) {
  let entry = cache.get(lineId)
  if (entry) return entry.promise
  const promise = fetchLine(lineId)
    .then(url => {
      cache.set(lineId, { url, promise: Promise.resolve(url) })
      return url
    })
    .catch(err => {
      cache.delete(lineId)
      throw err
    })
  cache.set(lineId, { url: null, promise })
  return promise
}

export function useAdmirer() {
  const audiosRef = useRef([])
  // Mount guard — if the fetch resolves after the phase unmounts, don't
  // create an Audio element. Without this, an intro line from the previous
  // phase can start playing inside the next one when /api/admirer is slow.
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      for (const a of audiosRef.current) {
        try { a.pause() } catch { /* ignore */ }
      }
      audiosRef.current = []
    }
  }, [])

  const preload = useCallback((lineId) => {
    return ensureCached(lineId).catch(() => { /* swallow — preload is best-effort */ })
  }, [])

  const play = useCallback(async (lineId) => {
    try {
      const url = await ensureCached(lineId)
      if (!mountedRef.current) return null  // stale resolution from a prior phase
      const audio = new Audio(url)
      audio.volume = 0.85
      audiosRef.current.push(audio)
      await audio.play().catch(() => { /* user-gesture required, swallow */ })
      return audio
    } catch {
      // Fail silently — voice is enhancement, not gating.
      return null
    }
  }, [])

  return { play, preload }
}
