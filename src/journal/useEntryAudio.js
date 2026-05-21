import { useCallback, useEffect, useRef, useState } from 'react'
import { getMasterUrl } from '../lib/stemsCatalog.js'

/**
 * useEntryAudio — streams and controls one entry's master MP3 for the
 * journal detail view (spec §3).
 *
 * `song` is the entry's "archetypeId/variationId" string. The hook resolves
 * the master URL, owns a plain HTMLAudioElement (no WebAudio graph — the
 * glyph is driven by playback position, not frequency), and exposes:
 *   available    — false when there is no song or the file fails to load
 *   playing      — boolean; drives the glyph's idle-vs-animated mode
 *   toggle()     — play if paused, pause if playing (call from a user tap)
 *   progressRef  — ref holding currentTime/duration (0..1), refreshed by a
 *                  rAF loop while playing, so the glyph reads smooth progress
 *                  without re-rendering the page
 */
export function useEntryAudio(song) {
  const [available, setAvailable] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const progressRef = useRef(0)

  // build / tear down the audio element when the song changes
  useEffect(() => {
    progressRef.current = 0
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaying(false) // reset on song change
    setAvailable(false)

    if (!song || typeof song !== 'string' || !song.includes('/')) {
      audioRef.current = null
      return undefined
    }
    const [archetypeId, variationId] = song.split('/')
    const audio = new Audio(getMasterUrl(archetypeId, variationId))
    audio.preload = 'auto'
    audioRef.current = audio

    const onReady = () => setAvailable(true)
    const onError = () => {
      setAvailable(false)
      setPlaying(false)
    }
    const onEnded = () => {
      // pin progress to 1 so the idle repaint shows the complete mark, not
      // the ~99%-drawn path the rAF loop last sampled before the track ended
      progressRef.current = 1
      setPlaying(false)
    }
    audio.addEventListener('loadedmetadata', onReady)
    audio.addEventListener('error', onError)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', onReady)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('ended', onEnded)
      audio.src = ''
      audioRef.current = null
    }
  }, [song])

  // progress loop — runs only while playing, writes a ref (no re-render)
  useEffect(() => {
    if (!playing) return undefined
    let raf = 0
    const tick = () => {
      const audio = audioRef.current
      if (audio && audio.duration > 0) {
        progressRef.current = audio.currentTime / audio.duration
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      // a finished track restarts from the top
      if (audio.ended || (audio.duration > 0 && audio.currentTime >= audio.duration)) {
        audio.currentTime = 0
        progressRef.current = 0
      }
      audio
        .play()
        .then(() => { if (audioRef.current === audio) setPlaying(true) })
        .catch(() => { if (audioRef.current === audio) setPlaying(false) })
    } else {
      audio.pause()
      setPlaying(false)
    }
  }, [])

  return { available, playing, toggle, progressRef }
}
