import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'
import PhaseGuide from '../components/PhaseGuide'
// ElevenLabs API disabled — using pre-generated track instead
// import { generateMusic, generateMusicWithPlan } from '../engine/elevenlabs'

function lerpColor(heat) {
  // Amber (212,160,83) → Hot (255,80,23)
  const r = Math.round(212 + heat * 43)
  const g = Math.round(160 - heat * 80)
  const b = Math.round(83 - heat * 60)
  return { r, g, b }
}

function heatRgba({ r, g, b }, a) {
  return `rgba(${r},${g},${b},${a})`
}

export default function Moment({ onNext, avd, inputMode }) {
  const [showGuide, setShowGuide] = useState(true)
  const [circleSize, setCircleSize] = useState(80)
  const [ripples, setRipples] = useState([])
  const [phase, setPhase] = useState('waiting') // waiting, playing, done
  const [pressing, setPressing] = useState(false)
  const [heat, setHeat] = useState(0)
  const [tapRate, setTapRate] = useState(0)
  const [shakeOffset, setShakeOffset] = useState(null)
  const taps = useRef([])
  const tapTimestamps = useRef([]) // for heat/rate calculation (2s window)
  const lastTapTime = useRef(0)
  const trackRef = useRef(null)
  const startTimeRef = useRef(null)
  const rippleId = useRef(0)
  const contractionTimer = useRef(null)
  const contractionInterval = useRef(null)
  const shakeTimer = useRef(null)
  const DURATION = 10

  const startTrack = useCallback(() => {
    setPhase('playing')
    startTimeRef.current = Date.now()
    trackRef.current = audioEngine.playBuildAndDrop(DURATION)

    setTimeout(() => {
      setPhase('done')
      calculateArousal()
    }, DURATION * 1000)
  }, [])

  const startTimerRef = useRef(null)

  useEffect(() => {
    // Clean up any lingering audio from previous phases
    audioEngine.stopAll()
    return () => {
      clearTimeout(startTimerRef.current)
      if (trackRef.current) trackRef.current.stop()
    }
  }, [])

  const calculateArousal = useCallback(() => {
    const elapsed = taps.current.map(t => (t - startTimeRef.current) / 1000)
    const buildEnd = DURATION * 0.6
    const dropStart = DURATION * 0.667
    const tapsDuringBuild = elapsed.filter(t => t < buildEnd).length
    const tapsDuringRelease = elapsed.filter(t => t >= dropStart && t < DURATION).length
    const totalTaps = elapsed.length

    // Check for pre-drop silence (gap around the drop point)
    const dropZoneStart = DURATION * 0.53
    const dropZoneEnd = DURATION * 0.73
    const tapsNearDrop = elapsed.filter(t => t >= dropZoneStart && t <= dropZoneEnd)
    let preDropSilence = false
    if (tapsNearDrop.length >= 2) {
      for (let i = 1; i < tapsNearDrop.length; i++) {
        if (tapsNearDrop[i] - tapsNearDrop[i-1] > 1.3) {
          preDropSilence = true
          break
        }
      }
    } else if (tapsNearDrop.length <= 1) {
      preDropSilence = true
    }

    // Peak tap rate (max taps per second)
    let peakTapRate = 0
    for (let i = 0; i < elapsed.length; i++) {
      const windowEnd = elapsed[i] + 1
      const count = elapsed.filter(t => t >= elapsed[i] && t < windowEnd).length
      peakTapRate = Math.max(peakTapRate, count)
    }

    const normalize = (val, min, max) => Math.max(0, Math.min(1, (val - min) / (max - min)))

    const A =
      0.30 * normalize(tapsDuringBuild, 0, 20) +
      0.15 * (preDropSilence ? 1.0 : 0.4) +
      0.30 * normalize(tapsDuringRelease, 0, 10) +
      0.25 * normalize(peakTapRate, 0, 5)

    avd.setArousal(A)
    avd.setPhaseData('moment', {
      totalTaps,
      tapsDuringBuild,
      preDropSilence,
      tapsDuringRelease,
      peakTapRate: Math.round(peakTapRate * 10) / 10,
    })

    // Use pre-generated demo track instead of ElevenLabs API
    const musicPromise = Promise.resolve('/chamber/tracks/track-a.mp3')

    // Implode animation then advance
    setTimeout(() => {
      onNext({
        moment: { totalTaps, tapsDuringBuild, preDropSilence, tapsDuringRelease, peakTapRate },
        musicPromise,
      })
    }, 1200)
  }, [avd, onNext])

  // Contraction: circle shrinks back when idle for 2s
  const resetContractionTimer = useCallback(() => {
    clearTimeout(contractionTimer.current)
    clearInterval(contractionInterval.current)
    contractionTimer.current = setTimeout(() => {
      contractionInterval.current = setInterval(() => {
        setCircleSize(prev => {
          if (prev <= 80) { clearInterval(contractionInterval.current); return 80 }
          return prev - 2
        })
      }, 100)
    }, 2000)
  }, [])

  // Clean up contraction timers
  useEffect(() => {
    return () => {
      clearTimeout(contractionTimer.current)
      clearInterval(contractionInterval.current)
      clearTimeout(shakeTimer.current)
    }
  }, [])

  // Heat decay over time
  useEffect(() => {
    if (phase !== 'playing') return
    const iv = setInterval(() => {
      setHeat(prev => Math.max(0, prev - 0.015))
      // Update tap rate (prune timestamps older than 2s)
      const now = Date.now()
      tapTimestamps.current = tapTimestamps.current.filter(t => now - t < 2000)
      setTapRate(tapTimestamps.current.length / 2)
    }, 50)
    return () => clearInterval(iv)
  }, [phase])

  const handleTap = useCallback(() => {
    if (phase !== 'playing') return
    audioEngine.playTapSound()
    const now = Date.now()
    const dt = now - lastTapTime.current
    lastTapTime.current = now
    taps.current.push(now)

    // Track timestamps for rate/heat
    tapTimestamps.current.push(now)
    tapTimestamps.current = tapTimestamps.current.filter(t => now - t < 2000)
    const rate = tapTimestamps.current.length / 2
    setTapRate(rate)
    setHeat(prev => Math.min(1, prev + 0.08))

    // Grow circle
    setCircleSize(prev => Math.min(300, prev + 4 + rate * 0.5))

    // Adaptive ripple speed: faster taps = faster ripple
    const rippleDuration = Math.max(0.4, Math.min(1.0, dt / 500))
    const id = rippleId.current++
    setRipples(prev => [...prev, { id, time: now, duration: rippleDuration }])
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id))
    }, rippleDuration * 1000 + 100)

    // Screen shake at high tap rates
    if (rate > 3) {
      setShakeOffset({
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 6,
      })
      clearTimeout(shakeTimer.current)
      shakeTimer.current = setTimeout(() => setShakeOffset(null), 50)
    }

    // Reset contraction timer
    resetContractionTimer()

    if (navigator.vibrate) navigator.vibrate(5)
  }, [phase, resetContractionTimer])

  // Mouse: spacebar to tap
  useEffect(() => {
    if (inputMode !== 'mouse') return
    const handleKey = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        handleTap()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [inputMode, handleTap])

  const handleGuideDismiss = useCallback(() => {
    setShowGuide(false)
    startTimerRef.current = setTimeout(startTrack, 1500)
  }, [startTrack])

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center select-none relative"
      style={{
        touchAction: 'none',
        transform: shakeOffset ? `translate(${shakeOffset.x}px, ${shakeOffset.y}px)` : undefined,
      }}
      onClick={showGuide ? undefined : handleTap}
      onPointerDown={showGuide ? undefined : () => setPressing(true)}
      onPointerUp={showGuide ? undefined : () => setPressing(false)}
      onPointerCancel={showGuide ? undefined : () => setPressing(false)}
    >
      <AnimatePresence>
        {showGuide && (
          <PhaseGuide
            phaseNumber="04"
            title="The Moment"
            body="A track will play. Press spacebar to the beat."
            touchBody="A track will play. Tap the screen to the beat."
            onDismiss={handleGuideDismiss}
            inputMode={inputMode}
          />
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="absolute top-0 left-0 px-6 pt-6 sm:px-8 sm:pt-8">
        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          04 — THE MOMENT
        </span>
      </div>

      {/* Circle + ripples */}
      {(() => {
        const col = lerpColor(heat)
        const glowSize = 20 + heat * 40
        const glowAlpha = 0.15 + heat * 0.25
        return (
          <div className="relative flex items-center justify-center">
            {/* Ripples — heat-colored, adaptive speed */}
            {ripples.map(r => (
              <motion.div
                key={r.id}
                className="absolute rounded-full"
                style={{
                  width: circleSize,
                  height: circleSize,
                  border: `1px solid ${heatRgba(col, 1)}`,
                }}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: r.duration, ease: 'easeOut' }}
              />
            ))}

            {/* Main circle — heat-colored with dynamic glow */}
            <motion.div
              className="rounded-full"
              style={{
                background: phase === 'done'
                  ? heatRgba(col, 1)
                  : pressing
                    ? heatRgba(col, 0.35)
                    : heatRgba(col, 0.1 + heat * 0.15),
                border: `1px solid ${heatRgba(col, 1)}`,
                boxShadow: phase !== 'done'
                  ? `0 0 ${glowSize}px ${heatRgba(col, glowAlpha)}`
                  : 'none',
              }}
              animate={phase === 'done' ? {
                scale: [1, 1.3, 0],
                opacity: [1, 1, 0],
              } : {
                width: circleSize,
                height: circleSize,
              }}
              transition={phase === 'done' ? {
                duration: 1,
                ease: 'easeInOut',
              } : {
                duration: 0.15,
              }}
            />
          </div>
        )
      })()}

      {/* Tap rate counter */}
      {phase === 'playing' && tapRate > 0 && (
        <motion.span
          className="absolute font-mono"
          style={{
            bottom: '8%',
            right: 20,
            fontSize: '10px',
            color: tapRate > 2 ? 'var(--accent)' : 'var(--text-dim)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
        >
          {tapRate.toFixed(1)}/s
        </motion.span>
      )}

      {/* Instruction */}
      {phase === 'playing' && (
        <motion.p
          className="absolute font-mono"
          style={{
            bottom: '25%',
            fontSize: '11px',
            color: 'var(--text-dim)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
        >
          {inputMode === 'mouse' ? 'press spacebar to the beat' : 'tap to the beat'}
        </motion.p>
      )}

      {phase === 'waiting' && (
        <motion.p
          className="absolute font-mono"
          style={{
            bottom: '25%',
            fontSize: '11px',
            color: 'var(--text-dim)',
          }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          listen...
        </motion.p>
      )}
    </div>
  )
}
