/* Ambient-audio hook for /conduct-glb.
 *
 * Loads a single MP3 via HTMLAudioElement, wires it into an
 * AudioContext + AnalyserNode (fftSize 256 → 128 frequency bins), and
 * exposes the per-frame Uint8Array as a ref so the render loop can read
 * it without triggering React re-renders.
 *
 * Browser autoplay policies: most browsers block AudioContext.resume()
 * and HTMLAudioElement.play() until a user gesture occurs. This hook
 * exposes a `needsGesture` flag and a `tryStart` function that the UI
 * can wire to a "tap to begin" overlay.
 *
 * Lifecycle: AudioContext + AnalyserNode are created lazily on first
 * `tryStart()` call (browsers can decode-time-error if you create the
 * context before user interaction). The hook does not auto-start.
 */
import { useEffect, useRef, useState } from 'react'

export function useAmbientAudio({ src }) {
  const audioRef = useRef(null)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const freqDataRef = useRef(new Uint8Array(128))

  const [needsGesture, setNeedsGesture] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const a = new Audio(src)
    a.loop = true
    a.crossOrigin = 'anonymous'
    a.preload = 'auto'
    audioRef.current = a
    return () => {
      a.pause()
      a.src = ''
    }
  }, [src])

  async function tryStart() {
    const a = audioRef.current
    if (!a) return false

    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx()
      const source = ctx.createMediaElementSource(a)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)
      analyser.connect(ctx.destination)
      ctxRef.current = ctx
      analyserRef.current = analyser
    }

    try {
      if (ctxRef.current.state === 'suspended') {
        await ctxRef.current.resume()
      }
      await a.play()
      setPlaying(true)
      setNeedsGesture(false)
      setError(null)
      return true
    } catch (err) {
      setError(err?.message || String(err))
      setNeedsGesture(true)
      return false
    }
  }

  function pause() {
    audioRef.current?.pause()
    setPlaying(false)
  }

  function pollFrequency() {
    if (analyserRef.current) {
      analyserRef.current.getByteFrequencyData(freqDataRef.current)
    }
  }

  return {
    needsGesture,
    playing,
    error,
    tryStart,
    pause,
    pollFrequency,
    freqDataRef,
  }
}
