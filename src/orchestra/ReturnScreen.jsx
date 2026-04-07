import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import Stave from '../score/Stave'
import { Linea, Vox, Tactus, Tremolo, Pneuma, Ponticello, Legno, Fermata, Marcato, Caesura, Downbeat, Volta } from '../score/marks'
import { COLORS, FONTS } from '../score/tokens'
import { playVoice, preloadVoices } from '../score/voice'
import { getCollective, addEntry } from '../chamber/data/CollectiveStore.js'

const VOICE_PATHS = [
  '/chamber/voices/score/return-01.mp3',
  '/chamber/voices/score/return-02.mp3',
  '/chamber/voices/score/return-03.mp3',
  '/chamber/voices/score/return-04.mp3',
]

// 9 hand-curated mini-scores for the wall
const WALL_SCORES = [
  { marks: [{ type: Linea, x: 10, y: 8, props: { size: 20, dip: 'left' } }, { type: Vox, x: 40, y: 6, props: { size: 8 } }] },
  { marks: [{ type: Tremolo, x: 8, y: 8, props: { size: 8 } }, { type: Fermata, x: 35, y: 10, props: { size: 8 } }] },
  { marks: [{ type: Pneuma, x: 12, y: 6, props: { size: 10 } }, { type: Downbeat, x: 38, y: 12, props: { size: 4 } }] },
  { marks: [{ type: Marcato, x: 15, y: 8, props: { size: 8 } }, { type: Linea, x: 35, y: 10, props: { size: 18, dip: 'right' } }] },
  { marks: [{ type: Caesura, x: 10, y: 10, props: { size: 8 } }, { type: Volta, x: 35, y: 8, props: { size: 8 } }] },
  { marks: [{ type: Ponticello, x: 14, y: 10, props: { size: 8 } }, { type: Tremolo, x: 38, y: 8, props: { size: 8 } }] },
  { marks: [{ type: Legno, x: 10, y: 8, props: { size: 8 } }, { type: Vox, x: 36, y: 6, props: { size: 8 } }] },
  { marks: [{ type: Fermata, x: 12, y: 10, props: { size: 8 } }, { type: Linea, x: 30, y: 8, props: { size: 22, dip: 'left' } }] },
  { marks: [{ type: Downbeat, x: 14, y: 12, props: { size: 4 } }, { type: Pneuma, x: 34, y: 8, props: { size: 10 } }] },
]

