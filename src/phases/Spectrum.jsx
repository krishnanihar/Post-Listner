import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'

// Each pair has AVD coordinates from SPECTRUM-AUDIO-PROMPTS.md
// Left = low valence pole, Right = high valence pole
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

export default function Spectrum({ onNext, avd, inputMode }) {
  const [pairIdx, setPairIdx] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [dividerOffset, setDividerOffset] = useState(0)
  const [activeLabel, setActiveLabel] = useState(null)
  const [hoveredSide, setHoveredSide] = useState(null)
  const [holdProgress, setHoldProgress] = useState(0)
  const holdTimer = useRef(null)
  const holdAnimRef = useRef(null)
  const holdStartRef = useRef(null)
  const startTime = useRef(null)
  const pairStartTime = useRef(Date.now())
  const switched = useRef(false)
  const currentChoice = useRef(null)
  const firstHovered = useRef(null)
  const pairRef = useRef(null)
  const areaRef = useRef(null)
  const results = useRef([])
  const reversalCount = useRef(0)
  const lastSide = useRef(null)
  const isMouse = inputMode === 'mouse'

  const pair = PAIRS[pairIdx]

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
    const p = audioEngine.playMp3Pair(urlL, urlR, 10)
    pairRef.current = p
    pairStartTime.current = Date.now()
    firstHovered.current = null
    reversalCount.current = 0
    lastSide.current = null
  }, [pair, stopAudio])

  useEffect(() => {
    startPair()
    return stopAudio
  }, [pairIdx])

  // Compute slide commitment weight from slider position, reversals, and dwell time
  const getSlideCommitmentWeight = useCallback((sliderPosition) => {
    // sliderPosition: normalized 0-1 (how far from center at moment of commitment)
    const positionFactor = Math.max(0.2, sliderPosition)

    // Reversals: more reversals = more ambivalence = lower weight
    const reversals = reversalCount.current
    const reversalPenalty = 1.0 / (1.0 + reversals * 0.3)

    // Dwell time: longer dwell = more considered = moderate boost
    const dwellSec = (Date.now() - pairStartTime.current) / 1000
    const dwellFactor = Math.max(0.3, Math.min(1.2, dwellSec / 4.0))

    return positionFactor * reversalPenalty * dwellFactor
  }, [])

  const lockChoice = useCallback((side, confidenceOverride, sliderPos) => {
    if (transitioning) return
    setTransitioning(true)
    stopAudio()
    cancelAnimationFrame(holdAnimRef.current)
    setHoldProgress(0)

    let confidence
    if (confidenceOverride !== undefined) {
      confidence = confidenceOverride
    } else {
      const reactionMs = Date.now() - (startTime.current || Date.now())
      confidence = Math.min(1, (reactionMs / 1000) / 3)
    }

    const reactionMs = Date.now() - (pairStartTime.current || Date.now())
    const sliderPosition = sliderPos !== undefined ? sliderPos : 0.5

    // Get the chosen clip's AVD coordinates
    const chosenCoord = side === 'left' ? pair.coordL : pair.coordR
    const slideCommitmentWeight = getSlideCommitmentWeight(sliderPosition)

    results.current.push({
      pair: pairIdx + 1,
      choice: side,
      label: side === 'left' ? pair.left : pair.right,
      confidence,
      reactionMs,
      switched: switched.current,
      reversals: reversalCount.current,
      coord: chosenCoord,
    })

    // Coordinate-based AVD updates
    // delta = (chosenClip.dimension - 0.5) * confidence * slideCommitmentWeight
    const vDelta = (chosenCoord.v - 0.5) * confidence * slideCommitmentWeight
    const aDelta = (chosenCoord.a - 0.5) * confidence * slideCommitmentWeight * 0.5 // secondary contribution
    const dDelta = (chosenCoord.d - 0.5) * confidence * slideCommitmentWeight * 0.5 // secondary contribution

    const switchWeight = switched.current ? 0.6 : 1.0
    avd.updateValence(vDelta * switchWeight, 1.0)
    avd.updateArousal(aDelta * switchWeight, 1.0)
    avd.updateDepth(dDelta * switchWeight, 1.0)

    if (navigator.vibrate) navigator.vibrate(10)

    setDividerOffset(side === 'left' ? -40 : 40)
    setHoveredSide(null)

    const transitionMs = isMouse ? 200 : 400
    setTimeout(() => {
      if (pairIdx < PAIRS.length - 1) {
        setPairIdx(prev => prev + 1)
        setDividerOffset(0)
        setActiveLabel(null)
        setHoveredSide(null)
        switched.current = false
        currentChoice.current = null
        startTime.current = null
        firstHovered.current = null
        setTransitioning(false)
      } else {
        avd.setPhaseData('spectrum', { pairs: results.current })
        onNext({ spectrum: results.current })
      }
    }, transitionMs)
  }, [pairIdx, transitioning, avd, onNext, stopAudio, pair, getSlideCommitmentWeight])

  // Track direction reversals for commitment weight
  const trackReversal = useCallback((side) => {
    if (lastSide.current && lastSide.current !== side) {
      reversalCount.current++
    }
    lastSide.current = side
  }, [])

  // === MOUSE: Click anywhere to lock whichever side the divider is on ===
  const handleMouseClick = useCallback(() => {
    if (transitioning || !hoveredSide) return
    if (firstHovered.current && firstHovered.current !== hoveredSide) {
      switched.current = true
    }
    const dwellSec = (Date.now() - pairStartTime.current) / 1000
    const confidence = Math.max(0.2, Math.min(1, (dwellSec - 0.5) / 4.0))
    // Compute slider position as fraction of max offset
    const rect = areaRef.current?.getBoundingClientRect()
    const maxOffset = rect ? rect.width * 0.35 : 200
    const sliderPos = Math.min(1, Math.abs(dividerOffset) / maxOffset)
    lockChoice(hoveredSide, confidence, sliderPos)
  }, [transitioning, hoveredSide, lockChoice, dividerOffset])

  // === MOUSE: Track cursor position for divider ===
  const handleMouseMove = useCallback((e) => {
    if (transitioning || !areaRef.current) return
    const rect = areaRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const relX = e.clientX - centerX
    const maxOffset = rect.width * 0.35
    const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, relX))

    setDividerOffset(clampedOffset)

    const side = relX < 0 ? 'left' : 'right'
    if (!firstHovered.current) firstHovered.current = side
    trackReversal(side)
    setHoveredSide(side)
    setActiveLabel(side)

    // Audio balance — power curve so isolation kicks in faster
    const raw = Math.max(-1, Math.min(1, relX / (rect.width * 0.3)))
    const balance = Math.sign(raw) * Math.pow(Math.abs(raw), 0.6)
    if (pairRef.current) pairRef.current.setBalance(balance)
  }, [transitioning, trackReversal])

  const handleMouseLeaveArea = useCallback(() => {
    if (transitioning) return
    setHoveredSide(null)
    setActiveLabel(null)
    if (pairRef.current) pairRef.current.setBalance(0)
    setDividerOffset(0)
  }, [transitioning])

  // === TOUCH: Hold to select ===
  const HOLD_DURATION = 800
  const handleSideDown = useCallback((side) => {
    if (transitioning) return
    if (!startTime.current) startTime.current = Date.now()
    if (currentChoice.current && currentChoice.current !== side) {
      switched.current = true
    }
    currentChoice.current = side
    trackReversal(side)
    setActiveLabel(side)

    if (pairRef.current) {
      pairRef.current.setBalance(side === 'left' ? -0.7 : 0.7)
    }
    const rect = areaRef.current?.getBoundingClientRect()
    const touchOffset = rect ? rect.width * 0.12 : 40
    setDividerOffset(side === 'left' ? -touchOffset : touchOffset)

    clearTimeout(holdTimer.current)
    cancelAnimationFrame(holdAnimRef.current)
    holdStartRef.current = Date.now()
    const animateProgress = () => {
      const elapsed = Date.now() - holdStartRef.current
      const progress = Math.min(1, elapsed / HOLD_DURATION)
      setHoldProgress(progress)
      if (progress < 1) holdAnimRef.current = requestAnimationFrame(animateProgress)
    }
    holdAnimRef.current = requestAnimationFrame(animateProgress)
    holdTimer.current = setTimeout(() => lockChoice(side, undefined, 1.0), HOLD_DURATION)
  }, [transitioning, lockChoice, trackReversal])

  const handleSideUp = useCallback(() => {
    clearTimeout(holdTimer.current)
    cancelAnimationFrame(holdAnimRef.current)
    setHoldProgress(0)
    if (pairRef.current) pairRef.current.setBalance(0)
    setDividerOffset(0)
  }, [])

  const handleSwipe = useCallback((_e, info) => {
    if (transitioning) return
    if (Math.abs(info.offset.x) > 60) {
      const side = info.offset.x < 0 ? 'left' : 'right'
      if (!startTime.current) startTime.current = Date.now()
      const swipeStrength = Math.min(1, Math.abs(info.offset.x) / 150)
      lockChoice(side, undefined, swipeStrength)
    }
  }, [transitioning, lockChoice])

  // === MOUSE: Keyboard arrow keys ===
  const handleKeySelect = useCallback((side) => {
    if (transitioning) return
    if (firstHovered.current && firstHovered.current !== side) {
      switched.current = true
    }
    const dwellSec = (Date.now() - pairStartTime.current) / 1000
    const confidence = Math.max(0.2, Math.min(1, (dwellSec - 0.5) / 4.0))
    lockChoice(side, confidence, 0.5)
  }, [transitioning, lockChoice])

  useEffect(() => {
    if (!isMouse) return
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') handleKeySelect('left')
      if (e.key === 'ArrowRight') handleKeySelect('right')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isMouse, handleKeySelect])

  const hintText = isMouse ? 'move to lean, click to lock' : 'hold or swipe to choose'

  return (
    <div className="h-full w-full flex flex-col select-none" style={{ touchAction: 'none' }}>
      {/* Header */}
      <div className="flex justify-between items-center px-6 pt-6 sm:px-8 sm:pt-8">
        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          01 — THE SPECTRUM
        </span>
        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          {pairIdx + 1}/{PAIRS.length}
        </span>
      </div>

      {/* Main interaction area */}
      <motion.div
        ref={areaRef}
        className="flex-1 flex relative"
        onPanEnd={isMouse ? undefined : handleSwipe}
        {...(isMouse ? {
          onClick: handleMouseClick,
          onMouseMove: handleMouseMove,
          onMouseLeave: handleMouseLeaveArea,
          style: { cursor: 'pointer' },
        } : {})}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pairIdx}
            className="absolute inset-0 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Left zone */}
            <div
              className="flex-1 flex items-center justify-center relative"
              style={{ cursor: 'pointer' }}
              {...(isMouse ? {} : {
                onPointerDown: () => handleSideDown('left'),
                onPointerUp: handleSideUp,
                onPointerCancel: handleSideUp,
              })}
            >
              {!isMouse && holdProgress > 0 && activeLabel === 'left' && (
                <svg className="absolute" width="64" height="64" style={{ pointerEvents: 'none' }}>
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" opacity="0.2" />
                  <motion.circle
                    cx="32" cy="32" r="28" fill="none" stroke="var(--accent)" strokeWidth="2"
                    strokeLinecap="round"
                    style={{ pathLength: holdProgress, rotate: -90, transformOrigin: 'center' }}
                  />
                </svg>
              )}
              <motion.span
                className="font-serif"
                style={{ fontSize: 'clamp(24px, 6vw, 36px)', color: 'var(--text)' }}
                animate={{
                  scale: activeLabel === 'left' ? 1.05 : 1,
                  opacity: hoveredSide === 'right' ? 0.4 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                {pair.left}
              </motion.span>
            </div>

            {/* Divider */}
            <motion.div
              className="absolute top-1/4 bottom-1/4 flex flex-col items-center justify-end"
              style={{
                left: '50%',
                width: 1,
                background: 'var(--accent)',
              }}
              animate={{ x: dividerOffset }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <span className="font-mono whitespace-nowrap absolute -bottom-8"
                    style={{ fontSize: '12px', color: 'var(--text-dim)', transform: 'translateX(-50%)' }}>
                {hintText}
              </span>
            </motion.div>

            {/* Right zone */}
            <div
              className="flex-1 flex items-center justify-center relative"
              style={{ cursor: 'pointer' }}
              {...(isMouse ? {} : {
                onPointerDown: () => handleSideDown('right'),
                onPointerUp: handleSideUp,
                onPointerCancel: handleSideUp,
              })}
            >
              {!isMouse && holdProgress > 0 && activeLabel === 'right' && (
                <svg className="absolute" width="64" height="64" style={{ pointerEvents: 'none' }}>
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" opacity="0.2" />
                  <motion.circle
                    cx="32" cy="32" r="28" fill="none" stroke="var(--accent)" strokeWidth="2"
                    strokeLinecap="round"
                    style={{ pathLength: holdProgress, rotate: -90, transformOrigin: 'center' }}
                  />
                </svg>
              )}
              <motion.span
                className="font-serif"
                style={{ fontSize: 'clamp(24px, 6vw, 36px)', color: 'var(--text)' }}
                animate={{
                  scale: activeLabel === 'right' ? 1.05 : 1,
                  opacity: hoveredSide === 'left' ? 0.4 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                {pair.right}
              </motion.span>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
