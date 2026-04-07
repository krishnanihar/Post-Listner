import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'
import ConductingEngine from '../orchestra/ConductingEngine'
import Score from '../score/Score'
import { Tremolo, Vox, Marcato, Caesura, Pneuma, Ponticello, Legno, Fermata } from '../score/marks'
import { COLORS, FONTS } from '../score/tokens'
import { playVoice, preloadVoices } from '../score/voice'

const TEXTURE_DATA = [
  { name: 'strings',     coord: { a: 0.25, v: 0.70, d: 0.65 }, markType: 'tremolo' },
  { name: 'synthesizer', coord: { a: 0.35, v: 0.40, d: 0.80 }, markType: 'vox' },
  { name: 'distortion',  coord: { a: 0.85, v: 0.20, d: 0.30 }, markType: 'marcato' },
  { name: 'keys',        coord: { a: 0.30, v: 0.75, d: 0.45 }, markType: 'caesura' },
  { name: 'voice',       coord: { a: 0.20, v: 0.55, d: 0.90 }, markType: 'pneuma' },
  { name: 'glitch',      coord: { a: 0.75, v: 0.25, d: 0.55 }, markType: 'ponticello' },
  { name: 'rhythm',      coord: { a: 0.80, v: 0.60, d: 0.25 }, markType: 'legno' },
  { name: 'field',       coord: { a: 0.10, v: 0.50, d: 0.70 }, markType: 'fermata' },
]

const MARK_COMPONENTS = {
  tremolo: Tremolo, vox: Vox, marcato: Marcato, caesura: Caesura,
  pneuma: Pneuma, ponticello: Ponticello, legno: Legno, fermata: Fermata,
}

const VOICE_PATHS = [
  '/chamber/voices/score/textures-01.mp3',
  '/chamber/voices/score/textures-02.mp3',
  '/chamber/voices/score/textures-03.mp3',
  '/chamber/voices/score/textures-04.mp3',
]

const STAVE_Y = 280
const STAVE_WIDTH = 320
const STAVE_X_OFFSET = 20
const MARK_SPACING = STAVE_WIDTH / 8
const LISTEN_DURATION = 5000  // 5s listen phase — just hear it
const DECIDE_DURATION = 4000  // 4s decision window after listening
const SHAKE_THRESHOLD = 12    // RMS jerk threshold for "shake to refuse"

