import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'
import ConductingEngine from '../orchestra/ConductingEngine'
import Score from '../score/Score'
import { Linea } from '../score/marks'
import { COLORS, FONTS } from '../score/tokens'
import { playVoice, preloadVoices } from '../score/voice'

const PAIRS = [
  { left: 'shadow',  right: 'warmth',
    coordL: { a: 0.30, v: 0.10, d: 0.50 }, coordR: { a: 0.30, v: 0.85, d: 0.50 } },
  { left: 'pulse',   right: 'shimmer',
    coordL: { a: 0.55, v: 0.20, d: 0.35 }, coordR: { a: 0.55, v: 0.80, d: 0.35 } },
  { left: 'weight',  right: 'air',
    coordL: { a: 0.20, v: 0.15, d: 0.60 }, coordR: { a: 0.20, v: 0.70, d: 0.60 } },
  { left: 'ache',    right: 'bloom',
    coordL: { a: 0.25, v: 0.10, d: 0.75 }, coordR: { a: 0.25, v: 0.90, d: 0.75 } },
  { left: 'machine', right: 'earth',
    coordL: { a: 0.50, v: 0.20, d: 0.40 }, coordR: { a: 0.50, v: 0.65, d: 0.40 } },
  { left: 'tension', right: 'resolve',
    coordL: { a: 0.60, v: 0.05, d: 0.55 }, coordR: { a: 0.60, v: 0.85, d: 0.55 } },
  { left: 'fog',     right: 'glass',
    coordL: { a: 0.15, v: 0.20, d: 0.65 }, coordR: { a: 0.15, v: 0.75, d: 0.65 } },
  { left: 'gravity', right: 'drift',
    coordL: { a: 0.65, v: 0.30, d: 0.30 }, coordR: { a: 0.15, v: 0.60, d: 0.70 } },
]

const VOICE_PATHS = [
  '/chamber/voices/score/spectrum-01.mp3',
  '/chamber/voices/score/spectrum-02.mp3',
  '/chamber/voices/score/spectrum-03.mp3',
  '/chamber/voices/score/spectrum-04.mp3',
]

const STAVE_Y = 280
const STAVE_WIDTH = 320
const STAVE_X_OFFSET = 20
const MARK_SPACING = STAVE_WIDTH / 8
const LEAN_THRESHOLD = 0.35
const COMMIT_DURATION = 3000 // 3 seconds to commit

