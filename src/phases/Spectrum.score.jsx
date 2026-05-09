import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'
import Score from '../score/Score'
import { Linea } from '../score/marks'
import { COLORS, FONTS } from '../score/tokens'
import { playVoice, preloadVoices } from '../score/voice'
import { ACTIVE_PAIRS as PAIRS } from '../lib/spectrumPairs'
import { useAdmirer } from '../hooks/useAdmirer'

const VOICE_PATHS = [
  '/chamber/voices/score/spectrum-01.mp3',
  '/chamber/voices/score/spectrum-02.mp3',
  '/chamber/voices/score/spectrum-03.mp3',
  '/chamber/voices/score/spectrum-04.mp3',
]

const STAVE_Y = 280
const STAVE_WIDTH = 340
const STAVE_X_OFFSET = 10
const MARK_SPACING = STAVE_WIDTH / PAIRS.length
const LEAN_THRESHOLD = 0.15  // cursor magnitude past which release-to-lock fires

export default function Spectrum({ onNext, avd, inputMode }) {
  const [pairIdx, setPairIdx] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [cursorX, setCursorX] = useState(0)              // -1 .. +1
  const [marks, setMarks] = useState([])
  const [pairVisible, setPairVisible] = useState(true)
  const [showHint, setShowHint] = useState(true)
  const [transparencyComment, setTransparencyComment] = useState(null)

  const admirer = useAdmirer()

  const areaRef = useRef(null)
  const pairRef = useRef(null)
  const cursorRef = useRef(0)                            // mirror for closure reads
  const cursorHistoryRef = useRef([])
  const pairStartTime = useRef(Date.now())
  const reversalCount = useRef(0)
  const lastSide = useRef(null)
  const firstHovered = useRef(null)
  const hoveredButNotChosen = useRef([])
  const hoverEnterTime = useRef(null)
  const hoverSideRef = useRef(null)                      // which side cursor is currently leaning past threshold
  const switched = useRef(false)
  const touchActiveRef = useRef(false)
  const results = useRef([])
  const isMouse = inputMode === 'mouse'

  const pair = PAIRS[pairIdx]

  useEffect(() => {
    preloadVoices(VOICE_PATHS)
    admirer.play('spectrum.intro')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stopAudio = useCallback(() => {
    if (pairRef.current) {
      pairRef.current.stop()
      pairRef.current = null
    }
  }, [])

  const startPair = useCallback(() => {
    stopAudio()
    const urlL = `/spectrum/v2/${pair.left}.mp3`
    const urlR = `/spectrum/v2/${pair.right}.mp3`
    pairRef.current = audioEngine.playMp3Pair(urlL, urlR, 10)
    pairStartTime.current = Date.now()
    firstHovered.current = null
    reversalCount.current = 0
    lastSide.current = null
    switched.current = false
    cursorHistoryRef.current = []
    hoverSideRef.current = null
    hoverEnterTime.current = null
    setCursorX(0)
    cursorRef.current = 0
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
    // Stillman 2018 / 5-minute taste-extraction redesign: long dwell = conflict
    // between near-equal utilities, not preference strength. Snap-but-not-impulsive
    // picks are most reliable; both very-fast and very-slow get discounted.
    const confidence = dwellSec < 0.4
      ? 0.5
      : dwellSec <= 2.0
        ? 1.0
        : Math.max(0.3, 1 - (dwellSec - 2.0) / 4.0)
    const sliderPos = Math.min(1, Math.abs(cursorRef.current))
    const slideCommitmentWeight = getSlideCommitmentWeight(sliderPos)

    const priorHesitations = hoveredButNotChosen.current.filter(
      h => h.pair === pairIdx + 1
    ).length
    const hesitationPenalty = priorHesitations > 0 ? 0.7 : 1.0

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
      priorHesitations,
      hesitationPenalty,
      coord: chosenCoord,
    })

    const vDelta = (chosenCoord.v - 0.5) * confidence * slideCommitmentWeight * hesitationPenalty
    const aDelta = (chosenCoord.a - 0.5) * confidence * slideCommitmentWeight * hesitationPenalty * 0.5
    const dDelta = (chosenCoord.d - 0.5) * confidence * slideCommitmentWeight * hesitationPenalty * 0.5
    const switchWeight = switched.current ? 0.6 : 1.0
    avd.updateValence(vDelta * switchWeight, 1.0)
    avd.updateArousal(aDelta * switchWeight, 1.0)
    avd.updateDepth(dDelta * switchWeight, 1.0)

    if (navigator.vibrate) navigator.vibrate(10)

    const markX = STAVE_X_OFFSET + (pairIdx * MARK_SPACING) + MARK_SPACING / 2
    const dip = side === 'left' ? 'left' : 'right'
    setMarks(prev => [...prev, { x: markX, dip }])

    const completedPair = pairIdx + 1

    if (completedPair === 4) {
      const warmCount = results.current.filter(r => r.coord.v > 0.5).length
      const coldCount = results.current.filter(r => r.coord.v < 0.5).length
      let comment = null
      if (warmCount >= 3) comment = 'you\'re choosing the warmer ones — interesting'
      else if (coldCount >= 3) comment = 'you\'re leaning into shadow — i see it'
      else comment = 'you\'re holding the middle. that\'s also a choice.'
      setTransparencyComment(comment)
      setTimeout(() => setTransparencyComment(null), 3500)
    }
    if (completedPair === 2) playVoice(VOICE_PATHS[0])
    if (completedPair === 4) playVoice(VOICE_PATHS[1])
    if (completedPair === 6) playVoice(VOICE_PATHS[2])

    setPairVisible(false)
    if (showHint) setShowHint(false)

    setTimeout(() => {
      if (pairIdx < PAIRS.length - 1) {
        setPairIdx(prev => prev + 1)
        setPairVisible(true)
        setTransitioning(false)
      } else {
        playVoice(VOICE_PATHS[3])
        avd.setPhaseData('spectrum', {
          pairs: results.current,
          hoveredButNotChosen: hoveredButNotChosen.current,
        })
        setTimeout(() => onNext({ spectrum: results.current }), 1500)
      }
    }, 600)
  }, [pairIdx, transitioning, avd, onNext, stopAudio, pair, getSlideCommitmentWeight, showHint])

  // Map a screen X coordinate to cursor position [-1, 1] using the slider area.
  const updateFromX = useCallback((clientX) => {
    if (transitioning || !areaRef.current) return
    const rect = areaRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const halfBand = rect.width * 0.35   // travel ±35% of width before clamping
    const raw = (clientX - centerX) / halfBand
    const position = Math.max(-1, Math.min(1, raw))

    setCursorX(position)
    cursorRef.current = position
    cursorHistoryRef.current.push(position)
    if (cursorHistoryRef.current.length > 60) cursorHistoryRef.current.shift()

    // Audio crossfade — power curve up to 0.85 lean, then full silence on the
    // opposite clip from 0.85 → 1.0. Smooth ramp into total isolation before
    // the absolute corner so the "blocking" feel kicks in earlier than 100%.
    const stretched = Math.min(1, Math.abs(position) / 0.85)
    const balance = Math.sign(position) * Math.pow(stretched, 0.6)
    if (pairRef.current) pairRef.current.setBalance(balance)

    // Reversal + first-hover tracking past a small dead zone.
    if (Math.abs(position) > 0.1) {
      const side = position < 0 ? 'left' : 'right'
      if (!firstHovered.current) firstHovered.current = side
      if (lastSide.current && lastSide.current !== side) {
        reversalCount.current++
      }
      lastSide.current = side
    }

    // Hesitation: cursor crossed past LEAN_THRESHOLD on a side and then came
    // back below it (or to the other side) without committing. Records a
    // hover-without-commit event that dampens the eventual lock's AVD delta.
    if (Math.abs(position) > LEAN_THRESHOLD) {
      const side = position < 0 ? 'left' : 'right'
      if (hoverSideRef.current !== side) {
        // Crossing into a new side — close out the previous side's hover (if any).
        if (hoverSideRef.current && hoverEnterTime.current) {
          const dwellMs = Date.now() - hoverEnterTime.current
          if (dwellMs > 400) {
            hoveredButNotChosen.current.push({
              pair: pairIdx + 1,
              side: hoverSideRef.current,
              label: hoverSideRef.current === 'left' ? pair.left : pair.right,
              dwellMs,
            })
          }
        }
        hoverSideRef.current = side
        hoverEnterTime.current = Date.now()
      }
    } else if (hoverSideRef.current) {
      // Released back into dead zone — log if dwell was meaningful.
      const dwellMs = Date.now() - (hoverEnterTime.current || Date.now())
      if (dwellMs > 400) {
        hoveredButNotChosen.current.push({
          pair: pairIdx + 1,
          side: hoverSideRef.current,
          label: hoverSideRef.current === 'left' ? pair.left : pair.right,
          dwellMs,
        })
      }
      hoverSideRef.current = null
      hoverEnterTime.current = null
    }
  }, [transitioning, pairIdx, pair])

  // === Touch: drag to lean, release to lock ===
  const handleTouchStart = useCallback((e) => {
    if (transitioning) return
    touchActiveRef.current = true
    const touch = e.touches[0]
    if (touch) updateFromX(touch.clientX)
  }, [transitioning, updateFromX])

  const handleTouchMove = useCallback((e) => {
    if (transitioning || !touchActiveRef.current) return
    const touch = e.touches[0]
    if (touch) updateFromX(touch.clientX)
  }, [transitioning, updateFromX])

  const handleTouchEnd = useCallback(() => {
    if (transitioning || !touchActiveRef.current) return
    touchActiveRef.current = false
    const pos = cursorRef.current
    if (Math.abs(pos) > LEAN_THRESHOLD) {
      lockChoice(pos < 0 ? 'left' : 'right')
    }
  }, [transitioning, lockChoice])

  // === Mouse: move to lean, click to lock ===
  const handleMouseMove = useCallback((e) => {
    updateFromX(e.clientX)
  }, [updateFromX])

  const handleMouseClick = useCallback(() => {
    if (transitioning) return
    const pos = cursorRef.current
    if (Math.abs(pos) > LEAN_THRESHOLD) {
      lockChoice(pos < 0 ? 'left' : 'right')
    }
  }, [transitioning, lockChoice])

  const cursorSvgX = STAVE_X_OFFSET + (STAVE_WIDTH / 2) + cursorX * (STAVE_WIDTH / 2)

  return (
    <div
      ref={areaRef}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseMove={isMouse ? handleMouseMove : undefined}
      onClick={isMouse ? handleMouseClick : undefined}
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
            </div>

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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          {isMouse
            ? 'move toward a word and click to lock'
            : 'drag toward a word and release to lock'}
        </motion.div>
      )}

      {transparencyComment && (
        <motion.div
          style={{
            position: 'absolute',
            top: '60%',
            left: 24,
            right: 24,
            textAlign: 'center',
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 13,
            color: COLORS.scoreAmber,
            lineHeight: 1.7,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.85 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {transparencyComment}
        </motion.div>
      )}
    </div>
  )
}
