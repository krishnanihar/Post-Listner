import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'

const PAIRS = [
  // shadow: subterranean rumble, barely audible | warmth: bright mid-range chord, full & rich
  { left: 'shadow',  right: 'warmth',
    audioL: { freq: 55, oscType: 'sine', filter: { type: 'lowpass', freq: 150, Q: 3 }, vibrato: { freq: 0.3, depth: 1 } },
    audioR: { freqs: [220, 277.18, 329.63, 440], oscType: 'triangle', detune: 10 } },
  // pulse: aggressive square stabs | shimmer: delicate high sparkle
  { left: 'pulse',   right: 'shimmer',
    audioL: { freq: 82.41, oscType: 'square', filter: { type: 'bandpass', freq: 400, Q: 3 }, tremolo: { freq: 8, depth: 0.12 } },
    audioR: { freqs: [1318, 1568, 1760], oscType: 'sine', detune: 20, tremolo: { freq: 12, depth: 0.06 } } },
  // weight: distorted bass growl | air: pure breathy noise, no pitch
  { left: 'weight',  right: 'air',
    audioL: { freq: 41.2, oscType: 'sawtooth', distortion: 30, filter: { type: 'lowpass', freq: 180, Q: 5 } },
    audioR: { type: 'noise', filter: { type: 'highpass', freq: 4000, Q: 0.5 } } },
  // ache: beating dissonance, semitone clash | bloom: open fifth, gentle triangle swell
  { left: 'ache',    right: 'bloom',
    audioL: { freqs: [146.83, 155.56, 293.66, 311.13], oscType: 'sawtooth', filter: { type: 'lowpass', freq: 800, Q: 2 }, vibrato: { freq: 4, depth: 6 } },
    audioR: { freqs: [261.63, 392, 523.25], oscType: 'triangle', detune: 5 } },
  // machine: rhythmic industrial noise | earth: deep organic drone with rumble
  { left: 'machine', right: 'earth',
    audioL: { type: 'noise', filter: { type: 'bandpass', freq: 1200, Q: 8, lfoFreq: 6, lfoDepth: 800 } },
    audioR: { freq: 44, oscType: 'sine', noiseMix: { filterType: 'lowpass', filterFreq: 120, gain: 0.1 }, vibrato: { freq: 0.2, depth: 1 } } },
  // tension: harsh buzzing cluster | resolve: pure clean octaves
  { left: 'tension', right: 'resolve',
    audioL: { freqs: [220, 233.08, 246.94], oscType: 'sawtooth', distortion: 10, filter: { type: 'lowpass', freq: 1500, Q: 6 } },
    audioR: { freqs: [261.63, 523.25], oscType: 'sine' } },
  // fog: muffled noise wash, no clear pitch | glass: piercing high sine, crystal clear
  { left: 'fog',     right: 'glass',
    audioL: { type: 'noise', filter: { type: 'lowpass', freq: 300, Q: 1, lfoFreq: 0.2, lfoDepth: 150 } },
    audioR: { freq: 1046.5, oscType: 'sine', tremolo: { freq: 16, depth: 0.05 } } },
  // gravity: sub-bass square drone | drift: airy high chord, slowly wandering
  { left: 'gravity', right: 'drift',
    audioL: { freq: 36.71, oscType: 'square', filter: { type: 'lowpass', freq: 120 }, distortion: 8 },
    audioR: { freqs: [659.26, 783.99, 987.77], oscType: 'sine', detune: 25, vibrato: { freq: 0.3, depth: 8 } } },
]

