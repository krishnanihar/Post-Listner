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
  tremolo: Tremolo,
  vox: Vox,
  marcato: Marcato,
  caesura: Caesura,
  pneuma: Pneuma,
  ponticello: Ponticello,
  legno: Legno,
  fermata: Fermata,
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
const CLIP_DURATION = 5000 // 5 seconds per texture

export default function Textures({ onNext, avd, inputMode }) {
  const [textureIdx, setTextureIdx] = useState(-1) // -1 = voice intro
  const [marks, setMarks] = useState([]) // { x, markType }
  const [currentName, setCurrentName] = useState('')
  const [showInstruction, setShowInstruction] = useState(true)
  const [deciding, setDeciding] = useState(false) // true during clip playback

  const conductingRef = useRef(null)
  const rafRef = useRef(null)
  const clipTimer = useRef(null)
  const finishedRef = useRef(false)
  const preferred = useRef([])
  const neutral = useRef([])
  const dwellStart = useRef(null)
  const faceDownDebounce = useRef(null)
  const isFaceDown = useRef(false)

  // Initialize ConductingEngine for orientation detection
  useEffect(() => {
    preloadVoices(VOICE_PATHS)
    const engine = new ConductingEngine()
    conductingRef.current = engine
    engine.requestPermission().then(() => engine.start())

    // Play voice intro sequence
    const timers = []
    const t = (ms, fn) => timers.push(setTimeout(fn, ms))
    t(0, () => playVoice(VOICE_PATHS[0]))      // "Listen."
    t(1500, () => playVoice(VOICE_PATHS[1]))    // "If you want to keep it..."
    t(5500, () => playVoice(VOICE_PATHS[2]))    // "If it is not yours..."
    t(9500, () => {
      setShowInstruction(false)
      advanceToTexture(0)
    })

    return () => {
      engine.stop()
      timers.forEach(clearTimeout)
      clearTimeout(clipTimer.current)
      clearTimeout(faceDownDebounce.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const advanceToTexture = useCallback((idx) => {
    if (idx >= TEXTURE_DATA.length) {
      // All done
      finishPhase()
      return
    }
    const texture = TEXTURE_DATA[idx]
    setTextureIdx(idx)
    setCurrentName(texture.name)
    setDeciding(true)
    isFaceDown.current = false
    dwellStart.current = Date.now()

    // Play texture audio
    audioEngine.playTexture(texture.name, CLIP_DURATION / 1000)

    // After clip duration, resolve based on orientation
    clipTimer.current = setTimeout(() => {
      resolveTexture(idx)
    }, CLIP_DURATION)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resolveTexture = useCallback((idx) => {
    const texture = TEXTURE_DATA[idx]
    setDeciding(false)
    audioEngine.stopTexture()

    if (isFaceDown.current) {
      // Refused
      neutral.current.push(texture.name)
    } else {
      // Kept — stamp mark
      preferred.current.push(texture.name)
      const markX = STAVE_X_OFFSET + (idx * MARK_SPACING) + MARK_SPACING / 2
      setMarks(prev => [...prev, { x: markX, markType: texture.markType }])

      // AVD update
      const dwell = (Date.now() - (dwellStart.current || Date.now())) / 1000
      const dwellWeight = Math.max(0.3, Math.min(1.0, dwell / 8))
      const vDelta = (texture.coord.v - 0.5) * dwellWeight
      const dDelta = (texture.coord.d - 0.5) * dwellWeight
      const aDelta = (texture.coord.a - 0.5) * dwellWeight * 0.5
      avd.updateValence(vDelta, 1.0)
      avd.updateDepth(dDelta, 1.0)
      avd.updateArousal(aDelta, 1.0)
    }

    // Brief pause then next texture
    setTimeout(() => advanceToTexture(idx + 1), 600)
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

    playVoice(VOICE_PATHS[3]) // "I have a sense of you now."
    setTimeout(() => {
      onNext({ textures: { preferred: preferred.current, rejected: [], neutral: neutral.current } })
    }, 2000)
  }, [avd, onNext])

  // rAF loop: check orientation for face-down detection
  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      const engine = conductingRef.current
      if (engine && deciding) {
        const beta = engine._beta
        // Face-down: beta > 90 or beta < -90
        if (Math.abs(beta) > 90) {
          if (!isFaceDown.current) {
            // Debounce: must stay face-down for 1 second
            if (!faceDownDebounce.current) {
              faceDownDebounce.current = setTimeout(() => {
                isFaceDown.current = true
                if (navigator.vibrate) navigator.vibrate(30)
                faceDownDebounce.current = null
              }, 1000)
            }
          }
        } else {
          // Cleared face-down debounce
          if (faceDownDebounce.current) {
            clearTimeout(faceDownDebounce.current)
            faceDownDebounce.current = null
          }
          isFaceDown.current = false
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [deciding])

  // Touch fallback: swipe down to refuse
  const touchStartY = useRef(null)
  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY
  }, [])
  const handleTouchEnd = useCallback((e) => {
    if (!deciding || touchStartY.current === null) return
    const endY = e.changedTouches[0].clientY
    if (endY - touchStartY.current > 80) {
      // Swipe down — refuse
      isFaceDown.current = true
      clearTimeout(clipTimer.current)
      resolveTexture(textureIdx)
    }
    touchStartY.current = null
  }, [deciding, textureIdx, resolveTexture])

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
        {/* Accumulated marks */}
        {marks.map((m, i) => {
          const MarkComp = MARK_COMPONENTS[m.markType]
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
              top: '30%',
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

      {/* Instruction text */}
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
          hold to keep{'\n'}turn over to refuse
        </motion.div>
      )}
    </div>
  )
}
