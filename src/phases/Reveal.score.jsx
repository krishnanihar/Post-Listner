import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import Score from '../score/Score'
import Paper from '../score/Paper'
import Stave from '../score/Stave'
import { Linea, Vox, Tremolo, Marcato, Caesura, Pneuma, Ponticello, Legno, Fermata, Tactus, Downbeat } from '../score/marks'
import { COLORS, FONTS } from '../score/tokens'
import { playVoice, preloadVoices } from '../score/voice'

const VOICE_PATHS = [
  '/chamber/voices/score/reveal-01.mp3',
  '/chamber/voices/score/reveal-02.mp3',
  '/chamber/voices/score/reveal-03.mp3',
  '/chamber/voices/score/reveal-04.mp3',
  '/chamber/voices/score/reveal-05.mp3',
  '/chamber/voices/score/reveal-06.mp3',
]

const TEXTURE_MARK_MAP = {
  strings: Tremolo,
  synthesizer: Vox,
  distortion: Marcato,
  keys: Caesura,
  voice: Pneuma,
  glitch: Ponticello,
  rhythm: Legno,
  field: Fermata,
}

// Stave Y positions for the 4 score sections
const STAVE_SPECTRUM_Y = 90
const STAVE_DEPTH_Y = 180
const STAVE_TEXTURES_Y = 270
const STAVE_TACTUS_Y = 360
const STAVE_WIDTH = 310

