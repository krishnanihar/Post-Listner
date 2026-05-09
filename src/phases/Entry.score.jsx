import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { audioEngine } from '../engine/audio'
import { useAdmirer } from '../hooks/useAdmirer'

export default function Entry({ onNext }) {
  const [stage, setStage] = useState('headphones')
  const [name, setName] = useState('')

  const droneStopRef = useRef(null)

  const admirer = useAdmirer()

  const beginAudio = useCallback(() => {
    audioEngine.init()
    audioEngine.resume()
    // Phase 0 threshold drone — 60 Hz felt anchor under the entire rite.
    // Stops on advance() to leave Spectrum a clean palette.
    if (!droneStopRef.current) {
      droneStopRef.current = audioEngine.playDrone(60, 0.04)
    }
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
    setStage('threshold')
  }

  // Threshold statement voiced + button appears.
  useEffect(() => {
    if (stage !== 'threshold') return
    admirer.play('entry.threshold')
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Unmount cleanup — make sure the drone doesn't outlive the phase
  // (e.g., on deep-link skip or unexpected unmount).
  useEffect(() => {
    return () => {
      if (droneStopRef.current) {
        droneStopRef.current()
        droneStopRef.current = null
      }
    }
  }, [])

  const advance = () => {
    if (droneStopRef.current) {
      droneStopRef.current()
      droneStopRef.current = null
    }
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
