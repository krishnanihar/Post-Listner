import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import StemPlayer from '../lib/stemPlayer'
import { scoreArchetype } from '../lib/scoreArchetype'
import { getArchetype } from '../lib/archetypes'

// Tunable timings.
const MIRROR_DURATION_MS = 3000          // archetype name on cream before video
const POST_VOICE_TAIL_MS = 4000          // pure-song tail after voiceover ends
const FULL_VOLUME_FADE_MS = 2500         // song fade-in duration
const SONG_FADE_LEAD_MS = 2500           // starts this long before voice ends

const FULL_VOLUME_TARGET = 0.8

export default function Reveal({ onNext, avd, sessionData, revealAudioRef, getAudioCtx }) {
  const [stage, setStage] = useState('computing')

  // Score archetype once on mount — used to be Mirror's responsibility.
  // scoreArchetype is deterministic for archetype id; the variation has
  // ε-randomness but Mirror only consumed the archetype here.
  const archetype = useMemo(() => {
    try {
      const scored = scoreArchetype(avd.getAVD(), avd.getPhaseData())
      return scored?.archetypeId ? getArchetype(scored.archetypeId) : null
    } catch {
      return null
    }
  }, [avd])
  const archetypeId = archetype?.id || null

  const playerRef = useRef(null)         // StemPlayer or { kind:'audio', audio }
  const voiceRef = useRef(null)          // HTMLAudioElement for voiceover
  const advancedRef = useRef(false)
  const fadeRafRef = useRef(null)
  const timersRef = useRef([])
  const songFadeStartedRef = useRef(false)

  // ─── Load song stems silently while computing screen shows ──────────
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

  // ─── Mirror stage: hold archetype name 3s, then advance to video ─────
  useEffect(() => {
    if (stage !== 'mirror') return
    const t = setTimeout(() => setStage('video'), MIRROR_DURATION_MS)
    return () => clearTimeout(t)
  }, [stage])

  // ─── Video stage: play voiceover, fade song in near voice end ────────
  useEffect(() => {
    if (stage !== 'video') return
    if (!archetypeId) {
      // No archetype matched — skip ahead.
      finishReveal()
      return
    }

    const voice = new Audio(`/archetypes/voice/${archetypeId}.mp3`)
    voice.preload = 'auto'
    voice.volume = 1.0
    voiceRef.current = voice

    // Drive the song fade-in off the voice element's playback position so
    // each archetype's per-file duration self-synchronizes.
    const onTimeUpdate = () => {
      if (songFadeStartedRef.current) return
      if (!voice.duration || voice.duration === Infinity) return
      const remaining = voice.duration - voice.currentTime
      if (remaining * 1000 <= SONG_FADE_LEAD_MS) {
        songFadeStartedRef.current = true
        fadeAudio(FULL_VOLUME_TARGET, FULL_VOLUME_FADE_MS)
      }
    }
    const onEnded = () => {
      // Safety: if timeupdate didn't fire late enough to trigger fade, force it.
      if (!songFadeStartedRef.current) {
        songFadeStartedRef.current = true
        fadeAudio(FULL_VOLUME_TARGET, FULL_VOLUME_FADE_MS)
      }
      const t = setTimeout(() => finishReveal(), POST_VOICE_TAIL_MS)
      timersRef.current.push(t)
    }
    voice.addEventListener('timeupdate', onTimeUpdate)
    voice.addEventListener('ended', onEnded)
    voice.play().catch(() => { /* autoplay may fail — finishReveal still scheduled below as safety */ })

    // Hard ceiling: if voice fails to play or ended event misses, force advance
    // after a generous window (longest expected voice ~19s + tail + buffer).
    const ceiling = setTimeout(() => finishReveal(), 30000)
    timersRef.current.push(ceiling)

    return () => {
      voice.removeEventListener('timeupdate', onTimeUpdate)
      voice.removeEventListener('ended', onEnded)
    }
  }, [stage, archetypeId, fadeAudio, finishReveal])

  // Cleanup
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current)
      if (voiceRef.current) {
        try { voiceRef.current.pause() } catch { /* no-op */ }
        voiceRef.current = null
      }
    }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0a0a0f' }}>
      {/* Computing — cream paper, "composing your score..." */}
      <AnimatePresence>
        {stage === 'computing' && (
          <motion.div
            key="computing"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{ position: 'absolute', inset: 0, zIndex: 2 }}
          >
            <Paper variant="cream">
              <motion.div
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONTS.serif, fontStyle: 'italic',
                  fontSize: 16, color: COLORS.inkCreamSecondary,
                }}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                composing your score...
              </motion.div>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mirror — cream paper, archetype name */}
      <AnimatePresence>
        {stage === 'mirror' && archetype && (
          <motion.div
            key="mirror"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, zIndex: 2 }}
          >
            <Paper variant="cream">
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 36px', textAlign: 'center',
              }}>
                <motion.h2
                  style={{
                    fontFamily: FONTS.serif,
                    fontSize: 32,
                    color: COLORS.inkCream,
                    lineHeight: 1.1,
                    margin: 0,
                    letterSpacing: '0.01em',
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.4, ease: 'easeOut', delay: 0.1 }}
                >
                  {archetype.displayName}
                </motion.h2>
              </div>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video stage — archetype video full-bleed, voice + song play over it */}
      {(stage === 'video' || stage === 'done') && archetypeId && (
        <motion.video
          key="archetype-video"
          src={`/archetypes/${archetypeId}.mp4`}
          autoPlay
          muted
          playsInline
          preload="auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            zIndex: 0,
          }}
        />
      )}

      {/* Subtle vii. reveal label during the video stage */}
      {(stage === 'video' || stage === 'done') && (
        <div style={{
          position: 'absolute',
          bottom: 18,
          left: 0, right: 0,
          textAlign: 'center',
          fontFamily: FONTS.mono,
          fontSize: 9,
          color: 'rgba(232, 223, 203, 0.55)',
          letterSpacing: '0.1em',
          zIndex: 3,
          pointerEvents: 'none',
        }}>
          vii. reveal
        </div>
      )}
    </div>
  )
}