export default function Reveal({ onNext, avd, sessionData, revealAudioRef }) {
  const [staveVisible, setStaveVisible] = useState([false, false, false, false])
  const [stage, setStage] = useState('computing') // computing, assembling, listening, done
  const [avdValues] = useState(() => avd.getAVD())

  const audioRef = useRef(null)
  const advancedRef = useRef(false)

  const phaseData = avd.getPhaseData()

  useEffect(() => {
    preloadVoices(VOICE_PATHS)

    const promise = sessionData?.musicPromise
    if (!promise) {
      // Fallback
      beginAssembly()
      return
    }

    // Await music, then assemble score
    promise.then(url => {
      const audio = new Audio(url)
      audio.volume = 0.8
      audio.loop = true
      audioRef.current = audio
      if (revealAudioRef) revealAudioRef.current = audio
      beginAssembly()
    }).catch(() => {
      beginAssembly()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const beginAssembly = useCallback(() => {
    setStage('assembling')

    // Staves fade in sequentially over 5 seconds
    const delays = [0, 1200, 2400, 3600]
    delays.forEach((d, i) => {
      setTimeout(() => {
        setStaveVisible(prev => {
          const next = [...prev]
          next[i] = true
          return next
        })
      }, d)
    })

    // Voice cues — spaced by actual durations + 0.5s breathing room
    // reveal-01: 2.0s, 02: 3.6s, 03: 5.7s, 04: 3.1s, 05: 1.6s, 06: 6.4s
    const timers = []
    const t = (ms, fn) => timers.push(setTimeout(fn, ms))
    t(5000, () => playVoice(VOICE_PATHS[0]))    // "Here it is. Your score." (2.0s)
    t(7500, () => playVoice(VOICE_PATHS[1]))    // "Every mark on this paper came from your body." (3.6s)
    t(11600, () => playVoice(VOICE_PATHS[2]))   // "The line you drew. The voices you held. The textures you kept." (5.7s)
    t(17800, () => playVoice(VOICE_PATHS[3]))   // "This is what your taste looks like written down." (3.1s)
    t(21400, () => playVoice(VOICE_PATHS[4]))   // "Listen to what it sounds like." (1.6s)
    t(23500, () => {
      // Start music
      setStage('listening')
      if (audioRef.current) {
        audioRef.current.play().catch(() => {})
      }
    })

    // After music plays ~30s or safety ceiling, voice 06 then advance
    t(65000, () => finishReveal())

    // Also detect first play-through completion
    if (audioRef.current) {
      let revealTriggered = false
      let maxTime = 0
      const checkLoop = () => {
        if (revealTriggered || !audioRef.current) return
        const a = audioRef.current
        if (a.currentTime > maxTime) maxTime = a.currentTime
        if (a.duration && a.currentTime >= a.duration - 0.5) {
          revealTriggered = true
          finishReveal()
          return
        }
        if (maxTime > 5 && a.currentTime < maxTime - 2) {
          revealTriggered = true
          finishReveal()
          return
        }
        requestAnimationFrame(checkLoop)
      }
      setTimeout(() => requestAnimationFrame(checkLoop), 24000)
    }

    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const finishReveal = useCallback(() => {
    if (advancedRef.current) return
    advancedRef.current = true
    setStage('done')

    // Save session to localStorage
    const currentAVD = avd.getAVD()
    const session = {
      sessionId: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      avd: currentAVD,
      phases: avd.getPhaseData(),
      selectedTrack: 'procedural',
      sunoPrompt: avd.getPrompt(),
    }
    try {
      localStorage.setItem('postlistener_session', JSON.stringify(session))
      const sessions = JSON.parse(localStorage.getItem('postlistener_sessions') || '[]')
      sessions.push(session)
      localStorage.setItem('postlistener_sessions', JSON.stringify(sessions))
    } catch (e) { /* storage full */ }

    playVoice(VOICE_PATHS[5]) // "Made by an algorithm. Read by you. Held by you."
    setTimeout(() => onNext(), 3000)
  }, [avd, onNext])

  // Build spectrum marks from phaseData
  const spectrumMarks = (phaseData.spectrum?.pairs || []).map((p, i) => ({
    x: 20 + i * (STAVE_WIDTH / 8) + (STAVE_WIDTH / 16),
    dip: p.choice === 'left' ? 'left' : 'right',
  }))

  // Depth: number of vox stacks
  const depthLayers = phaseData.depth?.finalLayer || 0

  // Textures: preferred texture names
  const preferredTextures = phaseData.textures?.preferred || []

  // AVD footer
  const footer = `A ${avdValues.a.toFixed(2)}  V ${avdValues.v.toFixed(2)}  D ${avdValues.d.toFixed(2)}`

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Loading state — before score assembles */}
      {stage === 'computing' && (
        <Paper variant="cream">
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 16,
              color: COLORS.inkCreamSecondary,
            }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            composing your score...
          </motion.div>
        </Paper>
      )}

      <Score
        variant="cream"
        pageTitle="vi. reveal"
        footer={footer}
      >
        {/* Stave 1: Spectrum — linea marks */}
        {staveVisible[0] && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            <Stave width={STAVE_WIDTH} y={STAVE_SPECTRUM_Y} color={COLORS.inkCream} />
            <text x="5" y={STAVE_SPECTRUM_Y - 6} fill={COLORS.inkCreamSecondary} fontSize="8" fontFamily={FONTS.serif} fontStyle="italic">spectrum</text>
            {spectrumMarks.map((m, i) => (
              <g key={i} transform={`translate(${m.x}, ${STAVE_SPECTRUM_Y + 6})`}>
                <Linea size={30} dip={m.dip} color={COLORS.inkCream} />
              </g>
            ))}
          </motion.g>
        )}

        {/* Stave 2: Depth — vox stacks */}
        {staveVisible[1] && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            <Stave width={STAVE_WIDTH} y={STAVE_DEPTH_Y} color={COLORS.inkCream} />
            <text x="5" y={STAVE_DEPTH_Y - 6} fill={COLORS.inkCreamSecondary} fontSize="8" fontFamily={FONTS.serif} fontStyle="italic">depth</text>
            {Array.from({ length: depthLayers }, (_, i) => (
              <g key={i} transform={`translate(${30 + i * 20}, ${STAVE_DEPTH_Y + 2})`}>
                <Vox size={10} color={COLORS.inkCream} />
              </g>
            ))}
          </motion.g>
        )}

        {/* Stave 3: Textures — marks by type */}
        {staveVisible[2] && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            <Stave width={STAVE_WIDTH} y={STAVE_TEXTURES_Y} color={COLORS.inkCream} />
            <text x="5" y={STAVE_TEXTURES_Y - 6} fill={COLORS.inkCreamSecondary} fontSize="8" fontFamily={FONTS.serif} fontStyle="italic">textures</text>
            {preferredTextures.map((name, i) => {
              const MarkComp = TEXTURE_MARK_MAP[name]
              if (!MarkComp) return null
              return (
                <g key={i} transform={`translate(${30 + i * 35}, ${STAVE_TEXTURES_Y + 6})`}>
                  <MarkComp size={12} color={COLORS.inkCream} />
                </g>
              )
            })}
          </motion.g>
        )}

        {/* Stave 4: Moment — tactus line */}
        {staveVisible[3] && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            <Stave width={STAVE_WIDTH} y={STAVE_TACTUS_Y} color={COLORS.inkCream} />
            <text x="5" y={STAVE_TACTUS_Y - 6} fill={COLORS.inkCreamSecondary} fontSize="8" fontFamily={FONTS.serif} fontStyle="italic">moment</text>
            <g transform={`translate(20, ${STAVE_TACTUS_Y + 6})`}>
              <Tactus width={STAVE_WIDTH - 20} color={COLORS.inkCream} amplitude={4} frequency={3 + avdValues.a * 4} />
            </g>
          </motion.g>
        )}
      </Score>

      {/* Bottom text */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 24,
          right: 24,
          textAlign: 'center',
          fontFamily: FONTS.serif,
          fontStyle: 'italic',
          fontSize: 14,
          color: COLORS.inkCream,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: staveVisible[3] ? 0.8 : 0 }}
        transition={{ duration: 2, delay: 1 }}
      >
        this is what your body wrote
      </motion.div>
    </div>
  )
}
