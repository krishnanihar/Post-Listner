import { useEffect, useRef, useState, useCallback, useMemo, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ConversationProvider } from '@elevenlabs/react'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { useAdmirerAgent } from '../hooks/useAdmirerAgent.js'
import { buildFirstMessage } from '../lib/admirerFirstMessage.js'
import { appendEntry, buildDynamicVariables } from '../lib/sessionStore.js'
import StemPlayer from '../lib/stemPlayer.js'
import { subscribeLiveSession, getLiveSession } from '../lib/liveSession.js'
import { fireMoment, resetMoments } from '../lib/momentBus.js'
import { advanceFormationStage, resetFormationStage } from '../lib/formationStage.js'
import QuestionDisplay from './QuestionDisplay'
import { useAdmirerRoom } from '../hooks/useAdmirerRoom.js'
import AdmirerScene3D from './admirer-scene/AdmirerScene3D'
import { getAvd, resetAvd } from '../lib/avdStore.js'
import { mapAvdToStems } from '../lib/avdToStems.js'
import { avdRecorder } from '../lib/avdRecorder.js'
import { buildSessionRecord } from '../lib/sessionRecord.js'
import { useAttunementScore } from '../hooks/useAttunementScore.js'
import { archetypeRing } from '../lib/archetypeRing.js'
import LeanLift from './attunement/LeanLift'
import Rise from './attunement/Rise'
import Face from './attunement/Face'
import Listen from './attunement/Listen'
import { FRAGMENTS } from '../lib/fragmentBank.js'
import { phraseReaction } from '../lib/attunementReactions.js'

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID

// How long a Listen-beat fragment plays before we stop it and raise the
// rating prompt. Fragment URLs resolve to full master tracks (see
// fragmentBank.js — they are NOT short clips), so this fixed cap, not the
// audio element's 'ended' event, is what actually ends a fragment.
const FRAGMENT_DURATION_MS = 14000

// After a fragment ends, how long the Yes/No buttons wait for a tap before
// the rating resolves on its own as "none" and the run moves on.
const RATING_GRACE_MS = 10000

