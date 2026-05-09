import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import Mirror from './Mirror.score'
import { COLORS, FONTS } from '../score/tokens'
import StemPlayer from '../lib/stemPlayer'

const FULL_VOLUME_FADE_MS = 1800   // fade-in from silence → 0.8 when listening begins
const FULL_VOLUME_TARGET = 0.8
const SUB_AUDIBLE_TARGET = 0.12       // barely-perceptible fade-up during Forer
const SUB_AUDIBLE_FADE_MS = 6000      // 6s ramp from silence → 0.12

export default function Reveal({ onNext, avd, sessionData, revealAudioRef, getAudioCtx }) {
  const [stage, setStage] = useState('computing')

  const playerRef = useRef(null)       // StemPlayer (4-stem case) or { kind:'audio', audio }
  const advancedRef = useRef(false)
  const fadeRafRef = useRef(null)

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
          // Fallback path: single master MP3 via HTMLAudio (legacy shape).
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
    // Legacy HTMLAudio fallback
    const audio = p.audio
    if (!audio) return
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

  const handleSubAudibleStart = useCallback(() => {
    if (!playerRef.current) return
    // Mirror is at the t=8s mark of the Forer paragraph. Begin a long, gentle
    // ramp from silence to ~0.12 — under most listeners' detection threshold
    // until they consciously notice the music has been forming beneath them.
    fadeAudio(SUB_AUDIBLE_TARGET, SUB_AUDIBLE_FADE_MS)
  }, [fadeAudio])

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

    setTimeout(() => onNext(), 3000)
  }, [avd, onNext])

  const handleMirrorComplete = useCallback(() => {
    setStage('listening')
    // Audio has been playing sub-audibly since t=8s of Mirror. Do NOT reset
    // currentTime — that would cut the now-running track back to 0
    // and break the seamless "the music was always under you" beat.
    fadeAudio(FULL_VOLUME_TARGET, FULL_VOLUME_FADE_MS)

    // Detect first play-through completion or safety ceiling.
    const listenStart = Date.now()
    const MIN_LISTEN_MS = 25000  // ensure ~25s of full-volume listening per the
                                  // 5-phase reveal architecture (Research/recognition-problem-reveal-moment.md)
                                  // before advancing to Orchestra
    const p = playerRef.current
    if (p instanceof StemPlayer) {
      // Stems loop seamlessly — no per-buffer "play-through" boundary to
      // detect. Hold for MIN_LISTEN_MS + 6s grace, then advance.
      setTimeout(() => finishReveal(), MIN_LISTEN_MS + 6000)
    } else if (p && p.audio) {
      const a = p.audio
      let revealTriggered = false
      let maxTime = 0
      const checkLoop = () => {
        if (revealTriggered || !playerRef.current) return
        if (a.currentTime > maxTime) maxTime = a.currentTime
        if (Date.now() - listenStart < MIN_LISTEN_MS) {
          requestAnimationFrame(checkLoop)
          return
        }
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
          onSubAudibleStart={handleSubAudibleStart}
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
              vii. reveal
            </div>
          </motion.div>
        </Paper>
      )}
    </div>
  )
}
