import { useEffect, useRef, useState, useCallback, useMemo, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ConversationProvider } from '@elevenlabs/react'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { useAdmirerAgent } from '../hooks/useAdmirerAgent.js'
import { buildFirstMessage } from '../lib/admirerFirstMessage.js'
import { buildDynamicVariables } from '../lib/sessionStore.js'
import StemPlayer from '../lib/stemPlayer.js'
import { addLexiconWord, subscribeLiveSession, getLiveSession } from '../lib/liveSession.js'
import { fireMoment, resetMoments } from '../lib/momentBus.js'
import { advanceFormationStage, resetFormationStage } from '../lib/formationStage.js'
import QuestionDisplay from './QuestionDisplay'
import HoldToSpeak from './HoldToSpeak'
import FragmentControls from './FragmentControls'
import { useAdmirerRoom } from '../hooks/useAdmirerRoom.js'
import { useIdleKeepAlive } from '../hooks/useIdleKeepAlive.js'
import AdmirerScene3D from './admirer-scene/AdmirerScene3D'

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID

// How long a locate-phase fragment plays before we stop it and raise the
// rating prompt. Fragment URLs resolve to full master tracks (see
// fragmentBank.js — they are NOT short clips), so this fixed cap, not the
// audio element's 'ended' event, is what actually ends a fragment.
const FRAGMENT_DURATION_MS = 14000

