import { useState, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Entry from './phases/Entry.score'
import Spectrum from './phases/Spectrum.score'
import Depth from './phases/Depth.score'
import Textures from './phases/Textures.score'
import Moment from './phases/Moment'
import Reveal from './phases/Reveal'
import Orchestra from './phases/Orchestra'
import TraceCanvas from './components/TraceCanvas'
import { avdEngine } from './engine/avd'
import { audioEngine } from './engine/audio'
import { useInputMode } from './hooks/useInputMode'

const PHASES = ['entry', 'spectrum', 'depth', 'textures', 'moment', 'reveal', 'orchestra']

function App() {
  const [phase, setPhase] = useState('entry')
  const [sessionData, setSessionData] = useState({})
  const inputMode = useInputMode()

  const musicPromiseRef = useRef(null)
  const revealAudioRef = useRef(null)

  const nextPhase = useCallback((data = {}) => {
    const { musicPromise, ...rest } = data
    if (musicPromise) musicPromiseRef.current = musicPromise
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
    depth: <Depth onNext={nextPhase} avd={avdEngine} inputMode={inputMode} />,
    textures: <Textures onNext={nextPhase} avd={avdEngine} inputMode={inputMode} />,
    moment: <Moment onNext={nextPhase} avd={avdEngine} inputMode={inputMode} />,
    reveal: <Reveal onNext={nextPhase} avd={avdEngine} sessionData={{ ...sessionData, musicPromise: musicPromiseRef.current }} revealAudioRef={revealAudioRef} />,
    orchestra: <Orchestra avd={avdEngine} revealAudioRef={revealAudioRef} goToPhase={goToPhase} getAudioCtx={getAudioCtx} />,
  }

  return (
    <div className="h-full w-full relative">
      {phase !== 'entry' && <TraceCanvas avd={avdEngine} phase={phase} />}
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
    </div>
  )
}

export default App
