import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ConversationProvider } from '@elevenlabs/react'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { useAdmirerAgent } from '../hooks/useAdmirerAgent.js'
import StemPlayer from '../lib/stemPlayer.js'
import HoldToSpeak from './HoldToSpeak'

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID

// Inner component — has to live under ConversationProvider to call the
// useConversation hook.
function AdmirerInner({ onNext, getAudioCtx, revealAudioRef }) {
  const [hasError, setHasError] = useState(false)
  const stemsBundleRef = useRef(null)
  const playerRef = useRef(null)
  const fragmentAudioRef = useRef(null)

  // Play a locate-phase fragment. We use a plain HTMLAudioElement so it
  // doesn't fight with the StemPlayer's AudioContext routing.
  const onPlayFragment = useCallback((fragment) => {
    try {
      if (fragmentAudioRef.current) {
        fragmentAudioRef.current.pause()
        fragmentAudioRef.current = null
      }
      const audio = new Audio(fragment.url)
      audio.volume = 0.55
      audio.play().catch(() => { /* autoplay may be blocked */ })
      fragmentAudioRef.current = audio
    } catch (e) {
      console.warn('[admirer] playFragment failed:', e)
    }
  }, [])

  // When the agent confirms a direction, start loading the StemPlayer
  // silently in the background.
  const onStartGeneration = useCallback(async (bundle) => {
    stemsBundleRef.current = bundle
    const ctx = getAudioCtx?.()
    if (!ctx) {
      console.warn('[admirer] no audio context — orchestra will fall back to static track')
      return
    }
    try {
      const player = await StemPlayer.load(ctx, bundle.stems, bundle.masterUrl)
      player.setVolume(0, 0)
      player.start()
      playerRef.current = player
      if (revealAudioRef) revealAudioRef.current = player
    } catch (e) {
      console.warn('[admirer] StemPlayer.load failed:', e)
    }
  }, [getAudioCtx, revealAudioRef])

  // When the agent finalizes, hand off to orchestra.
  const onCommitEntry = useCallback(() => {
    if (fragmentAudioRef.current) {
      try { fragmentAudioRef.current.pause() } catch { /* ignore */ }
      fragmentAudioRef.current = null
    }
    setTimeout(() => {
      onNext({ stemsBundle: stemsBundleRef.current })
    }, 600)
  }, [onNext])

  const {
    connect,
    status,
    isSpeaking,
    isMuted,
    setMuted,
  } = useAdmirerAgent({
    sessionStage: 'opening',
    callbacks: { onPlayFragment, onStartGeneration, onCommitEntry },
  })

  // Connect on mount.
  useEffect(() => {
    connect().catch((e) => {
      console.error('[admirer] connect failed:', e)
      setHasError(true)
    })
  }, [connect])

  // Stop any fragment audio + orphan StemPlayer on unmount.
  useEffect(() => {
    return () => {
      if (fragmentAudioRef.current) {
        try { fragmentAudioRef.current.pause() } catch { /* ignore */ }
        fragmentAudioRef.current = null
      }
      const player = playerRef.current
      if (player && revealAudioRef?.current === player) {
        try { player.stop?.() } catch { /* ignore */ }
      }
      playerRef.current = null
    }
  }, [])

  // Push-to-talk handlers — wired to the HoldToSpeak button.
  const handleHoldStart = useCallback(() => {
    if (!setMuted) return
    try { setMuted(false) } catch (e) { console.warn('[admirer] setMuted(false) threw:', e) }
  }, [setMuted])

  const handleHoldEnd = useCallback(() => {
    if (!setMuted) return
    try { setMuted(true) } catch (e) { console.warn('[admirer] setMuted(true) threw:', e) }
  }, [setMuted])

  // Derive the visible state label from SDK signals.
  // Note: we infer "you speaking" from !isMuted because with push-to-talk
  // the user is only sending audio while the button is held.
  let stateLabel
  let stateKey
  if (hasError) {
    stateLabel = 'the Admirer could not arrive. try again later.'
    stateKey = 'error'
  } else if (status !== 'connected') {
    stateLabel = 'arriving'
    stateKey = 'arriving'
  } else if (isSpeaking) {
    stateLabel = 'speaking'
    stateKey = 'agent-speaking'
  } else if (!isMuted) {
    stateLabel = 'I’m listening'
    stateKey = 'user-speaking'
  } else {
    stateLabel = 'your turn'
    stateKey = 'idle'
  }

  return (
    <Paper variant="cream">
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        padding: '0 32px',
      }}>
        {/* Top region: amber dot + state label */}
        <div style={{
          flex: '0 0 auto',
          marginTop: 'calc(env(safe-area-inset-top, 0px) + 56px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}>
          {/* Amber dot — pulses only when the agent is speaking */}
          <motion.span
            aria-hidden
            animate={{
              opacity: isSpeaking ? [0.4, 1, 0.4] : 0.25,
              scale: isSpeaking ? [0.9, 1.15, 0.9] : 1,
            }}
            transition={{
              duration: isSpeaking ? 1.4 : 0.6,
              repeat: isSpeaking ? Infinity : 0,
              ease: 'easeInOut',
            }}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: COLORS.scoreAmber,
              display: 'block',
            }}
          />

          {/* State label */}
          <AnimatePresence mode="wait">
            <motion.div
              key={stateKey}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: hasError ? 1 : 0.75, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: 14,
                letterSpacing: 0.3,
                color: hasError ? COLORS.inkCream : COLORS.inkCreamSecondary,
                textAlign: 'center',
              }}
            >
              {stateLabel}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bottom region: hold-to-speak button */}
        {!hasError && (
          <div style={{
            flex: '0 0 auto',
            marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          }}>
            <HoldToSpeak
              onHoldStart={handleHoldStart}
              onHoldEnd={handleHoldEnd}
              isAgentSpeaking={isSpeaking}
              disabled={status !== 'connected'}
            />
          </div>
        )}
      </div>
    </Paper>
  )
}

export default function Admirer({ onNext, getAudioCtx, revealAudioRef }) {
  if (!AGENT_ID) {
    return (
      <Paper variant="cream">
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 32px', textAlign: 'center',
        }}>
          <p style={{ fontFamily: FONTS.serif, fontStyle: 'italic', color: COLORS.inkCream }}>
            VITE_ELEVENLABS_AGENT_ID is not set. The Admirer cannot start.
          </p>
        </div>
      </Paper>
    )
  }
  return (
    <ConversationProvider agentId={AGENT_ID}>
      <AdmirerInner onNext={onNext} getAudioCtx={getAudioCtx} revealAudioRef={revealAudioRef} />
    </ConversationProvider>
  )
}