export default function Spectrum({ onNext, avd, inputMode }) {
  const [pairIdx, setPairIdx] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [cursorX, setCursorX] = useState(0)
  const [marks, setMarks] = useState([])
  const [pairVisible, setPairVisible] = useState(true)
  const [showHint, setShowHint] = useState(true)
  const [motionAvailable, setMotionAvailable] = useState(true)
  const [commitProgress, setCommitProgress] = useState(0) // 0-1, visible fill under chosen word
  const [commitSide, setCommitSide] = useState(null) // 'left' | 'right' | null

  const conductingRef = useRef(null)
  const pairRef = useRef(null)
  const rafRef = useRef(null)
  const leanSideRef = useRef(null)
  const leanStartRef = useRef(null)
  const cursorHistoryRef = useRef([])
  const pairStartTime = useRef(Date.now())
  const reversalCount = useRef(0)
  const lastSide = useRef(null)
  const firstHovered = useRef(null)
  const switched = useRef(false)
  const results = useRef([])
  const isMouse = inputMode === 'mouse'

  const pair = PAIRS[pairIdx]

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
    return () => engine.stop()
  }, [])

  const stopAudio = useCallback(() => {
    if (pairRef.current) {
      pairRef.current.stop()
      pairRef.current = null
    }
  }, [])

  const startPair = useCallback(() => {
    stopAudio()
    const urlL = `/spectrum/${pair.left}.mp3`
    const urlR = `/spectrum/${pair.right}.mp3`
    pairRef.current = audioEngine.playMp3Pair(urlL, urlR, 10)
    pairStartTime.current = Date.now()
    firstHovered.current = null
    reversalCount.current = 0
    lastSide.current = null
    switched.current = false
    cursorHistoryRef.current = []
    leanSideRef.current = null
    leanStartRef.current = null
    setCommitProgress(0)
    setCommitSide(null)
  }, [pair, stopAudio])

  useEffect(() => {
    startPair()
    return stopAudio
  }, [pairIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const getSlideCommitmentWeight = useCallback((sliderPosition) => {
    const positionFactor = Math.max(0.2, sliderPosition)
    const reversals = reversalCount.current
    const reversalPenalty = 1.0 / (1.0 + reversals * 0.3)
    const dwellSec = (Date.now() - pairStartTime.current) / 1000
    const dwellFactor = Math.max(0.3, Math.min(1.2, dwellSec / 4.0))
    return positionFactor * reversalPenalty * dwellFactor
  }, [])

  const lockChoice = useCallback((side) => {
    if (transitioning) return
    setTransitioning(true)
    stopAudio()

    const dwellSec = (Date.now() - pairStartTime.current) / 1000
    const confidence = Math.max(0.2, Math.min(1, (dwellSec - 0.5) / 4.0))
    const sliderPos = Math.min(1, Math.abs(cursorHistoryRef.current[cursorHistoryRef.current.length - 1] || 0))
    const slideCommitmentWeight = getSlideCommitmentWeight(sliderPos)

    if (firstHovered.current && firstHovered.current !== side) {
      switched.current = true
    }

    const chosenCoord = side === 'left' ? pair.coordL : pair.coordR

    results.current.push({
      pair: pairIdx + 1,
      choice: side,
      label: side === 'left' ? pair.left : pair.right,
      confidence,
      reactionMs: Date.now() - pairStartTime.current,
      switched: switched.current,
      reversals: reversalCount.current,
      coord: chosenCoord,
    })

    const vDelta = (chosenCoord.v - 0.5) * confidence * slideCommitmentWeight
    const aDelta = (chosenCoord.a - 0.5) * confidence * slideCommitmentWeight * 0.5
    const dDelta = (chosenCoord.d - 0.5) * confidence * slideCommitmentWeight * 0.5
    const switchWeight = switched.current ? 0.6 : 1.0
    avd.updateValence(vDelta * switchWeight, 1.0)
    avd.updateArousal(aDelta * switchWeight, 1.0)
    avd.updateDepth(dDelta * switchWeight, 1.0)

    if (navigator.vibrate) navigator.vibrate(10)

    const markX = STAVE_X_OFFSET + (pairIdx * MARK_SPACING) + MARK_SPACING / 2
    const dip = side === 'left' ? 'left' : 'right'
    setMarks(prev => [...prev, { x: markX, dip }])

    const completedPair = pairIdx + 1
    if (completedPair === 2) playVoice(VOICE_PATHS[0])
    if (completedPair === 4) playVoice(VOICE_PATHS[1])
    if (completedPair === 6) playVoice(VOICE_PATHS[2])

    setPairVisible(false)
    if (showHint) setShowHint(false)
    setCommitProgress(0)
    setCommitSide(null)

    setTimeout(() => {
      if (pairIdx < PAIRS.length - 1) {
        setPairIdx(prev => prev + 1)
        setCursorX(0)
        setPairVisible(true)
        setTransitioning(false)
      } else {
        playVoice(VOICE_PATHS[3])
        avd.setPhaseData('spectrum', { pairs: results.current })
        setTimeout(() => onNext({ spectrum: results.current }), 1500)
      }
    }, 600)
  }, [pairIdx, transitioning, avd, onNext, stopAudio, pair, getSlideCommitmentWeight, showHint])

  // rAF loop
  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      const engine = conductingRef.current
      if (engine && !transitioning) {
        const data = engine.getData()
        const position = (data.pan - 0.5) * 2
        setCursorX(position)

        cursorHistoryRef.current.push(position)
        if (cursorHistoryRef.current.length > 60) cursorHistoryRef.current.shift()

        const balance = Math.sign(position) * Math.pow(Math.abs(position), 0.6) * 0.8
        if (pairRef.current) pairRef.current.setBalance(balance)

        if (Math.abs(position) > 0.1) {
          const side = position < 0 ? 'left' : 'right'
          if (!firstHovered.current) firstHovered.current = side
          if (lastSide.current && lastSide.current !== side) {
            reversalCount.current++
          }
          lastSide.current = side
        }

        // Commit progress: lean past threshold builds a visible fill over 3 seconds
        if (Math.abs(position) > LEAN_THRESHOLD) {
          const side = position < 0 ? 'left' : 'right'
          if (leanSideRef.current !== side) {
            leanSideRef.current = side
            leanStartRef.current = Date.now()
          }
          const elapsed = Date.now() - leanStartRef.current
          const progress = Math.min(1, elapsed / COMMIT_DURATION)
          setCommitProgress(progress)
          setCommitSide(side)

          if (progress >= 1) {
            lockChoice(side)
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
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [transitioning, lockChoice])

  // Touch fallback
  const handleTouchMove = useCallback((e) => {
    if (transitioning) return
    const touch = e.touches[0]
    const x = touch.clientX / window.innerWidth
    const engine = conductingRef.current
    if (engine) engine.updateTouch(x, 0.5, true)
  }, [transitioning])

  const handleTouchEnd = useCallback(() => {
    if (transitioning) return
    const pos = cursorHistoryRef.current[cursorHistoryRef.current.length - 1] || 0
    if (Math.abs(pos) > 0.15) {
      lockChoice(pos < 0 ? 'left' : 'right')
    }
    const engine = conductingRef.current
    if (engine) engine.updateTouch(0.5, 0.5, false)
  }, [transitioning, lockChoice])

  const handleTap = useCallback(() => {
    if (transitioning) return
    const pos = cursorHistoryRef.current[cursorHistoryRef.current.length - 1] || 0
    if (Math.abs(pos) > 0.1) {
      lockChoice(pos < 0 ? 'left' : 'right')
    }
  }, [transitioning, lockChoice])

  const cursorSvgX = STAVE_X_OFFSET + (STAVE_WIDTH / 2) + cursorX * (STAVE_WIDTH / 2)

  // Commit fill: a small arc under the word that fills as the user holds
  const commitFillOpacity = commitProgress > 0 ? 0.15 + commitProgress * 0.35 : 0

  return (
    <div
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={isMouse ? handleTap : undefined}
    >
      <Score
        variant="cream"
        pageTitle="ii. spectrum"
        pageNumber={`${pairIdx + 1} / ${PAIRS.length}`}
        staves={[{ y: STAVE_Y, width: STAVE_WIDTH }]}
      >
        {marks.map((m, i) => (
          <g key={i} transform={`translate(${m.x}, ${STAVE_Y + 6})`}>
            <Linea size={MARK_SPACING * 0.8} dip={m.dip} color={COLORS.inkCream} />
          </g>
        ))}

        {pairVisible && !transitioning && (
          <circle
            cx={cursorSvgX}
            cy={STAVE_Y + 6}
            r="3"
            fill={COLORS.scoreAmber}
          />
        )}
      </Score>

      {/* Word labels */}
      <AnimatePresence mode="wait">
        {pairVisible && (
          <motion.div
            key={pairIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {/* Left word */}
            <div style={{
              position: 'absolute',
              top: '37%',
              left: 24,
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 22,
              color: cursorX < -0.2 ? COLORS.inkCream : COLORS.inkCreamSecondary,
              transition: 'color 0.3s',
            }}>
              {pair.left}
              {/* Commit fill bar under the word */}
              {commitSide === 'left' && commitProgress > 0 && (
                <div style={{
                  marginTop: 6,
                  height: 2,
                  borderRadius: 1,
                  background: COLORS.scoreAmber,
                  opacity: commitFillOpacity,
                  width: `${commitProgress * 100}%`,
                  transition: 'width 0.1s linear',
                }} />
              )}
            </div>

            {/* Right word */}
            <div style={{
              position: 'absolute',
              top: '37%',
              right: 24,
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 22,
              color: cursorX > 0.2 ? COLORS.inkCream : COLORS.inkCreamSecondary,
              transition: 'color 0.3s',
              textAlign: 'right',
            }}>
              {pair.right}
              {commitSide === 'right' && commitProgress > 0 && (
                <div style={{
                  marginTop: 6,
                  height: 2,
                  borderRadius: 1,
                  background: COLORS.scoreAmber,
                  opacity: commitFillOpacity,
                  width: `${commitProgress * 100}%`,
                  marginLeft: 'auto',
                  transition: 'width 0.1s linear',
                }} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint */}
      {showHint && (
        <motion.div
          style={{
            position: 'absolute',
            bottom: '18%',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 13,
            color: COLORS.inkCreamSecondary,
            lineHeight: 1.8,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          {motionAvailable
            ? 'lean toward a word and hold'
            : 'drag toward a word and hold'}
        </motion.div>
      )}
    </div>
  )
}
