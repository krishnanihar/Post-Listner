import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import Mirror from './Mirror.score'
import { COLORS, FONTS } from '../score/tokens'
import StemPlayer from '../lib/stemPlayer'

const FULL_VOLUME_FADE_MS = 1500       // fade-in from silence → 0.8 when the video starts
const FULL_VOLUME_TARGET = 0.8

const LISTENING_TEXT_MS = 2000         // "listen to what it sounds like" text-only beat
const LISTENING_VIDEO_MS = 10000       // archetype video runtime
const LISTENING_TOTAL_MS = LISTENING_TEXT_MS + LISTENING_VIDEO_MS

export default function Reveal({ onNext, avd, sessionData, revealAudioRef, getAudioCtx }) {
  const [stage, setStage] = useState('computing')
  const [listeningPhase, setListeningPhase] = useState('text') // 'text' | 'video'
  const [archetypeId, setArchetypeId] = useState(null)

  const playerRef = useRef(null)       // StemPlayer (4-stem case) or { kind:'audio', audio }
  const advancedRef = useRef(false)
  const fadeRafRef = useRef(null)
  const timersRef = useRef([])

  useEffect(() => {
    const bundle = sessionData?.stemsBundle
    if (!bundle) {
      setTimeout(() => setStage('mirror'), 0)
      return
    }

    const ctx = getAudioCtx?.()

    async function loadAudio() {
      try {
        if (bundle.kind === 'stems' && ctx) {
          const player = await StemPlayer.load(ctx, bundle.stems, '/chamber/tracks/track-a.mp3')
          player.start()
          playerRef.current = player
          if (revealAudioRef) revealAudioRef.current = player
        } else {
          // Fallback: single master MP3 via HTMLAudio.
          const url = bundle.url || '/chamber/tracks/track-a.mp3'
          const audio = new Audio(url)
          audio.volume = 0
          audio.loop = true
          playerRef.current = { kind: 'audio', audio }
          if (revealAudioRef) revealAudioRef.current = audio
        }
      } catch (e) {
        console.warn('Reveal: audio load failed', e)
      }
      setStage('mirror')
    }
    loadAudio()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fadeAudio = useCallback((targetVolume, durationMs) => {
    const p = playerRef.current
    if (!p) return
    if (p instanceof StemPlayer) {
      p.setVolume(targetVolume, durationMs)
      return
    }
    const audio = p.audio
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    const start = audio.volume
    const t0 = performance.now()
    if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current)
    const loop = (t) => {
      const pr = Math.min(1, (t - t0) / durationMs)
      audio.volume = start + (targetVolume - start) * pr
      if (pr < 1) fadeRafRef.current = requestAnimationFrame(loop)
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

    setTimeout(() => onNext(), 1500)
  }, [avd, onNext])

  // Mirror finishes (silent) → 2s text-only beat → 10s archetype video + song fade-up.
  const handleMirrorComplete = useCallback((meta) => {
    if (meta?.archetypeId) setArchetypeId(meta.archetypeId)
    setStage('listening')
    setListeningPhase('text')

    const timers = timersRef.current
    timers.push(setTimeout(() => {
      setListeningPhase('video')
      fadeAudio(FULL_VOLUME_TARGET, FULL_VOLUME_FADE_MS)
    }, LISTENING_TEXT_MS))
    timers.push(setTimeout(() => finishReveal(), LISTENING_TOTAL_MS))
  }, [fadeAudio, finishReveal])

  // Cleanup
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current)
    }
  }, [])

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
        <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0a0a0f' }}>
          <Paper variant="cream">
            <AnimatePresence mode="wait">
              {listeningPhase === 'text' && (
                <motion.div
                  key="listening-text"
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
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeInOut' }}
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
                </motion.div>
              )}
            </AnimatePresence>
          </Paper>

          {listeningPhase === 'video' && archetypeId && (
            <motion.video
              key="archetype-video"
              src={`/archetypes/${archetypeId}.mp4`}
              autoPlay
              muted
              playsInline
              preload="auto"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 2,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
            />
          )}

          <div style={{
            position: 'absolute',
            bottom: 18,
            left: 0, right: 0,
            textAlign: 'center',
            fontFamily: FONTS.mono,
            fontSize: 9,
            color: listeningPhase === 'video' ? 'rgba(232, 223, 203, 0.6)' : COLORS.inkCreamSecondary,
            letterSpacing: '0.1em',
            zIndex: 3,
            pointerEvents: 'none',
            transition: 'color 0.6s ease-out',
          }}>
            vii. reveal
          </div>
        </div>
      )}
    </div>
  )
}
