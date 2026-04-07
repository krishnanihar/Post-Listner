import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  // Stage 1: headphones prompt → tap to begin
  // Stage 2: "PostListener" title reveal
  // Stage 3: voice + score intro → advance
  const [stage, setStage] = useState('headphones')
  const [lineDrawn, setLineDrawn] = useState(false)
  const [showLine1, setShowLine1] = useState(false)
  const [showLine2, setShowLine2] = useState(false)
  const [tapReady, setTapReady] = useState(false)
  const timersRef = useRef([])

  useEffect(() => {
    preloadVoices(VOICES)
    return () => timersRef.current.forEach(clearTimeout)
  }, [])

  const handleFirstTap = () => {
    if (stage !== 'headphones') return
    // Initialize audio on first user gesture — unlocks browser autoplay
    audioEngine.init()
    audioEngine.resume()
    setStage('title')

    // Show title for 2.5s, then enter voice flow
    const t1 = setTimeout(() => {
      setStage('voice')
      startVoiceFlow()
    }, 2500)
    timersRef.current.push(t1)
  }

  const startVoiceFlow = () => {
    const t = (ms, fn) => {
      const id = setTimeout(fn, ms)
      timersRef.current.push(id)
    }

    // Now audio context is unlocked — voices will play
    t(0, () => playVoice(VOICES[0]))        // "There you are."
    t(2500, () => setLineDrawn(true))
    t(3000, () => playVoice(VOICES[2]))      // "I am going to ask you to listen, and to lean."
    t(4500, () => setShowLine1(true))
    t(7000, () => playVoice(VOICES[3]))      // "Do not decide. Just lean."
    t(8500, () => setShowLine2(true))
    t(11000, () => setTapReady(true))
  }

  const handleAdvance = () => {
    if (!tapReady) return
    onNext()
  }

  return (
    <div
      onClick={stage === 'headphones' ? handleFirstTap : handleAdvance}
      style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
    >
      <Paper variant="cream">
        <AnimatePresence mode="wait">
          {/* Stage 1: Headphones prompt */}
          {stage === 'headphones' && (
            <motion.div
              key="headphones"
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 32,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Headphones icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke={COLORS.inkCreamSecondary} strokeWidth="1.2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
              <span style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 14, color: COLORS.inkCreamSecondary,
                letterSpacing: '0.03em',
              }}>
                wear headphones
              </span>
              <motion.span
                style={{
                  fontFamily: FONTS.serif, fontStyle: 'italic',
                  fontSize: 14, color: COLORS.scoreAmber,
                  marginTop: 24,
                }}
                animate={{ opacity: [0, 0.8, 0.5, 0.8] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                tap to begin
              </motion.span>
            </motion.div>
          )}

          {/* Stage 2: Title reveal */}
          {stage === 'title' && (
            <motion.div
              key="title"
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 style={{
                fontFamily: FONTS.serif,
                fontSize: 'clamp(32px, 9vw, 48px)',
                letterSpacing: '0.18em',
                color: COLORS.inkCream,
                textAlign: 'center',
                lineHeight: 1.2,
              }}>
                POST<br />LISTENER
              </h1>
              <p style={{
                fontFamily: FONTS.mono,
                fontSize: 10,
                color: COLORS.inkCreamSecondary,
                letterSpacing: '0.08em',
                marginTop: 16,
              }}>
                a musical identity instrument
              </p>
            </motion.div>
          )}

          {/* Stage 3: Voice + score intro */}
          {stage === 'voice' && (
            <motion.div
              key="voice"
              style={{ position: 'absolute', inset: 0 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
            >
              {/* Ink line */}
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

              {/* Text lines */}
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

              {/* Begin button */}
              {tapReady && (
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
            </motion.div>
          )}
        </AnimatePresence>
      </Paper>
    </div>
  )
}
