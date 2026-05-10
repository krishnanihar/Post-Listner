import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { audioEngine } from '../engine/audio'

export default function Entry({ onNext }) {
  const [stage, setStage] = useState('intro')
  const [name, setName] = useState('')

  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const droneStopRef = useRef(null)
  const tailTimerRef = useRef(null)

  const beginIntro = useCallback(() => {
    if (stage !== 'intro') return

    // 60 Hz felt anchor under the rite, started inside the user gesture.
    audioEngine.init()
    audioEngine.resume()
    if (!droneStopRef.current) {
      droneStopRef.current = audioEngine.playDrone(60, 0.04)
    }

    // Play video + voice synchronously inside the user gesture so iOS Safari
    // and other strict autoplay browsers honor it.
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => { /* ignore */ })
    }
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => { /* ignore */ })
    }

    setStage('video')
  }, [stage])

  // Video is 29s, voice is ~23.8s. We let the voice finish, then the cosmic
  // tail (~5s of silent video) breathes before advancing on video.onEnded.
  const onVideoEnded = () => {
    if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
    tailTimerRef.current = setTimeout(() => setStage('name'), 400)
  }

  // Pause the looping video once we leave the video stage to save battery/GPU.
  useEffect(() => {
    if (stage !== 'video' && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
    }
  }, [stage])

  const handleNameSubmit = () => {
    if (!name.trim()) return
    try {
      localStorage.setItem('postlistener_name', name.trim())
    } catch { /* storage unavailable */ }
    advance()
  }

  const advance = () => {
    if (droneStopRef.current) {
      droneStopRef.current()
      droneStopRef.current = null
    }
    onNext({ name: name.trim() })
  }

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (droneStopRef.current) {
        droneStopRef.current()
        droneStopRef.current = null
      }
      if (tailTimerRef.current) {
        clearTimeout(tailTimerRef.current)
        tailTimerRef.current = null
      }
    }
  }, [])

  const showVideo = stage === 'intro' || stage === 'video'

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#0a0a0f' }}>
      {/* Single video element — blurred while stage='intro', clear during 'video'. */}
      {showVideo && (
        <video
          ref={videoRef}
          src="/intro/intro.mp4"
          poster="/intro/introimage.png"
          muted
          playsInline
          preload="auto"
          onEnded={onVideoEnded}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            filter: stage === 'intro' ? 'blur(36px) brightness(0.55)' : 'none',
            transform: stage === 'intro' ? 'scale(1.08)' : 'scale(1)', // hide blurred edge bleed
            transition: 'filter 1.8s ease-out, transform 1.8s ease-out',
            zIndex: 0,
          }}
        />
      )}

      <audio
        ref={audioRef}
        src="/intro/voice.mp3"
        preload="auto"
      />

      <AnimatePresence>
        {stage === 'intro' && (
          <motion.div
            key="intro-overlay"
            onClick={beginIntro}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 28,
              cursor: 'pointer',
              zIndex: 2,
              padding: '0 32px',
            }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          >
            <span style={{
              fontFamily: FONTS.serif, fontStyle: 'italic',
              fontSize: 14, letterSpacing: 0.2,
              color: 'rgba(232, 223, 203, 0.7)',
              textAlign: 'center',
            }}>
              wear headphones
            </span>
            <motion.span
              style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 20,
                color: COLORS.scoreAmber,
                marginTop: 12,
                letterSpacing: 0.4,
              }}
              animate={{ opacity: [0.45, 0.95, 0.45] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            >
              begin
            </motion.span>
          </motion.div>
        )}

        {stage === 'name' && (
          <motion.div
            key="name"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, zIndex: 3 }}
          >
            <Paper variant="cream">
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 28, padding: '0 32px',
              }}>
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
              </div>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
