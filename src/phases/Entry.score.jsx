import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { playVoice, preloadVoices } from '../score/voice'
import { audioEngine } from '../engine/audio'

const VOICES = [
  '/chamber/voices/score/entry-01.mp3',
  '/chamber/voices/score/entry-02.mp3',
  '/chamber/voices/score/entry-03.mp3',
  '/chamber/voices/score/entry-04.mp3',
]

export default function Entry({ onNext }) {
  const [tapEnabled, setTapEnabled] = useState(false)
  const [lineDrawn, setLineDrawn] = useState(false)
  const [showLine1, setShowLine1] = useState(false)
  const [showLine2, setShowLine2] = useState(false)

  useEffect(() => {
    preloadVoices(VOICES)

    let timers = []
    const t = (ms, fn) => timers.push(setTimeout(fn, ms))

    // "There you are." — warm welcome, nothing else
    t(0, () => playVoice(VOICES[0]))
    t(2500, () => setLineDrawn(true))

    // "I am going to ask you to listen, and to lean."
    t(3000, () => playVoice(VOICES[2]))
    t(4500, () => setShowLine1(true))

    // "Do not decide. Just lean."
    t(7000, () => playVoice(VOICES[3]))
    t(8500, () => setShowLine2(true))

    t(11000, () => setTapEnabled(true))

    return () => timers.forEach(clearTimeout)
  }, [])

  const handleTap = () => {
    if (!tapEnabled) return
    audioEngine.init()
    audioEngine.resume()
    onNext()
  }

  return (
    <div onClick={handleTap} style={{ position: 'absolute', inset: 0, cursor: tapEnabled ? 'pointer' : 'default' }}>
      <Paper variant="cream">
        {/* Ink line drawing itself */}
        <svg viewBox="0 0 360 600" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <motion.path
            d="M120 280 Q170 250 220 270 Q260 286 280 260"
            stroke={COLORS.inkCream}
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: lineDrawn ? 1 : 0 }}
            transition={{ duration: 4, ease: 'easeInOut' }}
          />
          {lineDrawn && (
            <motion.circle
              cx="280" cy="260" r="2.5"
              fill={COLORS.inkCream}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 4 }}
            />
          )}
        </svg>

        {/* Two lines of text that build the invitation */}
        <div style={{
          position: 'absolute', bottom: '32%', left: 24, right: 24,
          textAlign: 'center',
          fontFamily: FONTS.serif, fontStyle: 'italic',
          fontSize: 17, color: COLORS.inkCream, lineHeight: 2,
        }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showLine1 ? 0.9 : 0 }}
            transition={{ duration: 1.5 }}
          >
            listen, and lean
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showLine2 ? 0.6 : 0 }}
            transition={{ duration: 1.5 }}
            style={{ fontSize: 14, color: COLORS.inkCreamSecondary }}
          >
            do not decide
          </motion.div>
        </div>

        {/* Begin */}
        {tapEnabled && (
          <motion.div
            style={{
              position: 'absolute', bottom: '15%', left: 0, right: 0,
              textAlign: 'center',
              fontFamily: FONTS.serif, fontStyle: 'italic',
              fontSize: 14, color: COLORS.scoreAmber,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0.5, 0.8] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            begin
          </motion.div>
        )}
      </Paper>
    </div>
  )
}
