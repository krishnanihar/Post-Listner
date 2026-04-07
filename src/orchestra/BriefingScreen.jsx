import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import Stave from '../score/Stave'
import { Linea, Vox, Tremolo, Tactus } from '../score/marks'
import { COLORS, FONTS } from '../score/tokens'
import { playVoice } from '../score/voice'
import { avdEngine } from '../engine/avd'

export default function BriefingScreen({ onComplete }) {
  const [blackOverlay, setBlackOverlay] = useState(0) // 0 to 1
  const [showDarkScore, setShowDarkScore] = useState(false)
  const completedRef = useRef(false)

  const phaseData = avdEngine.getPhaseData()
  const avdValues = avdEngine.getAVD()

  useEffect(() => {
    const timers = []
    const t = (ms, fn) => timers.push(setTimeout(fn, ms))

    // t=0.5: bridge voice from existing assets
    t(500, () => playVoice('/chamber/voices/admirer-warm-01.mp3'))

    // t=4: begin darkening — opacity 0 → 0.4 over 1.5s
    t(4000, () => setBlackOverlay(0.4))

    // t=6: opacity 0.4 → 0.85 over 2s
    t(6000, () => setBlackOverlay(0.85))

    // t=9: opacity → 1.0 over 1s
    t(9000, () => setBlackOverlay(1))

    // t=11: 2 seconds of pure black (already at 1.0)

    // t=13: show dark version of score
    t(13000, () => setShowDarkScore(true))

    // t=18: complete
    t(18000, () => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    })

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  // Build spectrum marks
  const spectrumMarks = (phaseData.spectrum?.pairs || []).map((p, i) => ({
    x: 20 + i * 38 + 19,
    dip: p.choice === 'left' ? 'left' : 'right',
  }))

  const depthLayers = phaseData.depth?.finalLayer || 0

  const renderScore = (variant) => {
    const ink = variant === 'cream' ? COLORS.inkCream : COLORS.inkDark
    const inkSec = variant === 'cream' ? COLORS.inkCreamSecondary : COLORS.inkDarkSecondary

    return (
      <svg viewBox="0 0 360 600" preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* Spectrum stave */}
        <Stave width={310} y={90} color={ink} />
        <text x="5" y={84} fill={inkSec} fontSize="8" fontFamily={FONTS.serif} fontStyle="italic">spectrum</text>
        {spectrumMarks.map((m, i) => (
          <g key={i} transform={`translate(${m.x}, 96)`}>
            <Linea size={30} dip={m.dip} color={ink} />
          </g>
        ))}

        {/* Depth stave */}
        <Stave width={310} y={180} color={ink} />
        <text x="5" y={174} fill={inkSec} fontSize="8" fontFamily={FONTS.serif} fontStyle="italic">depth</text>
        {Array.from({ length: depthLayers }, (_, i) => (
          <g key={i} transform={`translate(${30 + i * 20}, 182)`}>
            <Vox size={10} color={ink} />
          </g>
        ))}

        {/* Textures stave */}
        <Stave width={310} y={270} color={ink} />
        <text x="5" y={264} fill={inkSec} fontSize="8" fontFamily={FONTS.serif} fontStyle="italic">textures</text>

        {/* Moment stave */}
        <Stave width={310} y={360} color={ink} />
        <text x="5" y={354} fill={inkSec} fontSize="8" fontFamily={FONTS.serif} fontStyle="italic">moment</text>
        <g transform="translate(20, 366)">
          <Tactus width={290} color={ink} amplitude={4} frequency={3 + avdValues.a * 4} />
        </g>
      </svg>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Cream paper with score — visible under the overlay */}
      <Paper variant="cream">
        {/* Page header */}
        <div style={{
          position: 'absolute', top: 32, left: 24, right: 24,
          display: 'flex', justifyContent: 'space-between',
          fontSize: 11, color: COLORS.inkCreamSecondary,
          fontFamily: FONTS.serif, fontStyle: 'italic',
        }}>
          <span>vi. reveal</span>
        </div>
        <div style={{ position: 'absolute', top: 50, left: 24, right: 24, height: 0.5, background: COLORS.inkCreamSecondary, opacity: 0.5 }} />
        {renderScore('cream')}
      </Paper>

      {/* Black overlay — the inversion */}
      <motion.div
        style={{
          position: 'absolute', inset: 0,
          background: COLORS.paperPureBlack,
          pointerEvents: 'none',
        }}
        animate={{ opacity: blackOverlay }}
        transition={{
          duration: blackOverlay <= 0.4 ? 1.5 : blackOverlay <= 0.85 ? 2 : 1,
          ease: 'easeIn',
        }}
      />

      {/* Dark score — fades in after pure black moment */}
      {showDarkScore && (
        <motion.div
          style={{ position: 'absolute', inset: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 3 }}
        >
          <Paper variant="dark">
            <div style={{
              position: 'absolute', top: 32, left: 24, right: 24,
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11, color: COLORS.inkDarkSecondary,
              fontFamily: FONTS.serif, fontStyle: 'italic',
            }}>
              <span>vi. reveal</span>
            </div>
            <div style={{ position: 'absolute', top: 50, left: 24, right: 24, height: 0.5, background: COLORS.inkDarkSecondary, opacity: 0.5 }} />
            {renderScore('dark')}
          </Paper>
        </motion.div>
      )}
    </div>
  )
}
