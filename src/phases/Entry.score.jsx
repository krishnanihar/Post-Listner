import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { audioEngine } from '../engine/audio'
import { getUserName, setUserName } from '../lib/sessionStore.js'

export default function Entry({ onNext }) {
  const [stage, setStage] = useState('intro')
  const [name, setName] = useState('')
  // Captured once, reused on every return — text-only personalization
  // (the Admirer's voice never speaks the name).
  const [returningName] = useState(() => getUserName())

  const videoRef = useRef(null)
  const droneStopRef = useRef(null)
  const tailTimerRef = useRef(null)

  const beginIntro = useCallback(() => {
    if (stage !== 'intro') return

    // 60 Hz felt anchor under the rite, started inside the user gesture.
    audioEngine.init()
    audioEngine.resume()

    // iOS gates device-motion AND device-orientation behind SEPARATE permission
    // prompts, each of which must be requested inside a user gesture — this tap
    // is that gesture. Motion drives the rise/face beats (gesture-size + strike);
    // ORIENTATION drives the lean/listen beats (roll→Valence, pitch→Depth) and
    // places the Admirer's voice in the room. Both must be requested, or the
    // orientation-gated beats get no input on iOS even when motion is granted.
    // Fire-and-forget: if denied, the beats' safety-net timeouts advance the arc.
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().catch(() => { /* denied — fine */ })
    }
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(() => { /* denied — fine */ })
    }

    if (!droneStopRef.current) {
      droneStopRef.current = audioEngine.playDrone(60, 0.04)
    }

    // Play the video silently — the Admirer's voice has taken over the
    // role the intro voice.mp3 used to play.
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => { /* ignore */ })
    }

    setStage('video')

    // Auto-advance to name input after a short atmospheric beat. The full
    // 29s video is too long without voice — 8s lands the visual without
    // dragging. video.onEnded is kept as a fallback in case the timer
    // somehow fails (e.g. video paused by OS background switch).
    if (tailTimerRef.current) clearTimeout(tailTimerRef.current)
    tailTimerRef.current = setTimeout(() => setStage('name'), 8000)
  }, [stage])

  const onVideoEnded = () => {
    // Fallback path: if the video runs to its full 29s without our timer
    // firing, still advance gracefully.
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
    const trimmed = name.trim()
    // Empty is allowed — the user may begin without a name.
    if (trimmed) {
      setUserName(trimmed)
      try {
        localStorage.setItem('postlistener_name', trimmed)
      } catch { /* storage unavailable */ }
    }
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
                {returningName ? (
                  <>
                    <div style={{
                      fontFamily: FONTS.serif, fontStyle: 'italic',
                      fontSize: 18, color: COLORS.inkCream, textAlign: 'center',
                    }}>
                      welcome back, {returningName}
                    </div>
                    <button
                      onClick={advance}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: COLORS.scoreAmber,
                        fontFamily: FONTS.serif, fontStyle: 'italic',
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      continue
                    </button>
                  </>
                ) : (
                  <>
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
                      maxLength={40}
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
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: name.trim() ? COLORS.scoreAmber : COLORS.inkCreamSecondary,
                        fontFamily: FONTS.serif, fontStyle: 'italic',
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      {name.trim() ? 'continue' : 'begin without a name'}
                    </button>
                  </>
                )}
              </div>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
