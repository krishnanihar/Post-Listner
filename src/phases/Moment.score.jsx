import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { audioEngine } from '../engine/audio'

// Crescendo triptych: three 12s movements rising in arousal, fixed
// low → mid → high order. After each: a 1-5 rating probe. The arc
// itself is the climactic experience; the three reads give an
// archetype-zone hedonic map plus a clean A-axis preference.
//
// References for the redesign:
//   Belfi et al. 2022/2023 — short clips reliably predict full-song liking.
//   Janata et al. 2012 — graded (Likert) liking probes outperform binary.
//   Chmiel & Schubert 2017 — inverted-U; rising arc is felt as a single piece.
const MOVEMENTS = [
  { id: 'low',  path: '/moment/low.mp3',  romanLabel: 'i',   arousal: 0.20, name: 'the quiet one' },
  { id: 'mid',  path: '/moment/mid.mp3',  romanLabel: 'ii',  arousal: 0.50, name: 'the restless one' },
  { id: 'high', path: '/moment/high.mp3', romanLabel: 'iii', arousal: 0.80, name: 'the cinematic one' },
]

export default function Moment({ onNext, avd }) {
  const [stage, setStage] = useState('intro')        // 'intro' | 'playing' | 'probe' | 'done'
  const [movementIdx, setMovementIdx] = useState(0)
  const [responses, setResponses] = useState([])      // [rating 1-5, ...]
  const [elapsed, setElapsed] = useState(0)           // 0..1 within current movement

  const audioRef = useRef(null)
  const elapsedRafRef = useRef(null)
  const advancedRef = useRef(false)
  const respondedRef = useRef(false)                  // guards double-record per movement

  const finishPhase = useCallback((finalResponses) => {
    if (advancedRef.current) return
    advancedRef.current = true
    setStage('done')

    // A axis preference: weighted average of arousal levels by their rating.
    // Ratings above 3 (neutral) pull toward that arousal level; below 3 push
    // away. Defaults to 0.5 when ratings are flat/all neutral.
    let weightedSum = 0
    let totalWeight = 0
    finalResponses.forEach((rating, i) => {
      if (rating == null) return
      const weight = (rating - 3) / 2   // -1 .. +1
      if (weight > 0) {
        weightedSum += MOVEMENTS[i].arousal * weight
        totalWeight += weight
      }
    })
    const A = totalWeight > 0 ? weightedSum / totalWeight : 0.5

    // Hedonic for applyHedonicBias compat:
    // - high rating ≤2 + (low or mid rating ≥4) → rejected the peak in favor
    //   of something quieter → hedonic = false (push toward low-V archetypes).
    // - high rating ≥4 → enjoyed the peak → hedonic = true.
    // - everything else → null.
    const lowR  = finalResponses[0]
    const midR  = finalResponses[1]
    const highR = finalResponses[2]
    let hedonic
    if (highR != null && highR <= 2 && ((lowR != null && lowR >= 4) || (midR != null && midR >= 4))) {
      hedonic = false
    } else if (highR != null && highR >= 4) {
      hedonic = true
    } else {
      hedonic = null
    }

    avd.setArousal(A)
    avd.setPhaseData('moment', {
      triptych: {
        low:  lowR  ?? null,
        mid:  midR  ?? null,
        high: highR ?? null,
      },
      hedonic,
      derivedArousal: A,
    })

    setTimeout(() => {
      onNext({
        moment: {
          triptych: { low: lowR ?? null, mid: midR ?? null, high: highR ?? null },
          hedonic,
        },
      })
    }, 1500)
  }, [avd, onNext])

  const playMovement = useCallback((idx) => {
    if (idx >= MOVEMENTS.length) return
    setMovementIdx(idx)
    setStage('playing')
    setElapsed(0)
    respondedRef.current = false

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    const audio = new Audio(MOVEMENTS[idx].path)
    audioRef.current = audio
    const startTime = Date.now()
    const tick = () => {
      if (!audioRef.current) return
      const dur = (audio.duration && isFinite(audio.duration)) ? audio.duration * 1000 : 12000
      setElapsed(Math.min(1, (Date.now() - startTime) / dur))
      elapsedRafRef.current = requestAnimationFrame(tick)
    }
    elapsedRafRef.current = requestAnimationFrame(tick)

    audio.play().catch(() => { /* autoplay blocked: probe will still work */ })
    audio.onended = () => {
      cancelAnimationFrame(elapsedRafRef.current)
      setElapsed(1)
      setStage('probe')
      // No auto-advance. The probe waits indefinitely until the user rates.
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const recordResponse = useCallback((rating) => {
    if (respondedRef.current) return
    respondedRef.current = true
    setResponses(prev => {
      const next = [...prev, rating]
      if (next.length >= MOVEMENTS.length) {
        finishPhase(next)
      } else {
        // Brief breath, then play the next movement.
        setTimeout(() => playMovement(next.length), 600)
      }
      return next
    })
  }, [finishPhase, playMovement])

  useEffect(() => {
    audioEngine.stopAll()
    const t = setTimeout(() => playMovement(0), 800)
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(elapsedRafRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const currentMovement = MOVEMENTS[movementIdx]

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Paper variant="cream">
        {/* Page label */}
        <div style={{
          position: 'absolute',
          top: 32,
          left: 24,
          right: 24,
          fontFamily: FONTS.mono,
          fontSize: 10,
          color: COLORS.inkCreamSecondary,
          letterSpacing: '0.18em',
          opacity: 0.6,
        }}>
          iv. moment
        </div>

        {/* Three vertical marks — one per movement. Active one glows. */}
        <div style={{
          position: 'absolute',
          top: '38%',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 56,
        }}>
          {MOVEMENTS.map((m, i) => {
            const rating = responses[i]                         // 1..5 if rated
            const isActive = i === movementIdx && (stage === 'playing' || stage === 'probe')
            const isComplete = i < responses.length

            // Mark style: bar height shows the rating (rating/5 of full),
            // filled in inkCream. Upcoming = faint dotted outline. Active
            // playing = amber progress overlay growing from the bottom.
            const opacity = isActive ? 1 : isComplete ? 0.95 : 0.25
            const filledHeight = isComplete && rating != null
              ? (rating / 5) * 92
              : 0

            return (
              <motion.div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 14,
                  opacity,
                }}
                animate={{ opacity }}
                transition={{ duration: 0.4 }}
              >
                {/* Roman numeral */}
                <div style={{
                  fontFamily: FONTS.serif,
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: COLORS.inkCreamSecondary,
                }}>
                  {m.romanLabel}.
                </div>

                {/* Vertical mark */}
                <svg width="14" height="92">
                  {/* Outline frame — always visible */}
                  <rect
                    x="5" y="0"
                    width="4" height="92"
                    fill="transparent"
                    stroke={COLORS.inkCreamSecondary}
                    strokeWidth="1.2"
                    strokeDasharray={!isComplete && !isActive ? '3 3' : ''}
                  />
                  {/* Rated fill — height proportional to rating */}
                  {isComplete && rating != null && (
                    <rect
                      x="5"
                      y={92 - filledHeight}
                      width="4"
                      height={filledHeight}
                      fill={COLORS.inkCream}
                    />
                  )}
                  {/* Active progress overlay */}
                  {isActive && stage === 'playing' && (
                    <rect
                      x="5"
                      y={92 - elapsed * 92}
                      width="4"
                      height={elapsed * 92}
                      fill={COLORS.scoreAmber}
                    />
                  )}
                </svg>

                {/* Rating numeral below the mark, after rating */}
                {isComplete && rating != null && (
                  <div style={{
                    fontFamily: FONTS.serif,
                    fontStyle: 'italic',
                    fontSize: 11,
                    color: COLORS.inkCreamSecondary,
                  }}>
                    {rating}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Probe: yes / no buttons */}
        <AnimatePresence mode="wait">
          {stage === 'probe' && currentMovement && (
            <motion.div
              key={`probe-${movementIdx}`}
              style={{
                position: 'absolute',
                bottom: '18%',
                left: 0,
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 28,
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div style={{
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: 16,
                color: COLORS.inkCream,
                textAlign: 'center',
              }}>
                did that feel right?
              </div>

              {/* 5-point rating dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    onClick={() => recordResponse(rating)}
                    onMouseDown={(e) => e.preventDefault()}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'transparent',
                      border: `1px solid ${COLORS.inkCreamSecondary}`,
                      color: COLORS.inkCream,
                      fontFamily: FONTS.serif,
                      fontStyle: 'italic',
                      fontSize: 14,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.scoreAmber + '40' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {rating}
                  </button>
                ))}
              </div>

              {/* Scale labels */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: 240,
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: 11,
                color: COLORS.inkCreamSecondary,
                marginTop: -12,
              }}>
                <span>not at all</span>
                <span>completely</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Listening hint while playing */}
        {stage === 'playing' && (
          <motion.div
            style={{
              position: 'absolute',
              bottom: '20%',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 13,
              color: COLORS.inkCreamSecondary,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            transition={{ duration: 0.6 }}
          >
            listen
          </motion.div>
        )}
      </Paper>
    </div>
  )
}