export default function ReturnScreen({ avd, onReturn }) {
  const [showScore, setShowScore] = useState(false)
  const [showWall, setShowWall] = useState(false)
  const [showText, setShowText] = useState(false)
  const [showButton, setShowButton] = useState(false)
  const addedRef = useRef(false)

  const phaseData = avd.getPhaseData()
  const avdValues = avd.getAVD()

  // Add to collective store
  useEffect(() => {
    if (!addedRef.current) {
      addedRef.current = true
      addEntry({ arousal: avdValues.a, valence: avdValues.v, depth: avdValues.d })
    }
  }, [avdValues])

  const collective = getCollective()
  const count = collective?.count || 0

  useEffect(() => {
    preloadVoices(VOICE_PATHS)

    const timers = []
    const t = (ms, fn) => timers.push(setTimeout(fn, ms))

    t(2000, () => setShowScore(true))
    t(5000, () => playVoice(VOICE_PATHS[0]))   // "There were others before you tonight."
    t(8000, () => playVoice(VOICE_PATHS[1]))   // "Look."
    t(10000, () => setShowWall(true))
    t(15000, () => {
      playVoice(VOICE_PATHS[2])                // "You were always part of this."
      setShowText(true)
    })
    t(20000, () => playVoice(VOICE_PATHS[3]))  // "Thank you for letting me listen."
    t(24000, () => setShowButton(true))

    return () => timers.forEach(clearTimeout)
  }, [])

  // Build spectrum marks for user's score
  const spectrumMarks = (phaseData.spectrum?.pairs || []).map((p, i) => ({
    x: 8 + i * 16 + 8,
    dip: p.choice === 'left' ? 'left' : 'right',
  }))
  const depthLayers = phaseData.depth?.finalLayer || 0

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Paper variant="pure-black">
        {/* User's score — left side */}
        {showScore && (
          <motion.div
            style={{
              position: 'absolute',
              top: 40,
              left: 12,
              width: '52%',
              height: 'calc(100% - 120px)',
              border: `1px solid ${COLORS.scoreAmber}`,
              borderRadius: 2,
              opacity: 0.9,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            transition={{ duration: 2 }}
          >
            <svg viewBox="0 0 180 400" preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', height: '100%' }}>
              {/* Mini staves */}
              <Stave width={160} y={40} color={COLORS.inkDark} strokeWidth={0.3} lineSpacing={3} />
              {spectrumMarks.map((m, i) => (
                <g key={i} transform={`translate(${m.x}, 44)`}>
                  <Linea size={14} dip={m.dip} color={COLORS.inkDark} />
                </g>
              ))}

              <Stave width={160} y={100} color={COLORS.inkDark} strokeWidth={0.3} lineSpacing={3} />
              {Array.from({ length: depthLayers }, (_, i) => (
                <g key={i} transform={`translate(${15 + i * 12}, 102)`}>
                  <Vox size={8} color={COLORS.inkDark} />
                </g>
              ))}

              <Stave width={160} y={160} color={COLORS.inkDark} strokeWidth={0.3} lineSpacing={3} />

              <Stave width={160} y={220} color={COLORS.inkDark} strokeWidth={0.3} lineSpacing={3} />
              <g transform="translate(10, 224)">
                <Tactus width={150} color={COLORS.inkDark} amplitude={3} frequency={3 + avdValues.a * 4} />
              </g>
            </svg>

            {/* Score number */}
            {count >= 5 && (
              <div style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                right: 8,
                fontSize: 7,
                fontFamily: FONTS.mono,
                color: COLORS.inkDarkSecondary,
              }}>
                no. {count.toLocaleString()} of {(count * 2.3 | 0).toLocaleString()} — postlistener archive
              </div>
            )}
          </motion.div>
        )}

        {/* Wall of 9 other scores — right side */}
        {showWall && (
          <motion.div
            style={{
              position: 'absolute',
              top: 40,
              right: 8,
              width: '42%',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridTemplateRows: 'repeat(3, 1fr)',
              gap: 4,
              height: 'calc(100% - 160px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ duration: 2 }}
          >
            {WALL_SCORES.map((score, idx) => (
              <div
                key={idx}
                style={{
                  border: `0.5px solid ${COLORS.inkDarkSecondary}`,
                  borderRadius: 1,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <svg viewBox="0 0 55 30" preserveAspectRatio="xMidYMid meet"
                  style={{ width: '100%', height: '100%' }}>
                  {/* Mini 2-line stave */}
                  <line x1="2" y1="8" x2="53" y2="8" stroke={COLORS.inkDarkSecondary} strokeWidth="0.3" />
                  <line x1="2" y1="12" x2="53" y2="12" stroke={COLORS.inkDarkSecondary} strokeWidth="0.3" />
                  <line x1="2" y1="20" x2="53" y2="20" stroke={COLORS.inkDarkSecondary} strokeWidth="0.3" />
                  <line x1="2" y1="24" x2="53" y2="24" stroke={COLORS.inkDarkSecondary} strokeWidth="0.3" />
                  {score.marks.map((m, i) => {
                    const MarkComp = m.type
                    return (
                      <g key={i} transform={`translate(${m.x}, ${m.y})`}>
                        <MarkComp {...m.props} color={COLORS.inkDarkSecondary} />
                      </g>
                    )
                  })}
                </svg>
              </div>
            ))}
          </motion.div>
        )}

        {/* "You were always part of this." */}
        {showText && (
          <motion.div
            style={{
              position: 'absolute',
              bottom: 80,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 14,
              color: COLORS.scoreAmber,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ duration: 2 }}
          >
            you were always part of this.
          </motion.div>
        )}

        {/* Return button */}
        {showButton && (
          <motion.div
            style={{
              position: 'absolute',
              bottom: 40,
              left: 0,
              right: 0,
              textAlign: 'center',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            <button
              onClick={onReturn}
              style={{
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: 14,
                color: COLORS.inkDark,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '12px 24px',
                minHeight: 44,
              }}
            >
              return
            </button>
          </motion.div>
        )}
      </Paper>
    </div>
  )
}
