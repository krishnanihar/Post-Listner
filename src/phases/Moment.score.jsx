import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { audioEngine } from '../engine/audio'

// Crescendo triptych: three 12s movements rising in arousal, fixed
// low → mid → high order. After each: a yes/no "did that feel right?" probe.
// The arc itself is the climactic experience; the three reads give an
// archetype-zone hedonic map plus a clean A-axis preference.
//
// References for the redesign:
//   Belfi et al. 2022/2023 — short clips reliably predict full-song liking.
//   Janata et al. 2012 — graded liking probes; we use binary for simplicity.
//   Chmiel & Schubert 2017 — inverted-U; rising arc is felt as a single piece.
const MOVEMENTS = [
  { id: 'low',  path: '/moment/low.mp3',  romanLabel: 'i',   arousal: 0.20, name: 'the quiet one' },
  { id: 'mid',  path: '/moment/mid.mp3',  romanLabel: 'ii',  arousal: 0.50, name: 'the restless one' },
  { id: 'high', path: '/moment/high.mp3', romanLabel: 'iii', arousal: 0.80, name: 'the cinematic one' },
]

const PROBE_TIMEOUT_MS = 4000   // user has 4s to answer; after that, null

export default function Moment({ onNext, avd }) {
  const [stage, setStage] = useState('intro')        // 'intro' | 'playing' | 'probe' | 'done'
  const [movementIdx, setMovementIdx] = useState(0)
  const [responses, setResponses] = useState([])      // ['yes' | 'no' | null, ...]
  const [elapsed, setElapsed] = useState(0)           // 0..1 within current movement

  const audioRef = useRef(null)
  const probeTimerRef = useRef(null)
  const elapsedRafRef = useRef(null)
  const advancedRef = useRef(false)
  const respondedRef = useRef(false)                  // guards double-record per movement

  const finishPhase = useCallback((finalResponses) => {
    if (advancedRef.current) return
    advancedRef.current = true
    setStage('done')

    // A axis preference: average of the arousal values of the "yes" zones.
    // Defaults to neutral (0.5) when no zone got "yes".
    const yesArousals = finalResponses
      .map((r, i) => r === 'yes' ? MOVEMENTS[i].arousal : null)
      .filter(v => v !== null)
    const A = yesArousals.length > 0
      ? yesArousals.reduce((s, v) => s + v, 0) / yesArousals.length
      : 0.5

    // Hedonic for applyHedonicBias compat:
    // - high "no" + (low or mid "yes") → user explicitly rejected the peak
    //   in favor of something quieter → hedonic = false (push toward low-V
    //   archetypes, away from Sky-Seeker).
    // - high "yes" → enjoyed the peak → hedonic = true.
    // - everything else → null (don't bias).
    let hedonic
    if (finalResponses[2] === 'no' && (finalResponses[0] === 'yes' || finalResponses[1] === 'yes')) {
      hedonic = false
    } else if (finalResponses[2] === 'yes') {
      hedonic = true
    } else {
      hedonic = null
    }

    avd.setArousal(A)
    avd.setPhaseData('moment', {
      triptych: {
        low:  finalResponses[0] ?? null,
        mid:  finalResponses[1] ?? null,
        high: finalResponses[2] ?? null,
      },
      hedonic,
      derivedArousal: A,
    })

    setTimeout(() => {
      onNext({
        moment: {
          triptych: {
            low:  finalResponses[0] ?? null,
            mid:  finalResponses[1] ?? null,
            high: finalResponses[2] ?? null,
          },
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
      probeTimerRef.current = setTimeout(() => {
        if (respondedRef.current) return
        respondedRef.current = true
        recordResponse(null)
      }, PROBE_TIMEOUT_MS)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const recordResponse = useCallback((response) => {
    if (respondedRef.current && response !== null) return
    respondedRef.current = true
    clearTimeout(probeTimerRef.current)
    setResponses(prev => {
      const next = [...prev, response]
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
      clearTimeout(probeTimerRef.current)
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
            const response = responses[i]
            const isActive = i === movementIdx && (stage === 'playing' || stage === 'probe')
            const isComplete = i < responses.length

            // Mark style by state:
            //  - upcoming  (not yet played) — faint dotted line
            //  - active    — bright filled bar with playing animation
            //  - yes       — solid filled bar
            //  - no        — hollow bar
            //  - null      — faint dotted bar
            const opacity = isActive ? 1 : isComplete ? 0.85 : 0.25
            const fill = isComplete && response === 'yes'
              ? COLORS.inkCream
              : isActive
                ? COLORS.scoreAmber
                : 'transparent'
            const strokeColor = isComplete && response === 'no'
              ? COLORS.inkCream
              : COLORS.inkCreamSecondary

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
                  <rect
                    x="5" y="0"
                    width="4" height="92"
                    fill={fill}
                    stroke={strokeColor}
                    strokeWidth="1.2"
                    strokeDasharray={(!isComplete && !isActive) || response === null ? '3 3' : ''}
                  />
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
              <div style={{ display: 'flex', gap: 48 }}>
                <button
                  onClick={() => recordResponse('yes')}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${COLORS.inkCreamSecondary}`,
                    color: COLORS.inkCream,
                    fontFamily: FONTS.serif,
                    fontStyle: 'italic',
                    fontSize: 16,
                    padding: '10px 26px',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  yes
                </button>
                <button
                  onClick={() => recordResponse('no')}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${COLORS.inkCreamSecondary}`,
                    color: COLORS.inkCream,
                    fontFamily: FONTS.serif,
                    fontStyle: 'italic',
                    fontSize: 16,
                    padding: '10px 26px',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  no
                </button>
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
