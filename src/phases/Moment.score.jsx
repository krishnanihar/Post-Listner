import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { audioEngine } from '../engine/audio'
import ConductingEngine from '../orchestra/ConductingEngine'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { playVoice, preloadVoices } from '../score/voice'
import { clamp } from '../chamber/utils/math'

const VOICE_PATHS = [
  '/chamber/voices/score/moment-01.mp3',
  '/chamber/voices/score/moment-02.mp3',
  '/chamber/voices/score/moment-03.mp3',
  '/chamber/voices/score/moment-04.mp3',
]

const DURATION = 30 // seconds
const TACTUS_WIDTH = 320
const TACTUS_Y = 300
const TACTUS_X_OFFSET = 20

export default function Moment({ onNext, avd, inputMode }) {
  const [downbeats, setDownbeats] = useState([]) // { x, y }
  const [tactusPath, setTactusPath] = useState('')
  const [phase, setPhase] = useState('intro') // intro, playing, done
  const [motionAvailable, setMotionAvailable] = useState(true)

  const conductingRef = useRef(null)
  const rafRef = useRef(null)
  const trackRef = useRef(null)
  const startTimeRef = useRef(null)
  const gestureSum = useRef(0)
  const sampleCount = useRef(0)
  const downbeatCount = useRef(0)
  const lastVoice03Time = useRef(0)
  const tactusPoints = useRef([])
  const finishedRef = useRef(false)

  useEffect(() => {
    preloadVoices(VOICE_PATHS)
    audioEngine.stopAll()

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
    t(0, () => playVoice(VOICE_PATHS[0]))      // "I am going to play something. Conduct it."
    t(2000, () => playVoice(VOICE_PATHS[1]))    // "Move the phone like you mean it."
    t(3000, () => startPlaying())

    return () => {
      engine.stop()
      timers.forEach(clearTimeout)
      if (trackRef.current) trackRef.current.stop()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startPlaying = useCallback(() => {
    setPhase('playing')
    startTimeRef.current = Date.now()
    trackRef.current = audioEngine.playBuildAndDrop(DURATION)

    setTimeout(() => {
      finishPhase()
    }, DURATION * 1000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const finishPhase = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setPhase('done')

    // Calculate arousal from gesture data
    const avgGesture = sampleCount.current > 0 ? gestureSum.current / sampleCount.current : 0
    const dbCount = downbeatCount.current
    const downbeatBonus = dbCount > 5 ? 0.2 : dbCount * 0.04
    const A = clamp(avgGesture + downbeatBonus, 0, 1)

    avd.setArousal(A)
    avd.setPhaseData('moment', {
      totalDownbeats: dbCount,
      avgGestureGain: Math.round(avgGesture * 100) / 100,
      tactus: tactusPoints.current.slice(), // save for Reveal score assembly
    })

    // Use pre-generated demo track
    const musicPromise = Promise.resolve('/chamber/tracks/track-a.mp3')

    // Voice 04 then advance
    playVoice(VOICE_PATHS[3]) // "I felt that."
    setTimeout(() => {
      onNext({
        moment: { totalDownbeats: dbCount, avgGestureGain: avgGesture },
        musicPromise,
      })
    }, 1500)
  }, [avd, onNext])

  // rAF loop: read conducting data, build tactus, detect downbeats
  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      const engine = conductingRef.current
      if (engine && phase === 'playing' && startTimeRef.current) {
        const data = engine.getData()
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        const progress = clamp(elapsed / DURATION, 0, 1)

        // Sample gesture
        gestureSum.current += data.gestureGain
        sampleCount.current++

        // Build tactus line point
        const x = TACTUS_X_OFFSET + progress * TACTUS_WIDTH
        const y = TACTUS_Y + (data.gestureGain - 0.3) * 40 // gesture maps to vertical offset
        tactusPoints.current.push({ x, y })

        // Keep last 240 points (~8 seconds at 30fps)
        if (tactusPoints.current.length > 240) tactusPoints.current.shift()

        // Build SVG path from points
        if (tactusPoints.current.length > 1) {
          const pts = tactusPoints.current
          let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
          for (let i = 1; i < pts.length; i++) {
            d += ` L${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
          }
          setTactusPath(d)
        }

        // Downbeat detection
        if (data.downbeat.fired) {
          downbeatCount.current++
          setDownbeats(prev => [...prev, { x, y }])

          if (navigator.vibrate) navigator.vibrate(15)

          // Voice 03 on strong downbeat, max once per 8s
          if (data.downbeat.intensity > 0.7 && Date.now() - lastVoice03Time.current > 8000) {
            lastVoice03Time.current = Date.now()
            playVoice(VOICE_PATHS[2]) // "There."
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
  }, [phase])

  // Touch fallback: tap to register beats
  const handleTap = useCallback(() => {
    if (phase !== 'playing') return
    const engine = conductingRef.current
    if (engine) {
      // Simulate a touch-based downbeat
      engine.updateTouch(0.5, 0.5, true)
      setTimeout(() => engine.updateTouch(0.5, 0.5, false), 100)
    }
    if (navigator.vibrate) navigator.vibrate(5)
    audioEngine.playTapSound()
  }, [phase])

  return (
    <div
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      onClick={handleTap}
    >
      <Paper variant="dark">
        {/* Header */}
        <div style={{
          position: 'absolute', top: 32, left: 24,
          fontFamily: FONTS.serif, fontStyle: 'italic',
          fontSize: 11, color: COLORS.inkDarkSecondary,
        }}>
          v. moment
        </div>

        {/* SVG canvas for tactus and downbeats */}
        <svg viewBox="0 0 360 600" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {/* Tactus line */}
          {tactusPath && (
            <path
              d={tactusPath}
              stroke={COLORS.inkDark}
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.8"
            />
          )}

          {/* Downbeat dots */}
          {downbeats.map((db, i) => (
            <motion.circle
              key={i}
              cx={db.x}
              cy={db.y}
              r="3"
              fill={COLORS.scoreAmber}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            />
          ))}
        </svg>

        {/* Instruction during intro */}
        {phase === 'intro' && (
          <motion.div
            style={{
              position: 'absolute', bottom: '25%', left: 0, right: 0,
              textAlign: 'center',
              fontFamily: FONTS.serif, fontStyle: 'italic',
              fontSize: 14, color: COLORS.inkDarkSecondary,
            }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            listen...
          </motion.div>
        )}

        {/* Tap fallback hint when motion unavailable */}
        {phase === 'playing' && !motionAvailable && (
          <motion.div
            style={{
              position: 'absolute', bottom: '12%', left: 0, right: 0,
              textAlign: 'center',
              fontFamily: FONTS.serif, fontStyle: 'italic',
              fontSize: 13, color: COLORS.inkDarkSecondary,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 1 }}
          >
            tap to the beat
          </motion.div>
        )}
      </Paper>
    </div>
  )
}
