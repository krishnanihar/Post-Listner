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
import ReflectionSurface from './phases/ReflectionSurface'
import { resetLiveSession } from './lib/liveSession.js'
import { inkForPhase } from './lib/phaseTheme.js'

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

  // Clear the reflection surface's live store whenever the flow returns to
  // entry, so each new session starts with an empty transcript + lexicon.
  useEffect(() => {
    if (phase === 'entry') resetLiveSession()
  }, [phase])

  const stemsBundleRef = useRef(null)
  const revealAudioRef = useRef(null)
  // Slice 3 — Orchestra distils the conducting glyph into this ref at song
  // end; App reads it when relaying the entry message at settle.
  const glyphRef = useRef(null)
  // Slice 3 — one-shot guard so the settle entry is relayed exactly once
  // per rite even if the effect re-runs; re-armed when the phase leaves settle.
  const settleEntrySentRef = useRef(false)

  // Slice 3 — close the loop. On entering settle, relay the finished entry
  // (song + summary + glyph) to the paired desktop, which writes the journal
  // row. Fire-and-forget with a bounded retry while the relay reconnects;
  // a solo rite (no relayRef, or no glyph) simply writes nothing. The
  // one-shot ref guarantees a single send per settle entry even if the
  // effect re-runs; it re-arms whenever the phase leaves settle.
  useEffect(() => {
    if (phase !== 'settle') {
      settleEntrySentRef.current = false
      return
    }
    if (settleEntrySentRef.current) return
    settleEntrySentRef.current = true
    const relay = relayRef.current
    const glyph = glyphRef.current
    if (!relay || !glyph) return
    const bundle = stemsBundleRef.current
    const msg = {
      type: 'entry',
      song: bundle ? `${bundle.archetypeId}/${bundle.variationId}` : null,
      summary: sessionData.summary || '',
      glyph,
    }
    if (relay.send(msg)) return
    let tries = 0
    const iv = setInterval(() => {
      tries += 1
      if (relay.send(msg) || tries >= 10) clearInterval(iv)
    }, 500)
    return () => clearInterval(iv)
  }, [phase, sessionData.summary])

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
    orchestra: <Orchestra avd={avdEngine} revealAudioRef={revealAudioRef} goToPhase={goToPhase} getAudioCtx={getAudioCtx} relayRef={relayRef} glyphRef={glyphRef} />,
    settle: <Settle onComplete={handleSettleComplete} />,
  }

  // sessionData is collected via nextPhase but unused in Phase A —
  // re-introduce when a phase needs to read it.
  void sessionData

  return (
    <div
      className="h-full w-full relative"
      style={{ '--ink': inkForPhase(phase) }}
    >
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
      {/* Build B — the reflection surface persists unbroken across the
          admirer and orchestra phases. Rendered OUTSIDE the phase-swap
          AnimatePresence so a phase change does not unmount/remount it. */}
      {(phase === 'admirer' || phase === 'orchestra') && <ReflectionSurface />}
      <Analytics />
    </div>
  )
}

export default App