// Inner component — has to live under ConversationProvider to call the
// useConversation hook.
function AdmirerInner({ onNext, getAudioCtx, revealAudioRef }) {
  const [hasError, setHasError] = useState(false)
  // FIX 1 — tap-to-continue escape hatch for the arrival beat.
  const [showArrivalContinue, setShowArrivalContinue] = useState(false)
  const stemsBundleRef = useRef(null)
  const playerRef = useRef(null)
  // Idempotency guard for the orchestra handoff. The score's bloom is the
  // intended trigger; this also makes a stray agent commitEntry call a no-op
  // so the record is persisted and onNext fires exactly once.
  const committedRef = useRef(false)
  // Fragment-audio plumbing (reused by the Listen-beat adapter below).
  const fragmentAudioRef = useRef(null)
  const fragmentTimerRef = useRef(null)
  const ratingTimeoutRef = useRef(null)
  // Holds the resolve() of the in-flight Listen fragment promise — the Listen
  // component awaits it for each fragment and advances when the run is done.
  const pendingRatingRef = useRef(null)

  // Tear down the current fragment's audio element + cap timer. Pure
  // cleanup — does not touch the rating promise.
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

  // Resolve the in-flight fragment promise with the user's rating
  // ("yes" | "no" | "none"). This is what advances the Listen run.
  const resolveRating = useCallback((answer) => {
    if (ratingTimeoutRef.current) {
      clearTimeout(ratingTimeoutRef.current)
      ratingTimeoutRef.current = null
    }
    const pending = pendingRatingRef.current
    pendingRatingRef.current = null
    if (pending) {
      // Editorial moment: the user just rated a fragment (yes/no/none).
      // Burst-release 8% of particles, keyed on the fragment id so a
      // re-resolve doesn't double-fire.
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

  // Listen-beat adapter. Listen.jsx calls
  //   playFragment(fragment, { onAwaitRating, getRater }) -> Promise<rating>
  // and awaits it per fragment. We play the fragment audio; when it ends or
  // caps we call onAwaitRating() (so Listen shows the Yes/No buttons) and
  // expose the resolver via getRater() (so a tap resolves it). The promise
  // always resolves — a tap, or the grace timeout firing 'none'.
  const onPlayFragmentForListen = useCallback((fragment, { onAwaitRating, getRater } = {}) => {
    return new Promise((resolve) => {
      clearFragmentPlayback()
      // The run is strictly sequential, so a prior rating should never still
      // be pending — resolve it "none" defensively if one somehow is.
      if (pendingRatingRef.current) pendingRatingRef.current.resolve('none')
      pendingRatingRef.current = { resolve, fragmentId: fragment.id }
      // Expose the rating setter so a Yes/No tap inside Listen resolves it.
      getRater?.((answer) => resolveRating(answer))

      // Fragment audio has run its course (cap timer or 'ended'): stop
      // playback, raise the rating prompt, and arm the grace timeout.
      const raiseRating = () => {
        if (!pendingRatingRef.current) return
        clearFragmentPlayback()
        onAwaitRating?.()
        if (ratingTimeoutRef.current) clearTimeout(ratingTimeoutRef.current)
        ratingTimeoutRef.current = setTimeout(() => resolveRating('none'), RATING_GRACE_MS)
      }

      try {
        const audio = new Audio(fragment.url)
        audio.volume = 0.55
        // 'ended' is a fallback for a future pre-sliced short clip; for a
        // full master the cap timer below always fires first.
        audio.addEventListener('ended', raiseRating, { once: true })
        audio.play().catch(() => {
          // Autoplay blocked — skip straight to the rating prompt so the
          // promise still resolves and the run is not left hanging.
          raiseRating()
        })
        fragmentAudioRef.current = audio
        fragmentTimerRef.current = setTimeout(raiseRating, FRAGMENT_DURATION_MS)
      } catch (e) {
        console.warn('[attunement] listen playFragment failed:', e)
        raiseRating()
      }
    })
  }, [clearFragmentPlayback, resolveRating])

  // Monotonic token so the last-requested load wins; superseded in-flight
  // loads self-abandon (no orphan started players).
  const loadTokenRef = useRef(0)

  // Load the matched song's stems silently in the background so the Orchestra
  // can pick them up via revealAudioRef without an audio gap. Race-safe: the
  // last call wins; an earlier call that resolves after a newer one has started
  // abandons itself without starting or writing anything.
  const loadStemsSilently = useCallback(async (bundle) => {
    const ctx = getAudioCtx?.()
    if (!ctx) {
      console.warn('[attunement] no audio context — orchestra will fall back to static track')
      return
    }
    const token = ++loadTokenRef.current
    const prev = playerRef.current
    try {
      const player = await StemPlayer.load(ctx, bundle.stems, bundle.masterUrl)
      // A newer load was requested while we were decoding — abandon this one.
      // It was never start()ed, so it has no live audio graph to tear down.
      if (token !== loadTokenRef.current) return
      // Stop the previously-started player (if any) before replacing it.
      if (prev && prev !== player) {
        try { prev.stop?.() } catch { /* ignore */ }
      }
      player.setVolume(0, 0)
      player.start()
      playerRef.current = player
      stemsBundleRef.current = bundle
      if (revealAudioRef) revealAudioRef.current = player
    } catch (e) {
      console.warn('[attunement] StemPlayer.load failed:', e)
    }
  }, [getAudioCtx, revealAudioRef])

  // Speculative silent pre-load during Rise: load the nearest archetype's
  // stems as the in-progress vector resolves. If Face later changes the
  // archetype, onBloom reloads. Skips when the archetype hasn't changed.
  const preloadArchetypeRef = useRef(null)
  const onSpeculativePreload = useCallback((archetypeId) => {
    if (preloadArchetypeRef.current === archetypeId) return
    preloadArchetypeRef.current = archetypeId
    loadStemsSilently(mapAvdToStems(getAvd(), {}))
  }, [loadStemsSilently])

  // When the score finalizes, build + persist the rich session record, then
  // hand off to orchestra. The 600ms delay lets the bloom's expansion ramp
  // breathe before the phase swaps.
  const onCommitEntry = useCallback((entry) => {
    if (committedRef.current) return
    committedRef.current = true
    clearFragmentPlayback()
    resolveRating('none')
    try {
      const rec = avdRecorder.isRecording() ? avdRecorder.stop(Date.now()) : null
      const bundle = stemsBundleRef.current
      const record = buildSessionRecord({
        startedAt: rec?.startedAt ?? Date.now(),
        endedAt: rec?.endedAt ?? Date.now(),
        finalVector: rec?.finalVector ?? getAvd(),
        avdTrajectory: rec?.trajectory ?? [],
        landing: bundle ? { archetypeId: bundle.archetypeId, variationId: bundle.variationId } : null,
        summary: entry?.summary || '',
        rand: Math.random(),
      })
      appendEntry(record)
    } catch (e) {
      console.warn('[attunement] session record persist failed', e)
    }
    setTimeout(() => {
      // Carry the Admirer's one-line summary forward so App can relay it in
      // the entry message at settle.
      onNext({ stemsBundle: stemsBundleRef.current, summary: entry?.summary })
    }, 600)
  }, [onNext, clearFragmentPlayback, resolveRating])

  // Build the agent's opening line from session state — first-time users
  // get the threshold opening; returning users get a short recognition line.
  // Computed once on mount so it is stable across re-renders.
  const firstMessage = useMemo(() => {
    const dv = buildDynamicVariables()
    return buildFirstMessage({
      isFirstSession: dv.is_first_session,
      recencySummary: dv.recency_summary,
      timeOfDay: dv.time_of_day,
    })
  }, [])

  // Voice-only companion: the listener never speaks (gesture-only input), so
  // we never unmute the mic. We keep the SDK in voice mode (the agent must
  // SPEAK), but the mic — muted on connect by useAdmirerAgent — stays muted
  // for the whole session. No setMuted / sendUserActivity needed here.
  const {
    connect,
    status,
    isSpeaking,
    sendContextualUpdate,
  } = useAdmirerAgent({
    sessionStage: 'opening',
    firstMessage,
    callbacks: { onCommitEntry },
  })

  // Build A — the spatial room. Routes the companion voice through an HRTF
  // room and hosts the per-movement multi-source playback. The score drives
  // the room open (setExpansion per movement, beginExpansion at bloom).
  const { beginExpansion, setExpansion, getRoom } = useAdmirerRoom({ getAudioCtx, status })

  // Score → room expansion: each committed movement nudges the room a notch.
  const onScoreExpansion = useCallback((t) => { setExpansion(t) }, [setExpansion])

  // Score → companion voice: feed a natural-language contextual update for the
  // movement the listener just resolved (Task 5b + the context7 note —
  // contextual updates take prose, not JSON). Empty string = nothing worth
  // saying, so skip the send. Voice is optional, so failures are swallowed.
  // FIX 3 — rise downbeat: play the transient (markBeat) but do NOT send a
  // voice line per beat; return early so phraseReaction is never called for it.
  const onScoreReact = useCallback((movementId, payload) => {
    if (movementId === 'rise' && payload.downbeat) {
      roomHandleRef.current?.markBeat?.(payload.intensity ?? 1)
      return // transient only — no per-beat voice line
    }
    const prose = phraseReaction(movementId, payload)
    if (!prose) return
    try { sendContextualUpdate?.(prose) } catch { /* voice is optional */ }
  }, [sendContextualUpdate])

  // Score → companion asking: when a movement begins, cue the companion to
  // voice that movement's question aloud (the listener answers with gestures,
  // never speech). The cue is a contextual update, not a forced utterance —
  // contextual updates *inform* the agent and may not always trigger immediate
  // speech in voice mode (the same SDK behavior flagged for onScoreReact above);
  // this must be verified on device. If it doesn't speak on cue, the fallback
  // is sendUserMessage(...) (exposed by useAdmirerAgent). Voice is optional, so
  // a throw here is swallowed.
  const onScoreAsk = useCallback((movementId, askText) => {
    if (!askText) return
    try {
      sendContextualUpdate?.(`Now ask the listener, in your own warm words: ${askText}`)
    } catch { /* voice is optional */ }
  }, [sendContextualUpdate])

  // Score → bloom (the act-1 → act-2 handoff). Ensure the faced archetype's
  // stems are the loaded ones, snap the geometry fully formed, animate the
  // room open, then build + persist the record and hand off to Orchestra
  // (reusing onCommitEntry's body — the seam the Orchestra depends on).
  // FIX 2 — async: await the load so the 600ms onNext can't race a slow reload.
  const onBloom = useCallback(async () => {
    const bundle = mapAvdToStems(getAvd(), {})
    // Gate the commit on the load so the 600ms onNext can't race a slow
    // reload (which would let Orchestra detach a stale/empty player).
    const needLoad = !playerRef.current || bundle.archetypeId !== stemsBundleRef.current?.archetypeId
    if (needLoad) await loadStemsSilently(bundle)
    // Editorial moment: snap to fully formed; front figure fades in over the
    // handoff. eventIds keep both safe against re-fire.
    fireMoment(1.0, 'startGeneration')
    advanceFormationStage(2)
    beginExpansion()
    onCommitEntry({ summary: '' })
  }, [loadStemsSilently, beginExpansion, onCommitEntry])

  const score = useAttunementScore({
    onExpansion: onScoreExpansion,
    onSpeculativePreload,
    onBloom,
    onReact: onScoreReact,
    onAsk: onScoreAsk,
  })

  // Arrival is now gesture-only: there is no spoken answer to wait for, so the
  // tap-to-continue affordance is the single way out of arrival. Show it after
  // 2.5 s (was 5 s) so the listener isn't left waiting, or immediately on an
  // agent-connect failure, so Act 1 is never permanently stalled.
  // All setState calls are deferred via setTimeout to satisfy the
  // react-hooks/set-state-in-effect lint rule (no synchronous setState in body).
  useEffect(() => {
    const movId = score.movement?.id
    if (movId !== 'arrival') {
      const t = setTimeout(() => setShowArrivalContinue(false), 0)
      return () => clearTimeout(t)
    }
    if (hasError) {
      const t = setTimeout(() => setShowArrivalContinue(true), 0)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setShowArrivalContinue(true), 2500)
    return () => clearTimeout(t)
  }, [score.movement?.id, hasError])

  // Per-movement room playback: start/stop the right multi-source handle as
  // the movement changes. Fragment masters stand in as textures for the Lean
  // pair / Face ring / Rise bed (assets refined later — spec §11).
  const roomHandleRef = useRef(null)
  useEffect(() => {
    const room = getRoom()
    const ctx = getAudioCtx?.()
    if (!room || !ctx) return undefined
    let cancelled = false
    const decode = (url) => fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b))

    const start = async () => {
      try {
        if (score.movement?.id === 'leanLift') {
          const [l, r] = await Promise.all([
            decode(FRAGMENTS[2].url), // shadow-piano-late (cold)
            decode(FRAGMENTS[0].url), // warm-acoustic-now (warm)
          ])
          if (cancelled) return
          roomHandleRef.current = room.playTexturePair(l, r)
        } else if (score.movement?.id === 'rise') {
          const bed = await decode(FRAGMENTS[4].url) // lifted-cinematic
          if (cancelled) return
          roomHandleRef.current = room.playRiseBed(bed)
        } else if (score.movement?.id === 'face') {
          const ring = archetypeRing()
          const entries = await Promise.all(ring.map(async (rr, i) => ({
            azimuthDeg: rr.azimuthDeg,
            buffer: await decode(FRAGMENTS[i % FRAGMENTS.length].url),
          })))
          if (cancelled) return
          roomHandleRef.current = room.playRingSources(entries)
        }
      } catch (e) {
        console.warn('[attunement] room playback failed for', score.movement?.id, e)
      }
    }
    start()
    return () => {
      cancelled = true
      try { roomHandleRef.current?.stop() } catch { /* ignore */ }
      roomHandleRef.current = null
    }
  }, [score.movement?.id, getRoom, getAudioCtx])

  // Drive the active room handle from the live gesture each frame.
  useEffect(() => {
    let raf = 0
    let mounted = true
    const tick = () => {
      if (!mounted) return
      const h = roomHandleRef.current
      if (h) {
        if (score.movement?.id === 'leanLift' && h.setBalance) {
          h.setBalance((score.live.current.pan - 0.5) * 2)
        }
        // FIX 3 — drive Rise audio reactivity each frame.
        if (score.movement?.id === 'rise' && h.setSwell) {
          h.setSwell(score.live.current.swell ?? 0)
        }
        if (score.movement?.id === 'face' && h.spotlight) {
          h.spotlight(score.live.current.relYaw)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { mounted = false; cancelAnimationFrame(raf) }
  }, [score.movement?.id, score.live])

  // Transcript watcher: drives the per-turn release bursts when the companion
  // voices a question. The listener never speaks (gesture-only input), so there
  // are no user transcript lines to react to — arrival now advances via the
  // tap-to-continue affordance, not a spoken answer. Single source of truth for
  // these momentBus dispatches.
  const { transcript } = useSyncExternalStore(subscribeLiveSession, getLiveSession)
  const firedQuestionAtIndexRef = useRef(null)
  if (firedQuestionAtIndexRef.current === null) firedQuestionAtIndexRef.current = new Set()

  useEffect(() => {
    const firedQ = firedQuestionAtIndexRef.current
    for (let i = 0; i < transcript.length; i++) {
      const line = transcript[i]
      if (line.role === 'agent' && !firedQ.has(i) && line.text.includes('?')) {
        fireMoment(0.12, `question:${i}`)
        firedQ.add(i)
      }
    }
  }, [transcript])

  // Editorial moment dispatcher + session lifecycle. Each rite starts with
  // the release at 0 (resetMoments) plus an immediate 8% pre-release. The
  // 'mount' eventId makes this idempotent. Also resets the AVD vector and
  // starts the ~1Hz AVD trajectory recorder; cleanup stops it + resets.
  useEffect(() => {
    resetMoments()
    resetFormationStage()
    fireMoment(0.08, 'mount')
    resetAvd()
    avdRecorder.start(Date.now())
    return () => {
      if (avdRecorder.isRecording()) avdRecorder.stop(Date.now())
      resetAvd()
    }
  }, [])

  // Connect on mount.
  useEffect(() => {
    connect().catch((e) => {
      console.error('[admirer] connect failed:', e)
      setHasError(true)
    })
  }, [connect])

  // Stop fragment audio + timers + orphan StemPlayer on unmount, and resolve
  // any rating still in flight so the Listen promise can settle.
  // Intentionally inlines the teardown rather than calling the callbacks
  // (keeps this effect's dep array empty) — keep in sync.
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
      // Only stop the player if the rite was ABANDONED (not committed). On a
      // committed bloom this player is the live handoff — Orchestra mounts next
      // (AnimatePresence mode="wait" unmounts us first) and calls
      // detachAndGetSources() on it; stopping it here nulls its sources and the
      // song dies at the seam.
      const player = playerRef.current
      if (player && !committedRef.current && revealAudioRef?.current === player) {
        try { player.stop?.() } catch { /* ignore */ }
        if (revealAudioRef) revealAudioRef.current = null
      }
      playerRef.current = null
    }
  }, [])

  // Derive the visible state label from SDK signals + the active movement.
  const movementId = score.movement?.id
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
  } else if (movementId === 'arrival') {
    // Gesture-only: the listener never speaks. The companion greets and asks;
    // the listener taps to continue when ready.
    stateLabel = 'your turn'
    stateKey = 'arrival-idle'
  } else if (movementId === 'leanLift') {
    stateLabel = 'lean toward what pulls'
    stateKey = 'leanLift'
  } else if (movementId === 'listen') {
    stateLabel = 'listen'
    stateKey = 'listen'
  } else if (movementId === 'rise') {
    stateLabel = 'let it rise'
    stateKey = 'rise'
  } else if (movementId === 'face') {
    stateLabel = 'face the room'
    stateKey = 'face'
  } else {
    // bloom / handoff — fall silent
    stateLabel = ''
    stateKey = 'bloom'
  }

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
          {/* Amber dot — pulses only when the companion is speaking */}
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

          {/* The active question the companion is asking. Reads from
              liveSession; shows only utterances containing '?', extracts
              the question sentence, persists through the user response. */}
          <QuestionDisplay />
        </div>

        {/* The active movement overlay. Each renders representational
            presences over the shader ground (AdmirerScene3D) and drives the
            score's commit/advance. */}
        {movementId === 'leanLift' && (
          <LeanLift
            live={score.live}
            committed={score.state.status === 'committed'}
            onCommit={score.commit}
            onAdvance={score.advance}
          />
        )}
        {movementId === 'listen' && (
          <Listen
            fragments={FRAGMENTS.slice(0, 2)}
            playFragment={onPlayFragmentForListen}
            onAdvance={score.advance}
          />
        )}
        {movementId === 'rise' && (
          <Rise
            committed={score.state.status === 'committed'}
            onCommit={score.commit}
            onAdvance={score.advance}
          />
        )}
        {movementId === 'face' && (
          <Face
            live={score.live}
            committed={score.state.status === 'committed'}
            onCommit={score.commit}
            onAdvance={score.advance}
          />
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Arrival escape hatch: low-emphasis tap-to-continue shown after 2.5 s
            (or immediately on error). The listener never speaks — this tap is
            the only way out of arrival, so the arc never stalls. */}
        {score.movement?.id === 'arrival' && showArrivalContinue && (
          <div style={{
            flex: '0 0 auto',
            marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
          }}>
            <button
              onClick={() => score.advance()}
              style={{
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: 13,
                letterSpacing: 0.3,
                color: COLORS.inkCreamSecondary,
                background: 'transparent',
                border: `1px solid ${COLORS.inkCreamSecondary}`,
                borderRadius: 20,
                padding: '6px 18px',
                cursor: 'pointer',
                opacity: 0.7,
              }}
            >
              continue
            </button>
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
