import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import Mirror from './Mirror.score'
import { COLORS, FONTS } from '../score/tokens'
import { playVoice, preloadVoices } from '../score/voice'

const VOICE_PATHS = [
  '/chamber/voices/score/reveal-05.mp3',  // "Listen to what it sounds like."
  '/chamber/voices/score/reveal-06.mp3',  // "Made by an algorithm. Read by you. Held by you."
]

const FULL_VOLUME_FADE_MS = 1800   // fade-in from silence → 0.8 when listening begins
const FULL_VOLUME_TARGET = 0.8

export default function Reveal({ onNext, avd, sessionData, revealAudioRef }) {
  const [stage, setStage] = useState('computing')

  const audioRef = useRef(null)
  const advancedRef = useRef(false)
  const fadeRafRef = useRef(null)

  useEffect(() => {
    preloadVoices(VOICE_PATHS)

    const promise = sessionData?.musicPromise
    if (!promise) {
      setTimeout(() => setStage('mirror'), 0)
      return
    }

    promise.then(url => {
      const audio = new Audio(url)
      audio.volume = 0
      audio.loop = true
      audioRef.current = audio
      if (revealAudioRef) revealAudioRef.current = audio
      setStage('mirror')
    }).catch(() => {
      setStage('mirror')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fadeAudio = useCallback((targetVolume, durationMs) => {
    if (!audioRef.current) return
    const audio = audioRef.current
    if (audio.paused) audio.play().catch(() => {})
    const start = audio.volume
    const t0 = performance.now()
    if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current)
    const loop = (t) => {
      const p = Math.min(1, (t - t0) / durationMs)
      audio.volume = start + (targetVolume - start) * p
      if (p < 1) fadeRafRef.current = requestAnimationFrame(loop)
    }
    fadeRafRef.current = requestAnimationFrame(loop)
  }, [])

  const finishReveal = useCallback(() => {
    if (advancedRef.current) return
    advancedRef.current = true
    setStage('done')

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
    } catch { /* storage full */ }

    playVoice(VOICE_PATHS[1])
    setTimeout(() => onNext(), 3000)
  }, [avd, onNext])

  const handleMirrorComplete = useCallback(() => {
    setStage('listening')
    // Mirror has been visual-only; the audio is loaded but paused at t=0.
    // Reset defensively in case any future code starts playback early —
    // the user must hear the track from the beginning at full volume.
    if (audioRef.current) {
      audioRef.current.currentTime = 0
    }
    fadeAudio(FULL_VOLUME_TARGET, FULL_VOLUME_FADE_MS)
    setTimeout(() => playVoice(VOICE_PATHS[0]), 1500)  // "Listen to what it sounds like."

    // Detect first play-through completion or safety ceiling.
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
      setTimeout(() => requestAnimationFrame(checkLoop), 8000)
    }
    // Safety ceiling
    setTimeout(() => finishReveal(), 65000)
  }, [fadeAudio, finishReveal])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
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

      {stage === 'mirror' && (
        <Mirror
          avd={avd}
          onComplete={handleMirrorComplete}
        />
      )}

      {(stage === 'listening' || stage === 'done') && (
        <Paper variant="cream">
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 32px',
              textAlign: 'center',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            <div style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 16,
              color: COLORS.inkCream,
              lineHeight: 1.6,
            }}>
              listen to what it sounds like
            </div>
            <div style={{
              marginTop: 32,
              fontFamily: FONTS.mono,
              fontSize: 9,
              color: COLORS.inkCreamSecondary,
              letterSpacing: '0.1em',
            }}>
              vi. reveal
            </div>
          </motion.div>
        </Paper>
      )}
    </div>
  )
}
