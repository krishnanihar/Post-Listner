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
const LISTEN_DURATION = 5000
const LEAN_THRESHOLD = 0.45
const LEAN_HOLD_MS = 1500
const CALIBRATION_SETTLE_MS = 2200

export default function Textures({ onNext, avd, inputMode }) {
  const [textureIdx, setTextureIdx] = useState(-1)
  const [marks, setMarks] = useState([])
  const [currentName, setCurrentName] = useState('')
  const [showInstruction, setShowInstruction] = useState(true)
  const [phase, setPhase] = useState('intro')
  const [motionAvailable, setMotionAvailable] = useState(true)
  const [decisionText, setDecisionText] = useState('')
  const [leanX, setLeanX] = useState(0)
  const [commitProgress, setCommitProgress] = useState(0)
  const [commitSide, setCommitSide] = useState(null)
  const [showDecideUI, setShowDecideUI] = useState(false)

  const conductingRef = useRef(null)
  const rafRef = useRef(null)
  const phaseTimer = useRef(null)
  const finishedRef = useRef(false)
  const resolvedRef = useRef(false)
  const preferred = useRef([])
  const neutral = useRef([])
  const dwellStart = useRef(null)
  const leanSideRef = useRef(null)
  const leanStartRef = useRef(null)
  const decideStartTime = useRef(null)
  const textureIdxRef = useRef(-1)

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

    // Voice intro
    const timers = []
    const t = (ms, fn) => timers.push(setTimeout(fn, ms))
    t(0, () => playVoice(VOICE_PATHS[0]))
    t(1200, () => playVoice(VOICE_PATHS[1]))
    t(5400, () => playVoice(VOICE_PATHS[2]))
    t(9000, () => {
      setShowInstruction(false)
      startTexture(0)
    })

    return () => {
      engine.stop()
      timers.forEach(clearTimeout)
      clearTimeout(phaseTimer.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startTexture = useCallback((idx) => {
    if (idx >= TEXTURE_DATA.length) {
      finishPhase()
      return
    }
    const texture = TEXTURE_DATA[idx]
    textureIdxRef.current = idx
    setTextureIdx(idx)
    setCurrentName(texture.name)
    setPhase('listening')
    setDecisionText('')
    setLeanX(0)
    setCommitProgress(0)
    setCommitSide(null)
    setShowDecideUI(false)
    resolvedRef.current = false
    leanSideRef.current = null
    leanStartRef.current = null
    dwellStart.current = Date.now()

    // Play texture audio — long duration so it keeps playing through decide
    audioEngine.playTexture(texture.name, 30)

    // After listen phase, switch to deciding
    phaseTimer.current = setTimeout(() => {
      setPhase('deciding')
      setShowDecideUI(true)
      decideStartTime.current = Date.now()
      const engine = conductingRef.current
      if (engine) engine.startCalibration()
    }, LISTEN_DURATION)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resolveTexture = useCallback((idx, kept) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    clearTimeout(phaseTimer.current)
    setShowDecideUI(false)
    const texture = TEXTURE_DATA[idx]
    audioEngine.stopTexture()

    if (kept) {
      preferred.current.push(texture.name)
      const markX = STAVE_X_OFFSET + (idx * MARK_SPACING) + MARK_SPACING / 2
      setMarks(prev => [...prev, { x: markX, markType: texture.markType }])
      if (navigator.vibrate) navigator.vibrate(15)
      setDecisionText('kept')

      const dwell = (Date.now() - (dwellStart.current || Date.now())) / 1000
      const dwellWeight = Math.max(0.3, Math.min(1.0, dwell / 8))
      avd.updateValence((texture.coord.v - 0.5) * dwellWeight, 1.0)
      avd.updateDepth((texture.coord.d - 0.5) * dwellWeight, 1.0)
      avd.updateArousal((texture.coord.a - 0.5) * dwellWeight * 0.5, 1.0)
    } else {
      neutral.current.push(texture.name)
      if (navigator.vibrate) navigator.vibrate(30)
      setDecisionText('let go')
    }

    setPhase('resolved')
    setLeanX(0)
    setCommitProgress(0)
    setCommitSide(null)
    setTimeout(() => startTexture(idx + 1), 800)
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

  // rAF loop: lean detection during deciding phase only
  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return

      if (phase === 'deciding' && !resolvedRef.current) {
        const engine = conductingRef.current
        if (engine) {
          const data = engine.getData()
          const position = (data.pan - 0.5) * 2
          setLeanX(position)

          // Wait for calibration to settle
          const sinceDecideStart = Date.now() - (decideStartTime.current || Date.now())
          if (sinceDecideStart >= CALIBRATION_SETTLE_MS) {
            if (Math.abs(position) > LEAN_THRESHOLD) {
              const side = position > 0 ? 'keep' : 'trash'
              if (leanSideRef.current !== side) {
                leanSideRef.current = side
                leanStartRef.current = Date.now()
              }
              const elapsed = Date.now() - leanStartRef.current
              const progress = Math.min(1, elapsed / LEAN_HOLD_MS)
              setCommitProgress(progress)
              setCommitSide(side)

              if (progress >= 1) {
                resolveTexture(textureIdxRef.current, side === 'keep')
                leanSideRef.current = null
                leanStartRef.current = null
              }
            } else {
              leanSideRef.current = null
              leanStartRef.current = null
              setCommitProgress(0)
              setCommitSide(null)
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Touch fallback: drag right to keep, left to let go
  const touchStartX = useRef(null)
  const handleTouchStart = useCallback((e) => {
    if (phase !== 'deciding') return
    touchStartX.current = e.touches[0].clientX
  }, [phase])

  const handleTouchMove = useCallback((e) => {
    if (phase !== 'deciding' || touchStartX.current === null || resolvedRef.current) return
    const dx = e.touches[0].clientX - touchStartX.current
    const norm = Math.max(-1, Math.min(1, dx / 120))
    setLeanX(norm)
    const engine = conductingRef.current
    if (engine) engine.updateTouch((norm + 1) / 2, 0.5, true)
  }, [phase])

  const handleTouchEnd = useCallback(() => {
    if (phase !== 'deciding' || resolvedRef.current || touchStartX.current === null) return
    if (Math.abs(leanX) > 0.5) {
      resolveTexture(textureIdxRef.current, leanX > 0)
    } else {
      setLeanX(0)
    }
    touchStartX.current = null
    const engine = conductingRef.current
    if (engine) engine.updateTouch(0.5, 0.5, false)
  }, [phase, leanX]) // eslint-disable-line react-hooks/exhaustive-deps

  const commitFillOpacity = commitProgress > 0 ? 0.15 + commitProgress * 0.4 : 0

  return (
    <div
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
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
              left: 0, right: 0,
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

      {/* Listening indicator */}
      {phase === 'listening' && textureIdx >= 0 && (
        <motion.div
          style={{
            position: 'absolute',
            top: '36%',
            left: 0, right: 0,
            textAlign: 'center',
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 12,
            color: COLORS.inkCreamSecondary,
          }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          listening...
        </motion.div>
      )}

      {/* Decide UI: keep/let go labels + cursor + commit bars */}
      {showDecideUI && (
        <motion.div
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {/* Left: let go */}
          <div style={{
            position: 'absolute',
            top: '43%',
            left: 24,
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 14,
            color: leanX < -0.2 ? COLORS.inkCream : COLORS.inkCreamSecondary,
            transition: 'color 0.2s',
          }}>
            let go
            {commitSide === 'trash' && commitProgress > 0 && (
              <div style={{
                marginTop: 4, height: 2, borderRadius: 1,
                background: COLORS.inkCreamSecondary,
                opacity: commitFillOpacity,
                width: `${commitProgress * 100}%`,
                transition: 'width 0.1s linear',
              }} />
            )}
          </div>

          {/* Right: keep */}
          <div style={{
            position: 'absolute',
            top: '43%',
            right: 24,
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 14,
            color: leanX > 0.2 ? COLORS.inkCream : COLORS.inkCreamSecondary,
            transition: 'color 0.2s',
            textAlign: 'right',
          }}>
            keep
            {commitSide === 'keep' && commitProgress > 0 && (
              <div style={{
                marginTop: 4, height: 2, borderRadius: 1,
                background: COLORS.scoreAmber,
                opacity: commitFillOpacity,
                width: `${commitProgress * 100}%`,
                marginLeft: 'auto',
                transition: 'width 0.1s linear',
              }} />
            )}
          </div>

          {/* Cursor dot */}
          <div style={{
            position: 'absolute',
            top: '44%',
            left: `${50 + leanX * 30}%`,
            transform: 'translateX(-50%)',
            width: 6, height: 6,
            borderRadius: '50%',
            background: COLORS.scoreAmber,
            opacity: 0.8,
            transition: 'left 0.05s linear',
          }} />
        </motion.div>
      )}

      {/* Decision flash */}
      <AnimatePresence>
        {decisionText && (
          <motion.div
            key={decisionText + textureIdx}
            style={{
              position: 'absolute',
              top: '36%',
              left: 0, right: 0,
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
      </AnimatePresence>

      {/* Instruction text during intro */}
      {showInstruction && (
        <motion.div
          style={{
            position: 'absolute',
            top: '55%',
            left: 24, right: 24,
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
            ? 'lean right to keep \u00B7 left to let go'
            : 'drag right to keep \u00B7 left to let go'}
        </motion.div>
      )}
    </div>
  )
}