// After a fragment ends, how long the Yes/No buttons wait for a tap before
// the rating resolves on its own as "none" and the run moves on. Kept so
// FRAGMENT_DURATION_MS + this stays well under the playFragment tool's
// response_timeout_secs (30s — see scripts/create-admirer-agent.js).
const RATING_GRACE_MS = 10000

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
  const ratingTimeoutRef = useRef(null)
  // Holds the resolve() of the in-flight playFragment promise — the agent's
  // playFragment tool call is blocked on it until the user rates.
  const pendingRatingRef = useRef(null)

  // Tear down the current fragment's audio element + cap timer. Pure
  // cleanup — does not touch React state or the rating promise.
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

  // Resolve the in-flight playFragment promise with the user's rating
  // ("yes" | "no" | "none"). This is what unblocks the agent's tool call,
  // so the listening run is paced by the user, not the agent's clock.
  const resolveRating = useCallback((answer) => {
    if (ratingTimeoutRef.current) {
      clearTimeout(ratingTimeoutRef.current)
      ratingTimeoutRef.current = null
    }
    setAwaitingRating(false)
    const pending = pendingRatingRef.current
    pendingRatingRef.current = null
    if (pending) {
      // Editorial moment: the user just rated a fragment (yes/no/none).
      // Burst-release 8% of particles. eventId is the fragment id so
      // re-resolving the same fragment (shouldn't happen, but defensively)
      // doesn't double-fire.
      if (pending.fragmentId) {
        fireMoment(0.08, `fragment:${pending.fragmentId}`)
        // First fragment rated → advance formation stage 1 (back plane
        // fades in). Subsequent ratings are no-ops by the formationStage
        // contract.
        advanceFormationStage(1)
      }
      pending.resolve(answer)
    }
  }, [])

  // The fragment audio has run its course (cap timer fired, or the audio
  // ended). Stop playback and raise the Yes/No prompt. If the user does not
  // tap within RATING_GRACE_MS, the rating resolves on its own as "none".
  const finishFragment = useCallback(() => {
    // No-op if the rating was already resolved (a tap, or a lifecycle
    // teardown) — a late cap/ended callback must not re-raise the prompt.
    if (!pendingRatingRef.current) return
    clearFragmentPlayback()
    setFragmentPlaying(false)
    setAwaitingRating(true)
    if (ratingTimeoutRef.current) clearTimeout(ratingTimeoutRef.current)
    ratingTimeoutRef.current = setTimeout(() => resolveRating('none'), RATING_GRACE_MS)
  }, [clearFragmentPlayback, resolveRating])

  // Play a locate-phase fragment. Returns a promise that resolves to the
  // user's rating ("yes" | "no" | "none") once they tap or the grace window
  // elapses. The agent's playFragment tool blocks on this promise, so the
  // agent stays silent for the whole fragment and cannot race ahead.
  const onPlayFragment = useCallback((fragment) => {
    return new Promise((resolve) => {
      clearFragmentPlayback()
      // The blocking tool is strictly sequential, so a prior rating should
      // never still be pending — resolve it "none" if one somehow is.
      if (pendingRatingRef.current) pendingRatingRef.current.resolve('none')
      pendingRatingRef.current = { resolve, fragmentId: fragment.id }
      setFragmentPlaying(true)
      setAwaitingRating(false)
      try {
        const audio = new Audio(fragment.url)
        audio.volume = 0.55
        // 'ended' is a fallback for a future pre-sliced short clip; for a
        // full master the cap timer below always fires first.
        audio.addEventListener('ended', finishFragment, { once: true })
        audio.play().catch(() => {
          // Autoplay blocked — skip straight to the rating prompt so the
          // tool still resolves and the agent is not left blocked.
          finishFragment()
        })
        fragmentAudioRef.current = audio
        fragmentTimerRef.current = setTimeout(finishFragment, FRAGMENT_DURATION_MS)
      } catch (e) {
        console.warn('[admirer] playFragment failed:', e)
        finishFragment()
      }
    })
  }, [clearFragmentPlayback, finishFragment])

  // When the agent confirms a direction, start loading the StemPlayer
  // silently in the background.
  const onStartGeneration = useCallback(async (bundle) => {
    // The listening run is over — kill any fragment still playing and
    // resolve any rating still in flight.
    clearFragmentPlayback()
    resolveRating('none')
    setFragmentPlaying(false)
    // The conversation has resolved — let the room begin to open.
    setGenerationStarted(true)
    // Editorial moment: the agent has chosen the direction; the rite is
    // about to hand off to the orchestra. Snap the geometry to fully
    // formed (any remaining un-released particles release now). The
    // 'startGeneration' eventId makes this safe against re-fires.
    fireMoment(1.0, 'startGeneration')
    // Formation stage 2 — front figure fades in over the orchestra handoff.
    advanceFormationStage(2)
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
  }, [getAudioCtx, revealAudioRef, clearFragmentPlayback, resolveRating])

  // When the agent finalizes, hand off to orchestra.
  const onCommitEntry = useCallback((entry) => {
    clearFragmentPlayback()
    resolveRating('none')
    setFragmentPlaying(false)
    setTimeout(() => {
      // Slice 3 — carry the Admirer's one-line summary forward so App can
      // relay it in the entry message at settle.
      onNext({ stemsBundle: stemsBundleRef.current, summary: entry?.summary })
    }, 600)
  }, [onNext, clearFragmentPlayback, resolveRating])

  // Mirror each verbatim lexicon word the agent records (via the
  // recordLexicon client tool) into the live session, so the reflection
  // surface can show the user's own words accumulating. addLexiconWord
  // trims, de-duplicates, and ignores empty input.
  const onRecordLexicon = useCallback(({ term, userPhrasing } = {}) => {
    addLexiconWord(userPhrasing)
    // Editorial moment: the agent just captured one of the user's
    // verbatim words. Burst-release 5% of particles. eventId is the
    // term so the same term being re-recorded doesn't double-fire.
    if (term) fireMoment(0.05, `lexicon:${term}`)
  }, [])

  // Build the agent's opening line from session state — first-time users
  // get the threshold opening; returning users get a short recognition line
  // keyed off recencySummary + timeOfDay. Computed once on mount so it
  // is stable across re-renders.
  const firstMessage = useMemo(() => {
    const dv = buildDynamicVariables()
    return buildFirstMessage({
      isFirstSession: dv.is_first_session,
      recencySummary: dv.recency_summary,
      timeOfDay: dv.time_of_day,
    })
  }, [])

  // Transcript watcher: drives the per-turn release bursts (agent question,
  // user turn). Lives here (not in BackgroundGlyph) so all momentBus
  // dispatches happen in one place — single source of truth, no
  // double-fire risk.
  //
  // Index-keyed bookkeeping correctly handles the Task-5 tentative→final
  // dedupe in liveSession: when a line's text grows from "welcome." to
  // "welcome. ... what's around you?", this effect re-runs and sees the
  // line at index i has a '?' for the first time, so it fires once.
  // After it fires for that index, the seen set blocks any re-fire even
  // if the line's text changes again.
  const { transcript } = useSyncExternalStore(subscribeLiveSession, getLiveSession)
  const firedQuestionAtIndexRef = useRef(null)
  const firedUserTurnAtIndexRef = useRef(null)
  if (firedQuestionAtIndexRef.current === null) firedQuestionAtIndexRef.current = new Set()
  if (firedUserTurnAtIndexRef.current === null) firedUserTurnAtIndexRef.current = new Set()

  useEffect(() => {
    const firedQ = firedQuestionAtIndexRef.current
    const firedU = firedUserTurnAtIndexRef.current
    for (let i = 0; i < transcript.length; i++) {
      const line = transcript[i]
      if (line.role === 'agent') {
        if (!firedQ.has(i) && line.text.includes('?')) {
          fireMoment(0.12, `question:${i}`)
          firedQ.add(i)
        }
      } else if (line.role === 'user') {
        if (!firedU.has(i)) {
          fireMoment(0.05, `user:${i}`)
          firedU.add(i)
        }
      }
    }
  }, [transcript])

  const {
    connect,
    status,
    isSpeaking,
    isMuted,
    setMuted,
    sendUserActivity,
  } = useAdmirerAgent({
    sessionStage: 'opening',
    firstMessage,
    callbacks: { onPlayFragment, onStartGeneration, onCommitEntry, onRecordLexicon },
  })

  // Build A — the spatial room. Routes the agent's voice through an HRTF
  // room and opens it at the phase-1 → phase-2 handoff.
  const beginExpansion = useAdmirerRoom({ getAudioCtx, status })

  // While the agent is connected and the user is NOT holding the speak
  // button (and NOT mid-fragment), ping sendUserActivity every 10s so the
  // server's turn-timeout timer does not fire and the agent does not
  // advance through silence. Stops automatically when the user holds the
  // button (isMuted goes false) — at that point real audio is reaching
  // the server and it has its own activity signal.
  useIdleKeepAlive({
    enabled: status === 'connected' && isMuted && !fragmentPlaying && !awaitingRating,
    intervalMs: 10000,
    ping: sendUserActivity,
  })

  // When the agent commits a direction, open the room. The room's expansion
  // is the phase-1 → phase-2 transition — the closed conversation room
  // audibly widening into the orchestra under the agent's closing words.
  useEffect(() => {
    if (generationStarted) beginExpansion()
  }, [generationStarted, beginExpansion])

  // A Yes/No button tap — resolves the current fragment's rating, which
  // unblocks the agent's playFragment tool call and moves the run on.
  const handleRate = useCallback((answer) => {
    resolveRating(answer)
  }, [resolveRating])

  // Editorial moment dispatcher: each rite starts with the release at 0
  // (resetMoments) plus an immediate 8% pre-release so the geometry has
  // a faint hint of its form before the Admirer's first word. The
  // 'mount' eventId makes this idempotent: dev-mode double-mount or a
  // hot-reload re-fire won't double the initial release.
  useEffect(() => {
    resetMoments()
    resetFormationStage()
    fireMoment(0.08, 'mount')
  }, [])

  // Connect on mount.
  useEffect(() => {
    connect().catch((e) => {
      console.error('[admirer] connect failed:', e)
      setHasError(true)
    })
  }, [connect])

  // Stop fragment audio + timers + orphan StemPlayer on unmount, and
  // resolve any rating still in flight so the tool promise can settle.
  // Intentionally inlines clearFragmentPlayback + resolveRating rather than
  // calling them (keeps this effect's dep array empty) — keep in sync.
  useEffect(() => {
    return () => {
      if (fragmentTimerRef.current) {
        clearTimeout(fragmentTimerRef.current)
        fragmentTimerRef.current = null
      }
      if (ratingTimeoutRef.current) {
        clearTimeout(ratingTimeoutRef.current)
        ratingTimeoutRef.current = null
      }
      if (pendingRatingRef.current) {
        pendingRatingRef.current.resolve('none')
        pendingRatingRef.current = null
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
  } else if (awaitingRating) {
    stateLabel = 'did you like it?'
    stateKey = 'awaiting-rating'
  } else if (!isMuted) {
    stateLabel = 'I’m listening'
    stateKey = 'user-speaking'
  } else {
    stateLabel = 'your turn'
    stateKey = 'idle'
  }

  // Push-to-talk is hidden during a fragment and its rating — the user taps
  // Yes/No there, and the agent cannot hear voice while the blocking
  // playFragment tool runs anyway.
  const showHoldToSpeak = !hasError && !fragmentPlaying && !awaitingRating

  return (
    <Paper variant="cream">
      <AdmirerScene3D />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        padding: '0 32px',
        zIndex: 5,
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

          {/* The active question the Admirer is asking. Reads from
              liveSession; shows only utterances containing '?', extracts
              the question sentence, persists through user response. */}
          <QuestionDisplay />
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
              showButtons={awaitingRating}
              onRate={handleRate}
            />
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bottom region: hold-to-speak button */}
        {showHoldToSpeak && (
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