export default function Spectrum({ onNext, avd, inputMode }) {
  const [pairIdx, setPairIdx] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [dividerOffset, setDividerOffset] = useState(0)
  const [activeLabel, setActiveLabel] = useState(null)
  const [hoveredSide, setHoveredSide] = useState(null)
  const holdTimer = useRef(null)
  const startTime = useRef(null)
  const pairStartTime = useRef(Date.now())
  const switched = useRef(false)
  const currentChoice = useRef(null)
  const firstHovered = useRef(null)
  const pairRef = useRef(null)
  const areaRef = useRef(null)
  const results = useRef([])
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
    const p = audioEngine.playPair(pair.audioL, pair.audioR, 10)
    pairRef.current = p
    pairStartTime.current = Date.now()
    firstHovered.current = null
  }, [pair, stopAudio])

  useEffect(() => {
    startPair()
    return stopAudio
  }, [pairIdx])

  const lockChoice = useCallback((side, confidenceOverride) => {
    if (transitioning) return
    setTransitioning(true)
    stopAudio()

    let confidence
    if (confidenceOverride !== undefined) {
      confidence = confidenceOverride
    } else {
      const reactionMs = Date.now() - (startTime.current || Date.now())
      confidence = Math.min(1, (reactionMs / 1000) / 3)
    }

    const reactionMs = Date.now() - (pairStartTime.current || Date.now())

    results.current.push({
      pair: pairIdx + 1,
      choice: side,
      confidence,
      reactionMs,
      switched: switched.current,
    })

    // Update valence
    const delta = side === 'left' ? -0.0625 : 0.0625
    const weight = switched.current ? 0.6 : 1.0
    avd.updateValence(delta * weight * (1 + confidence), 1.0)

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
  }, [pairIdx, transitioning, avd, onNext, stopAudio])

  // === MOUSE: Click anywhere to lock whichever side the divider is on ===
  const handleMouseClick = useCallback(() => {
    if (transitioning || !hoveredSide) return
    // Switching detection
    if (firstHovered.current && firstHovered.current !== hoveredSide) {
      switched.current = true
    }
    // Confidence from dwell time
    const dwellSec = (Date.now() - pairStartTime.current) / 1000
    const confidence = Math.max(0.2, Math.min(1, (dwellSec - 0.5) / 4.0))
    lockChoice(hoveredSide, confidence)
  }, [transitioning, hoveredSide, lockChoice])

  // === MOUSE: Track cursor position for divider ===
  const handleMouseMove = useCallback((e) => {
    if (transitioning || !areaRef.current) return
    const rect = areaRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const relX = e.clientX - centerX // pixels from center
    // Clamp so divider stops ~30% from edge (where text roughly is)
    const maxOffset = rect.width * 0.35
    const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, relX))

    setDividerOffset(clampedOffset)

    const side = relX < 0 ? 'left' : 'right'
    if (!firstHovered.current) firstHovered.current = side
    setHoveredSide(side)
    setActiveLabel(side)

    // Audio balance — power curve so isolation kicks in faster
    const raw = Math.max(-1, Math.min(1, relX / (rect.width * 0.3)))
    const balance = Math.sign(raw) * Math.pow(Math.abs(raw), 0.6)
    if (pairRef.current) pairRef.current.setBalance(balance)
  }, [transitioning])

  const handleMouseLeaveArea = useCallback(() => {
    if (transitioning) return
    setHoveredSide(null)
    setActiveLabel(null)
    if (pairRef.current) pairRef.current.setBalance(0)
    setDividerOffset(0)
  }, [transitioning])

  // === TOUCH: Hold to select ===
  const handleSideDown = useCallback((side) => {
    if (transitioning) return
    if (!startTime.current) startTime.current = Date.now()
    if (currentChoice.current && currentChoice.current !== side) {
      switched.current = true
    }
    currentChoice.current = side
    setActiveLabel(side)

    if (pairRef.current) {
      pairRef.current.setBalance(side === 'left' ? -1 : 1)
    }
    setDividerOffset(side === 'left' ? -15 : 15)

    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => lockChoice(side), 3000)
  }, [transitioning, lockChoice])

  const handleSideUp = useCallback(() => {
    clearTimeout(holdTimer.current)
    if (pairRef.current) pairRef.current.setBalance(0)
    setDividerOffset(0)
  }, [])

  const handleSwipe = useCallback((e, info) => {
    if (transitioning) return
    if (Math.abs(info.offset.x) > 30) {
      const side = info.offset.x < 0 ? 'left' : 'right'
      if (!startTime.current) startTime.current = Date.now()
      lockChoice(side)
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
    lockChoice(side, confidence)
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
    <div className="h-full w-full flex flex-col select-none" style={{ touchAction: 'manipulation' }}>
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
              className="flex-1 flex items-center justify-center"
              style={{ cursor: isMouse ? 'pointer' : 'pointer' }}
              {...(isMouse ? {} : {
                onPointerDown: () => handleSideDown('left'),
                onPointerUp: handleSideUp,
                onPointerLeave: handleSideUp,
              })}
            >
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
                    style={{ fontSize: '9px', color: 'var(--text-dim)', transform: 'translateX(-50%)' }}>
                {hintText}
              </span>
            </motion.div>

            {/* Right zone */}
            <div
              className="flex-1 flex items-center justify-center"
              style={{ cursor: isMouse ? 'pointer' : 'pointer' }}
              {...(isMouse ? {} : {
                onPointerDown: () => handleSideDown('right'),
                onPointerUp: handleSideUp,
                onPointerLeave: handleSideUp,
              })}
            >
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
