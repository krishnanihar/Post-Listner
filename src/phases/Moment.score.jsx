import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { audioEngine } from '../engine/audio'
import ConductingEngine from '../orchestra/ConductingEngine'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { clamp } from '../chamber/utils/math'

const DURATION = 30

// Drawing area — spans most of the screen width and centered vertically
const SVG_W = 360
const SVG_H = 700
const DRAW_LEFT = 20
const DRAW_RIGHT = 340
const DRAW_WIDTH = DRAW_RIGHT - DRAW_LEFT
const DRAW_CENTER_Y = 350    // vertical center of the drawing area
const DRAW_AMPLITUDE = 80    // max vertical displacement from gesture
const STAVE_TOP = 240        // top stave position
const STAVE_BOTTOM = 460     // bottom stave position
const STAVE_COUNT = 5        // 5 stave lines spanning the drawing area

export default function Moment({ onNext, avd, inputMode }) {
  const [downbeats, setDownbeats] = useState([])
  const [tactusPath, setTactusPath] = useState('')
  const [phase, setPhase] = useState('intro')
  const [motionAvailable, setMotionAvailable] = useState(true)
  const motionRef = useRef(true)
  const [elapsed, setElapsed] = useState(0)
  const [gestureIntensity, setGestureIntensity] = useState(0) // 0-1 for visual feedback

  const conductingRef = useRef(null)
  const rafRef = useRef(null)
  const trackRef = useRef(null)
  const startTimeRef = useRef(null)
  const gestureSum = useRef(0)
  const sampleCount = useRef(0)
  const downbeatCount = useRef(0)
  const tactusPoints = useRef([])
  const finishedRef = useRef(false)
  const [hurleyVisible, setHurleyVisible] = useState(false)
  const hurleyTimeoutRef = useRef(null)
  const hedonicRef = useRef(null)
  const finishPhaseRef = useRef(null)

  useEffect(() => {
    audioEngine.stopAll()

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

    const timers = []
    const t = (ms, fn) => timers.push(setTimeout(fn, ms))
    t(800, () => startPlaying())

    return () => {
      engine.stop()
      timers.forEach(clearTimeout)
      if (trackRef.current) trackRef.current.stop()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      clearTimeout(hurleyTimeoutRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startPlaying = useCallback(() => {
    setPhase('playing')
    startTimeRef.current = Date.now()
    trackRef.current = audioEngine.playBuildAndDrop(DURATION)
    setTimeout(() => finishPhaseRef.current?.(), DURATION * 1000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const completeAndAdvance = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true

    const avgGesture = sampleCount.current > 0 ? gestureSum.current / sampleCount.current : 0
    const dbCount = downbeatCount.current
    const downbeatBonus = dbCount > 5 ? 0.2 : dbCount * 0.04
    const A = clamp(avgGesture + downbeatBonus, 0, 1)

    avd.setArousal(A)
    avd.setPhaseData('moment', {
      totalDownbeats: dbCount,
      avgGestureGain: Math.round(avgGesture * 100) / 100,
      tactus: tactusPoints.current.slice(),
      hedonic: hedonicRef.current,
    })

    // Static-track fallback. The per-session compose request runs after
    // Autobio (where eraMedian is finally populated) and overwrites this
    // via App.jsx's musicPromiseRef. If Autobio is skipped or fails, this
    // fallback ensures Reveal still has a track to play.
    const musicPromise = Promise.resolve('/chamber/tracks/track-a.mp3')

    setTimeout(() => {
      onNext({
        moment: { totalDownbeats: dbCount, avgGestureGain: avgGesture, hedonic: hedonicRef.current },
        musicPromise,
      })
    }, 1500)
  }, [avd, onNext])

  const handleHurleyAnswer = useCallback((liked) => {
    hedonicRef.current = liked
    clearTimeout(hurleyTimeoutRef.current)
    setHurleyVisible(false)
    completeAndAdvance()
  }, [completeAndAdvance])

  const finishPhase = useCallback(() => {
    setPhase('done')
    setHurleyVisible(true)
    // Auto-advance with hedonic = null after 4s
    hurleyTimeoutRef.current = setTimeout(() => {
      setHurleyVisible(false)
      completeAndAdvance()
    }, 4000)
  }, [completeAndAdvance])
  finishPhaseRef.current = finishPhase

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

        const gain = data.gestureGain
        gestureSum.current += gain
        sampleCount.current++
        setGestureIntensity(gain)

        // X: left to right across the full drawing width
        const x = DRAW_LEFT + progress * DRAW_WIDTH
        // Y: gesture maps to vertical displacement — bigger gesture = bigger wave
        const y = DRAW_CENTER_Y + (gain - 0.3) * DRAW_AMPLITUDE * 2
        tactusPoints.current.push({ x, y })

        // Keep ALL points (don't shift) — the full line is the score
        // But limit to prevent memory issues
        if (tactusPoints.current.length > 2000) {
          // Downsample: keep every other point from the first half
          const half = Math.floor(tactusPoints.current.length / 2)
          const thinned = []
          for (let i = 0; i < half; i += 2) thinned.push(tactusPoints.current[i])
          thinned.push(...tactusPoints.current.slice(half))
          tactusPoints.current = thinned
        }

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

  // Stave lines spanning the drawing area
  const staveSpacing = (STAVE_BOTTOM - STAVE_TOP) / (STAVE_COUNT - 1)

  // Line thickness responds to gesture intensity
  const lineWidth = 1.5 + gestureIntensity * 2.5 // 1.5 to 4
  const lineOpacity = 0.5 + gestureIntensity * 0.5 // 0.5 to 1.0

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

        {/* Progress bar — 2px amber, more visible */}
        {phase === 'playing' && (
          <div style={{
            position: 'absolute',
            top: 52,
            left: 24,
            right: 24,
            height: 1,
            background: COLORS.inkDarkSecondary,
            opacity: 0.2,
          }}>
            <div style={{
              height: '100%',
              width: `${elapsed * 100}%`,
              background: COLORS.scoreAmber,
              opacity: 0.6,
              transition: 'width 0.3s linear',
            }} />
          </div>
        )}

        {/* SVG canvas */}
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {/* Stave lines — faint horizontal guides across drawing area */}
          {Array.from({ length: STAVE_COUNT }, (_, i) => (
            <line
              key={i}
              x1={DRAW_LEFT}
              y1={STAVE_TOP + i * staveSpacing}
              x2={DRAW_RIGHT}
              y2={STAVE_TOP + i * staveSpacing}
              stroke={COLORS.inkDarkSecondary}
              strokeWidth="0.3"
              opacity="0.25"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Tactus line — the live drawing */}
          {tactusPath && (
            <path
              d={tactusPath}
              stroke={COLORS.inkDark}
              strokeWidth={lineWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity={lineOpacity}
            />
          )}

          {/* Downbeat dots — bigger and more visible */}
          {downbeats.map((db, i) => (
            <motion.circle
              key={i}
              cx={db.x}
              cy={db.y}
              r="5"
              fill={COLORS.scoreAmber}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.9, scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          ))}

          {/* Leading point — amber dot at the drawing edge */}
          {phase === 'playing' && tactusPoints.current.length > 0 && (
            <circle
              cx={DRAW_LEFT + elapsed * DRAW_WIDTH}
              cy={DRAW_CENTER_Y + (gestureIntensity - 0.3) * DRAW_AMPLITUDE * 2}
              r="4"
              fill={COLORS.scoreAmber}
              opacity="0.7"
            />
          )}
        </svg>

        {/* Intro text */}
        {phase === 'intro' && (
          <div style={{
            position: 'absolute',
            top: '38%',
            left: 24, right: 24,
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

        {/* Persistent hint during play — fades when gesture detected */}
        {phase === 'playing' && (
          <motion.div
            style={{
              position: 'absolute',
              bottom: '10%',
              left: 0, right: 0,
              textAlign: 'center',
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 12,
              color: COLORS.inkDarkSecondary,
            }}
            animate={{ opacity: gestureIntensity > 0.15 ? 0 : 0.4 }}
            transition={{ duration: 0.5 }}
          >
            {motionAvailable ? 'move your hand' : 'tap to the beat'}
          </motion.div>
        )}
        {hurleyVisible && (
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: COLORS.paperDark,
              gap: 24,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 22,
              color: COLORS.inkDark,
              textAlign: 'center',
              padding: '0 32px',
            }}>
              did that feel good?
            </div>
            <div style={{ display: 'flex', gap: 32 }}>
              <button
                onClick={() => handleHurleyAnswer(true)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${COLORS.inkDarkSecondary}`,
                  color: COLORS.inkDark,
                  padding: '12px 32px',
                  fontFamily: FONTS.serif,
                  fontStyle: 'italic',
                  fontSize: 16,
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                yes
              </button>
              <button
                onClick={() => handleHurleyAnswer(false)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${COLORS.inkDarkSecondary}`,
                  color: COLORS.inkDarkSecondary,
                  padding: '12px 32px',
                  fontFamily: FONTS.serif,
                  fontStyle: 'italic',
                  fontSize: 16,
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                no
              </button>
            </div>
          </motion.div>
        )}
      </Paper>
    </div>
  )
}
