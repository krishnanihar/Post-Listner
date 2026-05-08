import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'
import ConductingEngine from '../orchestra/ConductingEngine'
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
  const motionRef = useRef(true) // ref mirror for rAF closure
  const [commitProgress, setCommitProgress] = useState(0) // 0-1, visible fill under chosen word
  const [commitSide, setCommitSide] = useState(null) // 'left' | 'right' | null
  const [transparencyComment, setTransparencyComment] = useState(null)

  const admirer = useAdmirer()

  const conductingRef = useRef(null)
  const calibratingRef = useRef(false)
  const pairRef = useRef(null)
  const rafRef = useRef(null)
  const leanSideRef = useRef(null)
  const leanStartRef = useRef(null)
  const cursorHistoryRef = useRef([])
  const pairStartTime = useRef(Date.now())
  const reversalCount = useRef(0)
  const lastSide = useRef(null)
  const firstHovered = useRef(null)
  const hoveredButNotChosen = useRef([])
  const hoverEnterTime = useRef(null)
  const switched = useRef(false)
  const results = useRef([])
  const isMouse = inputMode === 'mouse'

  const pair = PAIRS[pairIdx]

  useEffect(() => {
    preloadVoices(VOICE_PATHS)
    admirer.play('spectrum.intro')
    const engine = new ConductingEngine()
    conductingRef.current = engine
    engine.requestPermission().then((granted) => {
      if (granted) {
        engine.start()
        setTimeout(() => {
          if (engine._rms < 0.01 && engine._gestureSize < 0.01) {
            setMotionAvailable(false)
            motionRef.current = false
          }
        }, 1000)
      } else {
        setMotionAvailable(false)
      }
    })
    return () => engine.stop()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

    // Recalibrate so the user's current resting orientation becomes center
    const engine = conductingRef.current
    if (engine && motionRef.current) {
      calibratingRef.current = true
      engine.startCalibration(500).then(() => {
        calibratingRef.current = false
      })
    }
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

    // Tier 2 #6: hover-without-commit indicates conflict (Stillman 2018).
    // If the user already released the lean for THIS pair earlier without
    // locking — regardless of which side — dampen the eventual commit's
    // AVD delta. This is separate from `switched` (which only catches
    // hover-side-A then commit-side-B); hesitation can also be hover-side-A,
    // release, hover-side-A again, lock-A.
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

    // Operational-transparency comment after pair 4 commits.
    // Computes a directional tally (warm/dense/sung axes) and surfaces one Forer-y line.
    if (completedPair === 4) {
      // Tally V deltas to figure out warm vs cold lean
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
        avd.setPhaseData('spectrum', {
          pairs: results.current,
          hoveredButNotChosen: hoveredButNotChosen.current,
        })
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
        // While recalibrating, hold cursor at center
        if (calibratingRef.current) {
          setCursorX(0)
          if (pairRef.current) pairRef.current.setBalance(0)
          rafRef.current = requestAnimationFrame(loop)
          return
        }

        const data = !motionRef.current ? engine._getTouchData() : engine.getData()
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
            hoverEnterTime.current = Date.now()
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
          // If the user was leaning past threshold and then released without locking,
          // record a hover-without-commit event.
          if (leanSideRef.current && leanStartRef.current && hoverEnterTime.current) {
            const dwellMs = Date.now() - hoverEnterTime.current
            if (dwellMs > 400) {
              hoveredButNotChosen.current.push({
                pair: pairIdx + 1,
                side: leanSideRef.current,
                label: leanSideRef.current === 'left' ? pair.left : pair.right,
                dwellMs,
              })
            }
          }
          leanSideRef.current = null
          leanStartRef.current = null
          hoverEnterTime.current = null
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

  // Touch/mouse fallback
  const handleTouchMove = useCallback((e) => {
    if (transitioning) return
    const touch = e.touches[0]
    const x = touch.clientX / window.innerWidth
    const engine = conductingRef.current
    if (engine) engine.updateTouch(x, 0.5, true)
  }, [transitioning])

  const handleMouseMove = useCallback((e) => {
    if (transitioning) return
    const x = e.clientX / window.innerWidth
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
      onMouseMove={isMouse ? handleMouseMove : undefined}
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
              {/* Commit fill bar above the word */}
              {commitSide === 'left' && commitProgress > 0 && (
                <div style={{
                  marginBottom: 6,
                  height: 2,
                  borderRadius: 1,
                  background: COLORS.scoreAmber,
                  opacity: commitFillOpacity,
                  width: `${commitProgress * 100}%`,
                  transition: 'width 0.1s linear',
                }} />
              )}
              {pair.left}
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
              {commitSide === 'right' && commitProgress > 0 && (
                <div style={{
                  marginBottom: 6,
                  height: 2,
                  borderRadius: 1,
                  background: COLORS.scoreAmber,
                  opacity: commitFillOpacity,
                  width: `${commitProgress * 100}%`,
                  marginLeft: 'auto',
                  transition: 'width 0.1s linear',
                }} />
              )}
              {pair.right}
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

      {/* Operational-transparency comment after pair 4 */}
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
