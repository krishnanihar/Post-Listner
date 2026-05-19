import { useState, useCallback, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Analytics } from '@vercel/analytics/react'
import Entry from './phases/Entry.score'
import Admirer from './phases/Admirer'
import Orchestra from './phases/Orchestra'
import Settle from './phases/Settle'
import { avdEngine } from './engine/avd'
import { audioEngine } from './engine/audio'
import { startOrchestraPreload } from './orchestra/preloader'

const PHASES = ['entry', 'admirer', 'orchestra', 'settle']

const _params = new URLSearchParams(window.location.search)
const _startPhase = _params.get('phase')

function App() {
  const [phase, setPhase] = useState(PHASES.includes(_startPhase) ? _startPhase : 'entry')
  const [sessionData, setSessionData] = useState({})

  // Relay client (only active when ?s= is present) — unchanged from main.
  const relayRef = useRef(null)
  const sessionIdRef = useRef(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const sawOrchestraRef = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('s')
    if (!s) return

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

  useEffect(() => {
    if (!relayRef.current) return
    if (phase === 'orchestra') sawOrchestraRef.current = true
    relayRef.current.send({ type: 'phase', phase })
    if (phase === 'entry' && sawOrchestraRef.current) {
      relayRef.current.send({ type: 'session:end' })
      sawOrchestraRef.current = false
    }
  }, [phase])

  useEffect(() => {
    if (_startPhase && _startPhase !== 'entry') {
      audioEngine.init()
      audioEngine.resume()
    }
  }, [])

  useEffect(() => {
    if (phase === 'admirer' && audioEngine.ctx) {
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

  const getAudioCtx = useCallback(() => audioEngine.ctx, [])

  const handleSettleComplete = useCallback(() => setPhase('entry'), [])

  const phaseComponent = {
    entry: <Entry onNext={nextPhase} />,
    admirer: <Admirer onNext={nextPhase} getAudioCtx={getAudioCtx} revealAudioRef={revealAudioRef} />,
    orchestra: <Orchestra avd={avdEngine} revealAudioRef={revealAudioRef} goToPhase={goToPhase} getAudioCtx={getAudioCtx} relayRef={relayRef} />,
    settle: <Settle onComplete={handleSettleComplete} />,
  }

  // sessionData is collected via nextPhase but unused in Phase A —
  // re-introduce when a phase needs to read it.
  void sessionData

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
