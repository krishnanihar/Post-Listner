import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { audioEngine } from '../engine/audio'
import Score from '../score/Score'
import { Vox } from '../score/marks'
import { COLORS, FONTS } from '../score/tokens'
import { playVoice, preloadVoices } from '../score/voice'

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii']

const VOICE_PATHS = [
  '/chamber/voices/score/depth-01.mp3',
  '/chamber/voices/score/depth-02.mp3',
  '/chamber/voices/score/depth-03.mp3',
  '/chamber/voices/score/depth-04.mp3',
]

const STAVE_START_Y = 130
const STAVE_SPACING = 40
const STAVE_WIDTH = 340

export default function Depth({ onNext, avd, inputMode }) {
  const [layers, setLayers] = useState(0)
  const [committed, setCommitted] = useState(false)

  const layerControl = useRef(null)
  const inactivityTimer = useRef(null)
  const longPressTimer = useRef(null)
  const lastTapTime = useRef(0)
  const maxReached = useRef(0)
  const reEngaged = useRef(false)
  const finishedRef = useRef(false)
  const layersRef = useRef(0)
  const pointerDownTime = useRef(null)

  useEffect(() => {
    preloadVoices(VOICE_PATHS)
    // Start audio engine layered build
    layerControl.current = audioEngine.playLayeredBuild(8)
    layerControl.current.setActiveCount(0)

    // Play first voice cue after fade-in
    const t = setTimeout(() => playVoice(VOICE_PATHS[0]), 800)

    return () => {
      clearTimeout(t)
      if (layerControl.current) layerControl.current.stop()
      clearTimeout(inactivityTimer.current)
      clearTimeout(longPressTimer.current)
    }
  }, [])

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setCommitted(true)
    clearTimeout(inactivityTimer.current)

    const finalLayer = layersRef.current
    const maxLayer = maxReached.current
    const reEng = reEngaged.current
    let d = finalLayer > 0 ? (finalLayer - 1) / 7 : 0
    if (reEng) d = Math.min(1, d + 0.1)

    avd.setDepth(d)
    avd.setPhaseData('depth', { finalLayer, maxLayer, reEngaged: reEng })

    // Voice 04 then advance
    playVoice(VOICE_PATHS[3])
    setTimeout(() => onNext({ depth: { finalLayer, maxLayer, reEngaged: reEng } }), 1500)
  }, [avd, onNext])

  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current)
    if (!finishedRef.current) {
      inactivityTimer.current = setTimeout(finish, 6000)
    }
  }, [finish])

  const addLayer = useCallback(() => {
    if (finishedRef.current) return
    const current = layersRef.current
    if (current >= 8) return

    const now = Date.now()
    const timeSinceLastTap = now - lastTapTime.current
    lastTapTime.current = now

    const newCount = current + 1
    layersRef.current = newCount
    setLayers(newCount)

    if (layerControl.current) layerControl.current.setActiveCount(newCount)
    if (navigator.vibrate) navigator.vibrate(10)

    // Track re-engagement
    if (newCount > maxReached.current) maxReached.current = newCount
    if (timeSinceLastTap > 2000 && current > 0) reEngaged.current = true

    // Voice cues
    if (newCount === 1) playVoice(VOICE_PATHS[1])
    if (newCount === 3) playVoice(VOICE_PATHS[2])

    // Auto-commit at 8
    if (newCount >= 8) {
      setTimeout(finish, 1500)
      return
    }

    resetInactivityTimer()
  }, [finish, resetInactivityTimer])

  // Tap handler — only fires if pointer was brief (not a long-press)
  const handleTap = useCallback(() => {
    // If this was a long-press, don't also add a layer
    if (pointerDownTime.current && Date.now() - pointerDownTime.current > 500) return
    addLayer()
  }, [addLayer])

  // Long-press to commit immediately — only after at least 1 layer
  const handlePointerDown = useCallback(() => {
    pointerDownTime.current = Date.now()
    if (layersRef.current === 0) return
    clearTimeout(longPressTimer.current)
    longPressTimer.current = setTimeout(finish, 800)
  }, [finish])

  const handlePointerUp = useCallback(() => {
    clearTimeout(longPressTimer.current)
    pointerDownTime.current = null
  }, [])

  // Build stave data
  const staves = []
  for (let i = 0; i < layers; i++) {
    staves.push({ y: STAVE_START_Y + i * STAVE_SPACING, width: STAVE_WIDTH })
  }

  return (
    <div
      style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'pointer' }}
      onClick={handleTap}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <Score
        variant="cream"
        pageTitle="iii. depth"
        staves={staves}
      >
        {/* Vox marks and roman numerals */}
        {Array.from({ length: layers }, (_, i) => {
          const y = STAVE_START_Y + i * STAVE_SPACING + 6
          return (
            <g key={i}>
              {/* Roman numeral */}
              <text
                x="18"
                y={y + 5}
                fill={COLORS.inkCreamSecondary}
                fontSize="11"
                fontFamily={FONTS.serif}
                fontStyle="italic"
              >
                {ROMAN[i]}
              </text>
              {/* Vox mark */}
              <motion.g
                transform={`translate(50, ${y})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Vox size={16} color={COLORS.inkCream} />
              </motion.g>
            </g>
          )
        })}
      </Score>

      {/* Tap instruction — fades once tapping begins */}
      {layers === 0 && (
        <motion.div
          style={{
            position: 'absolute',
            bottom: '20%',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 14,
            color: COLORS.inkCreamSecondary,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 2 }}
        >
          hold this until the room has the right amount of you in it
        </motion.div>
      )}
    </div>
  )
}
