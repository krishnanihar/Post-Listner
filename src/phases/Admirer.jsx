import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ConversationProvider } from '@elevenlabs/react'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { useAdmirerAgent } from '../hooks/useAdmirerAgent.js'
import StemPlayer from '../lib/stemPlayer.js'
import { addLexiconWord } from '../lib/liveSession.js'
import HoldToSpeak from './HoldToSpeak'
import FragmentControls from './FragmentControls'
import { useAdmirerRoom } from '../hooks/useAdmirerRoom.js'

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID

// How long a locate-phase fragment plays before we stop it and ask the user
// to rate it. Fragment URLs resolve to full master tracks (see
// fragmentBank.js — they are NOT short clips), so this fixed cap, not the
// audio element's 'ended' event, is what actually ends a fragment.
const FRAGMENT_DURATION_MS = 14000

// Inner component — has to live under ConversationProvider to call the
// useConversation hook.
function AdmirerInner({ onNext, getAudioCtx, revealAudioRef }) {
  const [hasError, setHasError] = useState(false)
  const [fragmentPlaying, setFragmentPlaying] = useState(false)
  const [awaitingRating, setAwaitingRating] = useState(false)
  const [generationStarted, setGenerationStarted] = useState(false)
  const stemsBundleRef = useRef(null)
  const playerRef = useRef(null)
  const fragmentAudioRef = useRef(null)
  const fragmentTimerRef = useRef(null)
  const ratingButtonsSeenRef = useRef(false)

  // Tear down the current fragment's audio element + cap timer. Pure
  // cleanup — does not touch React state; callers set state themselves.
  const clearFragmentPlayback = useCallback(() => {
    if (fragmentTimerRef.current) {
      clearTimeout(fragmentTimerRef.current)
      fragmentTimerRef.current = null
    }
    if (fragmentAudioRef.current) {
      try { fragmentAudioRef.current.pause() } catch { /* ignore */ }
      fragmentAudioRef.current = null
    }
  }, [])

  // The fragment has run its course (cap timer fired, or — for a future
  // pre-sliced short clip — the audio actually ended). Stop playback and
  // raise the rating prompt.
  const finishFragment = useCallback(() => {
    clearFragmentPlayback()
    setFragmentPlaying(false)
    setAwaitingRating(true)
  }, [clearFragmentPlayback])

  // Play a locate-phase fragment. We use a plain HTMLAudioElement so it
  // doesn't fight with the StemPlayer's AudioContext routing. The fragment
  // URL is a full master track, so a fixed cap timer — not the audio's
  // 'ended' event — is what stops it and triggers the rating prompt.
  const onPlayFragment = useCallback((fragment) => {
    // Starting a new fragment tears down the previous one and clears any
    // prior rating prompt.
    clearFragmentPlayback()
    ratingButtonsSeenRef.current = false
    setFragmentPlaying(true)
    setAwaitingRating(false)
    try {
      const audio = new Audio(fragment.url)
      audio.volume = 0.55
      // 'ended' is a fallback for a future pre-sliced short clip; for a
      // full master the cap timer below always fires first.
      audio.addEventListener('ended', finishFragment, { once: true })
      audio.play().catch(() => {
        // Autoplay blocked — drop the cap timer and unstick the UI.
        setFragmentPlaying(false)
        clearFragmentPlayback()
      })
      fragmentAudioRef.current = audio
      fragmentTimerRef.current = setTimeout(finishFragment, FRAGMENT_DURATION_MS)
    } catch (e) {
      console.warn('[admirer] playFragment failed:', e)
      setFragmentPlaying(false)
    }
  }, [clearFragmentPlayback, finishFragment])

  // When the agent confirms a direction, start loading the StemPlayer
  // silently in the background.
  const onStartGeneration = useCallback(async (bundle) => {
    // The listening run is over — kill any fragment still playing and any
    // pending rating prompt.
    clearFragmentPlayback()
    setFragmentPlaying(false)
    setAwaitingRating(false)
    // The conversation has resolved — let the room begin to open.
    setGenerationStarted(true)
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
  }, [getAudioCtx, revealAudioRef, clearFragmentPlayback])

  // When the agent finalizes, hand off to orchestra.
  const onCommitEntry = useCallback(() => {
    clearFragmentPlayback()
    setFragmentPlaying(false)
    setAwaitingRating(false)
    setTimeout(() => {
      onNext({ stemsBundle: stemsBundleRef.current })
    }, 600)
  }, [onNext, clearFragmentPlayback])

  // Mirror each verbatim lexicon word the agent records (via the
  // recordLexicon client tool) into the live session, so the reflection
  // surface can show the user's own words accumulating. addLexiconWord
  // trims, de-duplicates, and ignores empty input.
  const onRecordLexicon = useCallback(({ userPhrasing } = {}) => {
    addLexiconWord(userPhrasing)
  }, [])

  const {
    connect,
    status,
    isSpeaking,
    isMuted,
    setMuted,
    sendUserMessage,
  } = useAdmirerAgent({
    sessionStage: 'opening',
    callbacks: { onPlayFragment, onStartGeneration, onCommitEntry, onRecordLexicon },
  })

  // Build A — the spatial room. Routes the agent's voice through an HRTF
  // room and opens it at the phase-1 → phase-2 handoff.
  const beginExpansion = useAdmirerRoom({ getAudioCtx, status })

  // When the agent commits a direction, open the room. The room's expansion
  // is the phase-1 → phase-2 transition — the closed conversation room
  // audibly widening into the orchestra under the agent's closing words.
  useEffect(() => {
    if (generationStarted) beginExpansion()
  }, [generationStarted, beginExpansion])

  // Called by Yes/No buttons. Sends the answer as a user turn and clears
  // the rating prompt immediately — no need to wait for the agent's reply.
  const handleRate = useCallback((answer) => {
    setAwaitingRating(false)
    try {
      sendUserMessage?.(answer)
    } catch (e) {
      console.warn('[admirer] sendUserMessage threw:', e)
    }
  }, [sendUserMessage])

  // Connect on mount.
  useEffect(() => {
    connect().catch((e) => {
      console.error('[admirer] connect failed:', e)
      setHasError(true)
    })
  }, [connect])

  // Stop any fragment audio + cap timer + orphan StemPlayer on unmount.
  useEffect(() => {
    return () => {
      if (fragmentTimerRef.current) {
        clearTimeout(fragmentTimerRef.current)
        fragmentTimerRef.current = null
      }
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

  // The rating buttons are genuinely on screen only when a fragment has
  // finished, the agent is silent, and a rating is awaited. awaitingRating
  // clears on exactly two paths: a button tap (handleRate) or the agent's
  // next turn (the voice-answer effect below). If neither happens the
  // buttons simply remain — safe, still tappable; onStartGeneration /
  // onCommitEntry also reset it when the listening run ends.
  const ratingButtonsVisible = awaitingRating && !isSpeaking && !fragmentPlaying

  // Once the buttons have actually appeared, remember it — so a later
  // agent-speech event can be read as "the user voice-answered".
  useEffect(() => {
    if (ratingButtonsVisible) ratingButtonsSeenRef.current = true
  }, [ratingButtonsVisible])

  // Voice-answer path: once the buttons have actually been on screen
  // (ratingButtonsSeenRef is set only in a render where the agent is
  // silent — ratingButtonsVisible requires !isSpeaking), a later
  // agent-speech event means the agent heard the user's spoken yes/no —
  // clear the prompt so the buttons don't linger. The guard therefore
  // ignores the agent's own "did you like that?" question, spoken before
  // the buttons are ever raised. setTimeout defers the setState past the
  // render cycle, satisfying react-hooks/set-state-in-effect.
  useEffect(() => {
    if (isSpeaking && awaitingRating && ratingButtonsSeenRef.current) {
      setTimeout(() => setAwaitingRating(false), 0)
    }
  }, [isSpeaking, awaitingRating])

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
  } else if (fragmentPlaying) {
    stateLabel = 'listening'
    stateKey = 'fragment-playing'
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

        {/* Fragment controls: playing indicator + Yes/No rating buttons */}
        {!hasError && (
          <div style={{
            flex: '0 0 auto',
            marginTop: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            minHeight: 60,
          }}>
            <FragmentControls
              fragmentPlaying={fragmentPlaying}
              showButtons={ratingButtonsVisible}
              onRate={handleRate}
            />
          </div>
        )}

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
