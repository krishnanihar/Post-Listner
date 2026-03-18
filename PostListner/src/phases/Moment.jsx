import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { audioEngine } from '../engine/audio'
// ElevenLabs API disabled — using pre-generated track instead
// import { generateMusic, generateMusicWithPlan } from '../engine/elevenlabs'

export default function Moment({ onNext, avd, inputMode }) {
  const [circleSize, setCircleSize] = useState(80)
  const [ripples, setRipples] = useState([])
  const [phase, setPhase] = useState('waiting') // waiting, playing, done
  const [pressing, setPressing] = useState(false)
  const taps = useRef([])
  const trackRef = useRef(null)
  const startTimeRef = useRef(null)
  const rippleId = useRef(0)
  const DURATION = 30

  const startTrack = useCallback(() => {
    setPhase('playing')
    startTimeRef.current = Date.now()
    trackRef.current = audioEngine.playBuildAndDrop(DURATION)

    setTimeout(() => {
      setPhase('done')
      calculateArousal()
    }, DURATION * 1000)
  }, [])

  useEffect(() => {
    // Clean up any lingering audio from previous phases
    audioEngine.stopAll()
    // Auto-start after a brief pause
    const timer = setTimeout(startTrack, 1500)
    return () => {
      clearTimeout(timer)
      if (trackRef.current) trackRef.current.stop()
    }
  }, [])

  const calculateArousal = useCallback(() => {
    const elapsed = taps.current.map(t => (t - startTimeRef.current) / 1000)
    const tapsDuringBuild = elapsed.filter(t => t < 18).length
    const tapsDuringRelease = elapsed.filter(t => t >= 20 && t < DURATION).length
    const totalTaps = elapsed.length

    // Check for pre-drop silence (gap > 2s around 18-20s)
    const tapsNearDrop = elapsed.filter(t => t >= 16 && t <= 22)
    let preDropSilence = false
    if (tapsNearDrop.length >= 2) {
      for (let i = 1; i < tapsNearDrop.length; i++) {
        if (tapsNearDrop[i] - tapsNearDrop[i-1] > 2) {
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
      0.30 * normalize(tapsDuringBuild, 0, 40) +
      0.15 * (preDropSilence ? 1.0 : 0.4) +
      0.30 * normalize(tapsDuringRelease, 0, 20) +
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
    const musicPromise = Promise.resolve('/pldemo.mp3')

    // Implode animation then advance
    setTimeout(() => {
      onNext({
        moment: { totalTaps, tapsDuringBuild, preDropSilence, tapsDuringRelease, peakTapRate },
        musicPromise,
      })
    }, 1200)
  }, [avd, onNext])

  const handleTap = useCallback(() => {
    if (phase !== 'playing') return
    audioEngine.playTapSound()
    const now = Date.now()
    taps.current.push(now)

    // Grow circle
    setCircleSize(prev => Math.min(300, prev + 5))

    // Add ripple
    const id = rippleId.current++
    setRipples(prev => [...prev, { id, time: now }])
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id))
    }, 1000)

    if (navigator.vibrate) navigator.vibrate(5)
  }, [phase])

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

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center select-none"
      style={{ touchAction: 'none' }}
      onClick={handleTap}
      onPointerDown={() => setPressing(true)}
      onPointerUp={() => setPressing(false)}
      onPointerCancel={() => setPressing(false)}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 px-6 pt-6 sm:px-8 sm:pt-8">
        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          04 — THE MOMENT
        </span>
      </div>

      {/* Circle + ripples */}
      <div className="relative flex items-center justify-center">
        {/* Ripples */}
        {ripples.map(r => (
          <motion.div
            key={r.id}
            className="absolute rounded-full"
            style={{
              width: circleSize,
              height: circleSize,
              border: '1px solid var(--accent)',
            }}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        ))}

        {/* Main circle */}
        <motion.div
          className="rounded-full"
          style={{
            background: phase === 'done'
              ? 'var(--accent)'
              : pressing
                ? 'rgba(212, 160, 83, 0.35)'
                : 'rgba(212, 160, 83, 0.15)',
            border: '1px solid var(--accent)',
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
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          listen...
        </motion.p>
      )}
    </div>
  )
}
