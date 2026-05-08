import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { audioEngine } from '../engine/audio'
import { useAdmirer } from '../hooks/useAdmirer'

const HOLD_DURATION_MS = 6000   // hand-on-chest held tap
const EXHALE_DURATION_MS = 6000 // single guided exhale
const EXHALE_COUNT = 2

export default function Entry({ onNext }) {
  const [stage, setStage] = useState('headphones')
  const [name, setName] = useState('')
  const [holdProgress, setHoldProgress] = useState(0)
  const [exhaleIdx, setExhaleIdx] = useState(0)
  const [exhaleActive, setExhaleActive] = useState(false)

  const holdStartRef = useRef(null)
  const holdRafRef = useRef(null)
  const exhaleTimerRef = useRef(null)

  const admirer = useAdmirer()

  const beginAudio = useCallback(() => {
    audioEngine.init()
    audioEngine.resume()
  }, [])

  const handleHeadphonesTap = () => {
    if (stage !== 'headphones') return
    beginAudio()
    setStage('name')
  }

  const handleNameSubmit = () => {
    if (!name.trim()) return
    try {
      localStorage.setItem('postlistener_name', name.trim())
    } catch { /* storage unavailable */ }
    setStage('hold')
  }

  // Hand-on-chest held tap: 6s sustained press fills a ring.
  const handleHoldStart = () => {
    if (stage !== 'hold') return
    holdStartRef.current = Date.now()
    const tick = () => {
      const elapsed = Date.now() - (holdStartRef.current || Date.now())
      const p = Math.min(1, elapsed / HOLD_DURATION_MS)
      setHoldProgress(p)
      if (p >= 1) {
        holdStartRef.current = null
        setStage('breath')
        return
      }
      holdRafRef.current = requestAnimationFrame(tick)
    }
    holdRafRef.current = requestAnimationFrame(tick)
  }

  const handleHoldEnd = () => {
    if (holdStartRef.current && holdProgress < 1) {
      // Released too early — reset.
      holdStartRef.current = null
      setHoldProgress(0)
      if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current)
    }
  }

  // Two guided exhales at 6s each (resonance frequency ≈ 5–6 bpm).
  useEffect(() => {
    if (stage !== 'breath') return
    admirer.play('entry.breathe')
    const startExhale = (i) => {
      setExhaleIdx(i)
      setExhaleActive(true)
      exhaleTimerRef.current = setTimeout(() => {
        setExhaleActive(false)
        if (i + 1 < EXHALE_COUNT) {
          exhaleTimerRef.current = setTimeout(() => startExhale(i + 1), 1200)
        } else {
          exhaleTimerRef.current = setTimeout(() => setStage('threshold'), 1500)
        }
      }, EXHALE_DURATION_MS)
    }
    startExhale(0)
    return () => clearTimeout(exhaleTimerRef.current)
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Threshold statement voiced + button appears.
  useEffect(() => {
    if (stage !== 'threshold') return
    admirer.play('entry.threshold')
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () => {
    if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current)
    clearTimeout(exhaleTimerRef.current)
    onNext({ name: name.trim() })
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Paper variant="cream">
        <AnimatePresence mode="wait">
          {stage === 'headphones' && (
            <motion.div
              key="headphones"
              onClick={handleHeadphonesTap}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 32, cursor: 'pointer',
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke={COLORS.inkCreamSecondary} strokeWidth="1.2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
              <span style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 14, color: COLORS.inkCreamSecondary,
              }}>
                wear headphones
              </span>
              <motion.span
                style={{
                  fontFamily: FONTS.serif, fontStyle: 'italic',
                  fontSize: 14, color: COLORS.scoreAmber, marginTop: 24,
                }}
                animate={{ opacity: [0, 0.8, 0.5, 0.8] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                tap to begin
              </motion.span>
            </motion.div>
          )}

          {stage === 'name' && (
            <motion.div
              key="name"
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 28, padding: '0 32px',
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 18, color: COLORS.inkCream, textAlign: 'center',
              }}>
                what should i call you?
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit() }}
                placeholder="your name"
                autoFocus
                style={{
                  width: 220,
                  padding: '12px 16px',
                  border: `1px solid ${COLORS.inkCreamSecondary}`,
                  background: 'transparent',
                  color: COLORS.inkCream,
                  fontFamily: FONTS.serif,
                  fontSize: 16,
                  outline: 'none',
                  borderRadius: 4,
                  textAlign: 'center',
                }}
              />
              <button
                onClick={handleNameSubmit}
                disabled={!name.trim()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: name.trim() ? COLORS.scoreAmber : COLORS.inkCreamSecondary,
                  fontFamily: FONTS.serif, fontStyle: 'italic',
                  fontSize: 14,
                  cursor: name.trim() ? 'pointer' : 'default',
                }}
              >
                continue
              </button>
            </motion.div>
          )}

          {stage === 'hold' && (
            <motion.div
              key="hold"
              onPointerDown={handleHoldStart}
              onPointerUp={handleHoldEnd}
              onPointerCancel={handleHoldEnd}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 32, touchAction: 'none', cursor: 'pointer',
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 16, color: COLORS.inkCream, textAlign: 'center',
                padding: '0 40px', lineHeight: 1.6,
              }}>
                place a hand on your chest.<br />press here and hold.
              </div>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke={COLORS.inkCreamSecondary}
                        strokeWidth="2" strokeOpacity="0.3" />
                <motion.circle
                  cx="60" cy="60" r="50" fill="none" stroke={COLORS.scoreAmber}
                  strokeWidth="2" strokeDasharray={`${holdProgress * 314} 314`}
                  strokeDashoffset="0" transform="rotate(-90 60 60)"
                />
              </svg>
            </motion.div>
          )}

          {stage === 'breath' && (
            <motion.div
              key="breath"
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 24,
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                style={{
                  width: 140, height: 140, borderRadius: '50%',
                  border: `2px solid ${COLORS.scoreAmber}`,
                }}
                animate={exhaleActive ? { scale: [1, 0.5] } : { scale: 1 }}
                transition={{ duration: EXHALE_DURATION_MS / 1000, ease: 'easeInOut' }}
              />
              <div style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 14, color: COLORS.inkCreamSecondary,
              }}>
                {exhaleActive ? 'exhale' : 'rest'} · {exhaleIdx + 1} of {EXHALE_COUNT}
              </div>
            </motion.div>
          )}

          {stage === 'threshold' && (
            <motion.div
              key="threshold"
              onClick={advance}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 36, padding: '0 32px', cursor: 'pointer',
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 1.2 }}
            >
              <div style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 17, color: COLORS.inkCream, textAlign: 'center',
                lineHeight: 1.7, maxWidth: 320,
              }}>
                for the next sixteen minutes<br />you are not your inbox.
              </div>
              <motion.div
                style={{
                  fontFamily: FONTS.serif, fontStyle: 'italic',
                  fontSize: 14, color: COLORS.scoreAmber,
                }}
                animate={{ opacity: [0.4, 0.9, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              >
                begin
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Paper>
    </div>
  )
}
