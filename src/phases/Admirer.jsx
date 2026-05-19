import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ConversationProvider } from '@elevenlabs/react'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { useAdmirerAgent } from '../hooks/useAdmirerAgent.js'
import StemPlayer from '../lib/stemPlayer.js'

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID

// Inner component — has to live under ConversationProvider to call
// useConversationControls / useConversationStatus.
function AdmirerInner({ onNext, getAudioCtx, revealAudioRef }) {
  const [hasError, setHasError] = useState(false)
  const stemsBundleRef = useRef(null)
  const playerRef = useRef(null)
  const fragmentAudioRef = useRef(null)

  // Play a locate-phase fragment. We use a plain HTMLAudioElement so it
  // doesn't fight with the StemPlayer's AudioContext routing.
  const onPlayFragment = useCallback((fragment) => {
    try {
      // Stop any in-flight fragment first.
      if (fragmentAudioRef.current) {
        fragmentAudioRef.current.pause()
        fragmentAudioRef.current = null
      }
      const audio = new Audio(fragment.url)
      audio.volume = 0.55
      audio.play().catch(() => { /* autoplay may be blocked until first gesture */ })
      fragmentAudioRef.current = audio
    } catch (e) {
      console.warn('[admirer] playFragment failed:', e)
    }
  }, [])

  // When the agent confirms a direction, start loading the StemPlayer
  // in the background. The user is still mid-conversation — the load
  // happens during the agent's last few lines.
  const onStartGeneration = useCallback(async (bundle) => {
    stemsBundleRef.current = bundle
    const ctx = getAudioCtx?.()
    if (!ctx) {
      console.warn('[admirer] no audio context — orchestra will fall back to static track')
      return
    }
    try {
      const player = await StemPlayer.load(ctx, bundle.stems, bundle.masterUrl)
      player.setVolume(0, 0)  // start silent; Orchestra Bloom will fade in
      player.start()
      playerRef.current = player
      if (revealAudioRef) revealAudioRef.current = player
    } catch (e) {
      console.warn('[admirer] StemPlayer.load failed:', e)
    }
  }, [getAudioCtx, revealAudioRef])

  // When the agent finalizes, hand off to orchestra. Stop any fragment
  // audio that might still be playing.
  const onCommitEntry = useCallback(() => {
    if (fragmentAudioRef.current) {
      try { fragmentAudioRef.current.pause() } catch { /* ignore */ }
      fragmentAudioRef.current = null
    }
    // Small delay so the agent's final line can land.
    setTimeout(() => {
      onNext({ stemsBundle: stemsBundleRef.current })
    }, 600)
  }, [onNext])

  const { connect, status } = useAdmirerAgent({
    sessionStage: 'opening',
    callbacks: { onPlayFragment, onStartGeneration, onCommitEntry },
  })

  // Connect on mount. Browsers require user-gesture for mic — Entry's
  // begin-tap already counted as one, so we're cleared.
  useEffect(() => {
    connect().catch((e) => {
      console.error('[admirer] connect failed:', e)
      setHasError(true)
    })
  }, [connect])

  // Stop the fragment audio and any orphaned StemPlayer if the phase unmounts
  // before commitEntry handed ownership of the running player to Orchestra.
  useEffect(() => {
    return () => {
      if (fragmentAudioRef.current) {
        try { fragmentAudioRef.current.pause() } catch { /* ignore */ }
        fragmentAudioRef.current = null
      }
      // If revealAudioRef still points at our player, Orchestra never took it —
      // stop it. If Orchestra picked it up, revealAudioRef has been mutated by
      // Orchestra's detachAndGetSources() and we don't touch it.
      const player = playerRef.current
      if (player && revealAudioRef?.current === player) {
        try { player.stop?.() } catch { /* ignore */ }
      }
      playerRef.current = null
    }
  }, [])

  return (
    <Paper variant="cream">
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 18, padding: '0 32px',
      }}>
        <AnimatePresence>
          {!hasError && (
            <motion.div
              key="listening"
              initial={{ opacity: 0 }}
              animate={{ opacity: status === 'connected' ? 1 : 0.4 }}
              transition={{ duration: 0.8 }}
              style={{
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: 14,
                letterSpacing: 0.3,
                color: COLORS.inkCreamSecondary,
              }}
            >
              {status === 'connected' ? 'listening' : 'arriving'}
            </motion.div>
          )}
          {hasError && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: 14,
                color: COLORS.inkCream,
              }}
            >
              the Admirer could not arrive. try again later.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Paper>
  )
}

export default function Admirer({ onNext, getAudioCtx, revealAudioRef }) {
  if (!AGENT_ID) {
    // Hard fail at boundary — without an agent there's no point continuing.
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
