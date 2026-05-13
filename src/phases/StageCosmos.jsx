import { useRef, useEffect } from 'react'
import ConductorCelestialField from '../conductor-glb/ConductorCelestialField'
import { usePhoneConductor } from '../conductor-codex/usePhoneConductor'

/**
 * StageCosmos — desktop cosmos canvas driven by WS-streamed phone signals.
 *
 * Replaces /conduct-glb's local-MP3 + AnalyserNode + usePhoneConductor with:
 *   - WS-sourced FFT (passed in via prop from Stage)
 *   - WS-sourced gesture data via usePhoneConductor(sessionId)
 *
 * The ConductorCelestialField only reads {freqDataRef: {current: Uint8Array(128)}}
 * for audio, so we synthesize a matching shape.
 */
export default function StageCosmos({ sessionId, latestFreq }) {
  const freqDataRef = useRef(new Uint8Array(128))

  useEffect(() => {
    if (latestFreq && latestFreq.length === 128) {
      freqDataRef.current.set(latestFreq)
    }
  }, [latestFreq])

  const phone = usePhoneConductor(sessionId)
  // ConductorCelestialField's rAF loop calls audio.pollFrequency() every
  // frame to refresh freqDataRef.current from a local AnalyserNode. In our
  // case the ref is already up to date (the useEffect above sets it on
  // every {type:'audio'} WS message), so pollFrequency is a no-op. Without
  // this method, the rAF loop throws TypeError every frame and the canvas
  // never renders its reactive layers.
  const audio = {
    freqDataRef,
    playing: true,
    needsGesture: false,
    pollFrequency: () => {},
  }

  return <ConductorCelestialField audio={audio} phone={phone} />
}