export default function Textures({ onNext, avd, inputMode }) {
  const [textureIdx, setTextureIdx] = useState(-1)
  const [marks, setMarks] = useState([])
  const [currentName, setCurrentName] = useState('')
  const [showInstruction, setShowInstruction] = useState(true)
  const [phase, setPhase] = useState('intro') // intro, listening, deciding
  const [motionAvailable, setMotionAvailable] = useState(true)
  const [decisionText, setDecisionText] = useState('') // "kept" or "refused" flash

  const conductingRef = useRef(null)
  const rafRef = useRef(null)
  const phaseTimer = useRef(null)
  const finishedRef = useRef(false)
  const resolvedRef = useRef(false)
  const preferred = useRef([])
  const neutral = useRef([])
  const dwellStart = useRef(null)

  useEffect(() => {
    preloadVoices(VOICE_PATHS)
    const engine = new ConductingEngine()
    conductingRef.current = engine
    engine.requestPermission().then((granted) => {
      if (granted) {
        engine.start()
      } else {
        setMotionAvailable(false)
      }
    })

    // Voice intro — spaced by actual durations
    // textures-01: 0.7s, textures-02: 2.9s, textures-03: 2.9s
    const timers = []
    const t = (ms, fn) => timers.push(setTimeout(fn, ms))
    t(0, () => playVoice(VOICE_PATHS[0]))        // "Listen." (0.7s)
    t(1200, () => playVoice(VOICE_PATHS[1]))      // "If you want to keep it..." (2.9s)
    t(4600, () => playVoice(VOICE_PATHS[2]))      // "If it is not yours..." (2.9s)
    t(8000, () => {
      setShowInstruction(false)
      advanceToTexture(0)
    })

    return () => {
      engine.stop()
      timers.forEach(clearTimeout)
      clearTimeout(phaseTimer.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const advanceToTexture = useCallback((idx) => {
    if (idx >= TEXTURE_DATA.length) {
      finishPhase()
      return
    }
    const texture = TEXTURE_DATA[idx]
    setTextureIdx(idx)
    setCurrentName(texture.name)
    setPhase('listening')
    setDecisionText('')
    resolvedRef.current = false
    dwellStart.current = Date.now()

    // Play texture audio
    audioEngine.playTexture(texture.name, (LISTEN_DURATION + DECIDE_DURATION) / 1000)

    // After listen phase, enter decide phase
    phaseTimer.current = setTimeout(() => {
      setPhase('deciding')

      // Auto-keep after decide duration if not shaken
      phaseTimer.current = setTimeout(() => {
        if (!resolvedRef.current) resolveTexture(idx, true) // true = kept
      }, DECIDE_DURATION)
    }, LISTEN_DURATION)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resolveTexture = useCallback((idx, kept) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    clearTimeout(phaseTimer.current)
    const texture = TEXTURE_DATA[idx]
    audioEngine.stopTexture()

    if (kept) {
      preferred.current.push(texture.name)
      const markX = STAVE_X_OFFSET + (idx * MARK_SPACING) + MARK_SPACING / 2
      setMarks(prev => [...prev, { x: markX, markType: texture.markType }])
      if (navigator.vibrate) navigator.vibrate(15)
      setDecisionText('kept')

      // AVD update
      const dwell = (Date.now() - (dwellStart.current || Date.now())) / 1000
      const dwellWeight = Math.max(0.3, Math.min(1.0, dwell / 8))
      avd.updateValence((texture.coord.v - 0.5) * dwellWeight, 1.0)
      avd.updateDepth((texture.coord.d - 0.5) * dwellWeight, 1.0)
      avd.updateArousal((texture.coord.a - 0.5) * dwellWeight * 0.5, 1.0)
    } else {
      neutral.current.push(texture.name)
      if (navigator.vibrate) navigator.vibrate(30)
      setDecisionText('refused')
    }

    setPhase('listening') // reset visual state
    setTimeout(() => advanceToTexture(idx + 1), 800)
  }, [avd]) // eslint-disable-line react-hooks/exhaustive-deps

  const finishPhase = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    audioEngine.stopAll()

    avd.setPhaseData('textures', {
      preferred: preferred.current,
      rejected: [],
      neutral: neutral.current,
    })

    playVoice(VOICE_PATHS[3])
    setTimeout(() => {
      onNext({ textures: { preferred: preferred.current, rejected: [], neutral: neutral.current } })
    }, 2000)
  }, [avd, onNext])

  // rAF loop: detect shake gesture during deciding phase
  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      const engine = conductingRef.current
      if (engine && phase === 'deciding' && !resolvedRef.current) {
        // Shake detection: high RMS jerk = user shook the phone
        if (engine._jerk > SHAKE_THRESHOLD) {
          resolveTexture(textureIdx, false) // refused
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [phase, textureIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Touch fallback: swipe down to refuse during deciding phase
  const touchStartY = useRef(null)
  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY
  }, [])
  const handleTouchEnd = useCallback((e) => {
    if (phase !== 'deciding' || touchStartY.current === null || resolvedRef.current) return
    const endY = e.changedTouches[0].clientY
    if (endY - touchStartY.current > 80) {
      resolveTexture(textureIdx, false)
    }
    touchStartY.current = null
  }, [phase, textureIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Score
        variant="cream"
        pageTitle="iv. textures"
        pageNumber={textureIdx >= 0 ? `${textureIdx + 1} / ${TEXTURE_DATA.length}` : ''}
        staves={[{ y: STAVE_Y, width: STAVE_WIDTH }]}
      >
        {marks.map((m, i) => {
          const MarkComp = MARK_COMPONENTS[m.markType]
          if (!MarkComp) return null
          return (
            <motion.g
              key={i}
              transform={`translate(${m.x}, ${STAVE_Y + 6})`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <MarkComp size={12} color={COLORS.inkCream} />
            </motion.g>
          )
        })}
      </Score>

      {/* Current texture name */}
      <AnimatePresence mode="wait">
        {textureIdx >= 0 && (
          <motion.div
            key={textureIdx}
            style={{
              position: 'absolute',
              top: '28%',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 24,
              color: COLORS.inkCream,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {currentName}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase indicator — listening vs deciding */}
      {textureIdx >= 0 && !resolvedRef.current && (
        <div style={{
          position: 'absolute',
          top: '36%',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: FONTS.serif,
          fontStyle: 'italic',
          fontSize: 12,
          color: COLORS.inkCreamSecondary,
        }}>
          {phase === 'listening' && (
            <motion.span
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              listening...
            </motion.span>
          )}
          {phase === 'deciding' && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
            >
              {motionAvailable ? 'shake to refuse' : 'swipe down to refuse'}
            </motion.span>
          )}
        </div>
      )}

      {/* Decision flash */}
      {decisionText && (
        <motion.div
          style={{
            position: 'absolute',
            top: '36%',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: decisionText === 'kept' ? COLORS.inkCream : COLORS.inkCreamSecondary,
            letterSpacing: '0.1em',
          }}
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          {decisionText}
        </motion.div>
      )}

      {/* Instruction text during intro */}
      {showInstruction && (
        <motion.div
          style={{
            position: 'absolute',
            top: '55%',
            left: 24,
            right: 24,
            textAlign: 'center',
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 13,
            color: COLORS.inkCreamSecondary,
            lineHeight: 1.8,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 1.5 }}
        >
          {motionAvailable
            ? 'listen first \u00B7 then shake to throw away'
            : 'listen first \u00B7 swipe down to throw away'}
        </motion.div>
      )}
    </div>
  )
}
