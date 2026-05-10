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
    orchestra: <Orchestra avd={avdEngine} revealAudioRef={revealAudioRef} goToPhase={goToPhase} getAudioCtx={getAudioCtx} />,
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
