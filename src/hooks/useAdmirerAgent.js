import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useConversation } from '@elevenlabs/react'
import { buildAdmirerTools } from '../lib/admirerTools.js'
import { buildDynamicVariables } from '../lib/sessionStore.js'

// Thin wrapper around the SDK. Each phase calls connect() once on mount
// and disconnect() on unmount. The phase passes its own callbacks for
// onPlayFragment/onStartGeneration/onCommitEntry so it can react to
// tool invocations.
//
// Push-to-talk: on connect, we immediately call setMuted(true) so the
// session starts with the mic closed. Holding the speak button calls
// setMuted(false); releasing calls setMuted(true). This eliminates the
// duplicate-on-silence problem from voice-activated turn detection,
// and gives the user full agency over pacing.
//
// sessionStage:
//   'opening' — Admirer phase: arrival + biography + locate + generation
//   'closing' — Settle phase: brief settle/close
export function useAdmirerAgent({ sessionStage = 'opening', callbacks = {} } = {}) {
  const conv = useConversation()
  const { startSession, endSession, setMuted } = conv
  const startedRef = useRef(false)
  const callbacksRef = useRef(callbacks)
  useLayoutEffect(() => {
    callbacksRef.current = callbacks
  })

  const connect = useCallback(async () => {
    if (startedRef.current) return
    startedRef.current = true

    const clientTools = buildAdmirerTools(callbacksRef.current)
    const dynamicVariables = {
      ...buildDynamicVariables(),
      session_stage: sessionStage,
    }

    try {
      await startSession({
        clientTools,
        dynamicVariables,
        onConnect: ({ conversationId }) => {
          console.log(`[admirer] connected (${sessionStage}):`, conversationId)
          // Push-to-talk: start muted. Setting after connect so the SDK
          // has fully wired up the audio track before we mute it.
          try { setMuted?.(true) } catch (e) { console.warn('[admirer] setMuted threw:', e) }
        },
        onError: (message) => {
          console.error('[admirer] error:', message)
        },
        onDisconnect: () => {
          console.log('[admirer] disconnected')
        },
      })
    } catch (e) {
      console.error('[admirer] startSession threw:', e)
      startedRef.current = false
    }
  }, [sessionStage, startSession, setMuted])

  const disconnect = useCallback(async () => {
    if (!startedRef.current) return
    startedRef.current = false
    try { await endSession() } catch (e) { console.warn('[admirer] endSession threw:', e) }
  }, [endSession])

  // Auto-cleanup if the host unmounts mid-session. The SDK's endSession
  // returns void synchronously in some versions (not a Promise) so we
  // can't .catch() on it. Wrap in try/catch and tolerate either shape.
  useEffect(() => {
    return () => {
      if (startedRef.current) {
        try {
          const r = endSession()
          if (r && typeof r.catch === 'function') r.catch(() => {})
        } catch { /* ignore — already disconnected */ }
        startedRef.current = false
      }
    }
  }, [endSession])

  return {
    connect,
    disconnect,
    status: conv.status,
    isSpeaking: !!conv.isSpeaking,
    isListening: !!conv.isListening,
    isMuted: !!conv.isMuted,
    setMuted: conv.setMuted,
    sendUserMessage: conv.sendUserMessage,
  }
}
