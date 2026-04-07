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

const DURATION = 30
const TACTUS_WIDTH = 320
const TACTUS_Y = 300
const TACTUS_X_OFFSET = 20

export default function Moment({ onNext, avd, inputMode }) {
  const [downbeats, setDownbeats] = useState([])
  const [tactusPath, setTactusPath] = useState('')
  const [phase, setPhase] = useState('intro') // intro, playing, done
  const [motionAvailable, setMotionAvailable] = useState(true)
  const [elapsed, setElapsed] = useState(0) // 0-1 progress

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

    // Voice intro then start
    const timers = []
    const t = (ms, fn) => timers.push(setTimeout(fn, ms))
    t(0, () => playVoice(VOICE_PATHS[0]))
    t(2000, () => playVoice(VOICE_PATHS[1]))
    t(4000, () => startPlaying())

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
    setTimeout(() => finishPhase(), DURATION * 1000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const finishPhase = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setPhase('done')

    const avgGesture = sampleCount.current > 0 ? gestureSum.current / sampleCount.current : 0
    const dbCount = downbeatCount.current
    const downbeatBonus = dbCount > 5 ? 0.2 : dbCount * 0.04
    const A = clamp(avgGesture + downbeatBonus, 0, 1)

    avd.setArousal(A)
    avd.setPhaseData('moment', {
      totalDownbeats: dbCount,
      avgGestureGain: Math.round(avgGesture * 100) / 100,
      tactus: tactusPoints.current.slice(),
    })

    const musicPromise = Promise.resolve('/chamber/tracks/track-a.mp3')

    playVoice(VOICE_PATHS[3])
    setTimeout(() => {
      onNext({
        moment: { totalDownbeats: dbCount, avgGestureGain: avgGesture },
        musicPromise,
      })
    }, 1500)
  }, [avd, onNext])

  // rAF loop
  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      const engine = conductingRef.current
      if (engine && phase === 'playing' && startTimeRef.current) {
        const data = engine.getData()
        const sec = (Date.now() - startTimeRef.current) / 1000
        const progress = clamp(sec / DURATION, 0, 1)
        setElapsed(progress)

        gestureSum.current += data.gestureGain
        sampleCount.current++

        const x = TACTUS_X_OFFSET + progress * TACTUS_WIDTH
        const y = TACTUS_Y + (data.gestureGain - 0.3) * 40
        tactusPoints.current.push({ x, y })

        if (tactusPoints.current.length > 240) tactusPoints.current.shift()

        if (tactusPoints.current.length > 1) {
          const pts = tactusPoints.current
          let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
          for (let i = 1; i < pts.length; i++) {
            d += ` L${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
          }
          setTactusPath(d)
        }

        if (data.downbeat.fired) {
          downbeatCount.current++
          setDownbeats(prev => [...prev, { x, y }])
          if (navigator.vibrate) navigator.vibrate(15)
          if (data.downbeat.intensity > 0.7 && Date.now() - lastVoice03Time.current > 8000) {
            lastVoice03Time.current = Date.now()
            playVoice(VOICE_PATHS[2])
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

  // Touch fallback: tap for beats
  const handleTap = useCallback(() => {
    if (phase !== 'playing') return
    const engine = conductingRef.current
    if (engine) {
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

        {/* Progress — thin amber line at top */}
        {phase === 'playing' && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${elapsed * 100}%`,
            height: 1,
            background: COLORS.scoreAmber,
            opacity: 0.4,
          }} />
        )}

        {/* SVG canvas */}
        <svg viewBox="0 0 360 600" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
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

        {/* Intro — explain what happens */}
        {phase === 'intro' && (
          <div style={{
            position: 'absolute',
            top: '38%',
            left: 24,
            right: 24,
            textAlign: 'center',
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            color: COLORS.inkDarkSecondary,
            lineHeight: 2.2,
          }}>
            <motion.div
              style={{ fontSize: 16, color: COLORS.inkDark }}
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              a track will play
            </motion.div>
            <motion.div
              style={{ fontSize: 13 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 1 }}
            >
              {motionAvailable
                ? 'move the phone to conduct it'
                : 'tap the screen to the beat'}
            </motion.div>
          </div>
        )}

        {/* During play — subtle instruction if no gesture detected yet */}
        {phase === 'playing' && downbeats.length === 0 && elapsed > 0.1 && (
          <motion.div
            style={{
              position: 'absolute',
              bottom: '12%',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 13,
              color: COLORS.inkDarkSecondary,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 2 }}
          >
            {motionAvailable ? 'move your hand' : 'tap to the beat'}
          </motion.div>
        )}
      </Paper>
    </div>
  )
}
