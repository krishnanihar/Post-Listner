import { useState, useCallback, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Analytics } from '@vercel/analytics/react'
import Entry from './phases/Entry.score'
import Spectrum from './phases/Spectrum.score'
import Gems from './phases/Gems.score'
import Moment from './phases/Moment.score'
import Autobio from './phases/Autobio.score'
import Reflection from './phases/Reflection.score'
import Reveal from './phases/Reveal.score'
import Orchestra from './phases/Orchestra'
import { avdEngine } from './engine/avd'
import { audioEngine } from './engine/audio'
import { useInputMode } from './hooks/useInputMode'
import { startOrchestraPreload } from './orchestra/preloader'

const PHASES = ['entry', 'spectrum', 'gems', 'moment', 'autobio', 'reflection', 'reveal', 'orchestra']

const _params = new URLSearchParams(window.location.search)
const _startPhase = _params.get('phase')

function App() {
  const [phase, setPhase] = useState(PHASES.includes(_startPhase) ? _startPhase : 'entry')
  const [sessionData, setSessionData] = useState({})

  // ─── Relay client (only active when ?s= is present and we're paired) ────
  const relayRef = useRef(null)
  const sessionIdRef = useRef(null)
  // Tracks the current phase so the relay's onOpen callback can emit it
  // immediately (the relay opens async, so the first phase change may have
  // happened before the socket is ready).
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // Tracks whether we've been in 'orchestra' this session so we can detect
  // the "completed and looped back to entry" terminal transition and emit
  // session:end to the relay.
  const sawOrchestraRef = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('s')
    if (!s) return  // solo mode, no relay

    // Lazy-load RelayClient + isValidSessionId so the solo path doesn't pay the cost
    import('./lib/relayClient.js').then(({ default: RelayClient }) => {
      import('./lib/sessionId.js').then(({ isValidSessionId }) => {
        if (!isValidSessionId(s)) return
        sessionIdRef.current = s

        const baseUrl = import.meta.env.VITE_RELAY_URL || 'wss://localhost:8443'
        const client = new RelayClient({
          baseUrl,
          sessionId: s,
          role: 'conductor',
          onOpen: () => {
            // Send the current phase immediately on (re)connect — the very
            // first phase change may have happened before the socket opened,
            // and reconnects need to re-sync viewers to current state.
            console.log(`[relay] paired to session ${s}`)
            client.send({ type: 'phase', phase: phaseRef.current })
          },
        })
        client.start()
        relayRef.current = client
      })
    })

    return () => {
      if (relayRef.current) relayRef.current.stop()
    }
  }, [])

  // Emit phase changes to the relay so the Stage can update its UI.
  // Also detect rite completion (orchestra → entry transition) and emit
  // session:end so viewers return to their waiting state cleanly.
  useEffect(() => {
    if (!relayRef.current) return
    if (phase === 'orchestra') sawOrchestraRef.current = true
    relayRef.current.send({ type: 'phase', phase })
    if (phase === 'entry' && sawOrchestraRef.current) {
      relayRef.current.send({ type: 'session:end' })
      sawOrchestraRef.current = false
    }
  }, [phase])

  const inputMode = useInputMode()

  // If skipping Entry via ?phase=, init audio so voices/sounds work
  useEffect(() => {
    if (_startPhase && _startPhase !== 'entry') {
      audioEngine.init()
      audioEngine.resume()
    }
  }, [])

  // Warm Orchestra asset cache during Reveal so the post-Reveal seam is gapless.
  useEffect(() => {
    if (phase === 'reveal' && audioEngine.ctx) {
      startOrchestraPreload(audioEngine.ctx)
    }
  }, [phase])

  const stemsBundleRef = useRef(null)
  const revealAudioRef = useRef(null)

  const nextPhase = useCallback((data = {}) => {
    const { stemsBundle, ...rest } = data
    if (stemsBundle) stemsBundleRef.current = stemsBundle
    setSessionData(prev => ({ ...prev, ...rest }))
    const idx = PHASES.indexOf(phase)
    if (idx < PHASES.length - 1) {
      setPhase(PHASES[idx + 1])
    }
  }, [phase])

  const goToPhase = useCallback((p) => setPhase(p), [])

  // audioEngine.ctx is created and resumed during Entry tap — reuse it for Orchestra
  const getAudioCtx = useCallback(() => audioEngine.ctx, [])

  const phaseComponent = {
    entry: <Entry onNext={nextPhase} />,
    spectrum: <Spectrum onNext={nextPhase} avd={avdEngine} inputMode={inputMode} />,
    gems: <Gems onNext={nextPhase} avd={avdEngine} />,
    moment: <Moment onNext={nextPhase} avd={avdEngine} inputMode={inputMode} />,
    autobio: <Autobio onNext={nextPhase} avd={avdEngine} />,
    reflection: <Reflection onNext={nextPhase} avd={avdEngine} />,
    reveal: <Reveal onNext={nextPhase} avd={avdEngine} sessionData={{ ...sessionData, stemsBundle: stemsBundleRef.current }} revealAudioRef={revealAudioRef} getAudioCtx={getAudioCtx} />,
    orchestra: <Orchestra avd={avdEngine} revealAudioRef={revealAudioRef} goToPhase={goToPhase} getAudioCtx={getAudioCtx} relayRef={relayRef} />,
  }

  return (
    <div className="h-full w-full relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full w-full absolute inset-0"
        >
          {phaseComponent[phase]}
        </motion.div>
      </AnimatePresence>
      <Analytics />
    </div>
  )
}

export default App
