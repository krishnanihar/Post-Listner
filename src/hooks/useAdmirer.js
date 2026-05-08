import { useCallback, useEffect, useRef } from 'react'
import { hashText } from '../lib/textHash'

// In-memory cache shared across all useAdmirer instances. Once a line is
// fetched, the same Blob URL is reused for the rest of the session.
const cache = new Map() // hash → { url: string, promise: Promise<string> }

async function fetchLine(text, register) {
  const res = await fetch('/api/admirer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, register }),
  })
  if (!res.ok) {
    throw new Error(`admirer fetch failed: ${res.status}`)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

function ensureCached(text, register) {
  const key = hashText(`${register}:${text}`)
  let entry = cache.get(key)
  if (entry) return entry.promise
  const promise = fetchLine(text, register)
    .then(url => {
      cache.set(key, { url, promise: Promise.resolve(url) })
      return url
    })
    .catch(err => {
      cache.delete(key)
      throw err
    })
  cache.set(key, { url: null, promise })
  return promise
}

export function useAdmirer() {
  const audiosRef = useRef([])

  // Stop any audio elements this hook started, on unmount.
  useEffect(() => {
    return () => {
      for (const a of audiosRef.current) {
        try { a.pause() } catch { /* ignore */ }
      }
      audiosRef.current = []
    }
  }, [])

  const preload = useCallback((text, register = 'present') => {
    return ensureCached(text, register).catch(() => { /* swallow — preload is best-effort */ })
  }, [])

  const play = useCallback(async (text, register = 'present') => {
    try {
      const url = await ensureCached(text, register)
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
