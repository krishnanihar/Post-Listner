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
  const audio = { freqDataRef, playing: true, needsGesture: false }

  return <ConductorCelestialField audio={audio} phone={phone} />
}
