import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useConversationControls, useConversationStatus } from '@elevenlabs/react'
import { buildAdmirerTools } from '../lib/admirerTools.js'
import { buildDynamicVariables } from '../lib/sessionStore.js'

// Thin wrapper around the SDK. Each phase calls connect() once on mount
// and disconnect() on unmount. The phase passes its own callbacks for
// onPlayFragment/onStartGeneration/onCommitEntry so it can react to
// tool invocations (e.g. start the StemPlayer, advance to orchestra).
//
// sessionStage:
//   'opening' — Admirer phase: arrival + biography + locate + generation
//   'closing' — Settle phase: brief settle/close
//
// The agent reads sessionStage as a dynamic variable so its system prompt
// can branch on it (see admirer-agent-dashboard.md).
export function useAdmirerAgent({ sessionStage = 'opening', callbacks = {} } = {}) {
  const { startSession, endSession } = useConversationControls()
  const { status } = useConversationStatus()
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
  }, [sessionStage, startSession])

  const disconnect = useCallback(async () => {
    if (!startedRef.current) return
    startedRef.current = false
    try { await endSession() } catch (e) { console.warn('[admirer] endSession threw:', e) }
  }, [endSession])

  // Auto-cleanup if the host unmounts mid-session.
  useEffect(() => {
    return () => {
      if (startedRef.current) {
        endSession().catch(() => {})
        startedRef.current = false
      }
    }
  }, [endSession])

  return { connect, disconnect, status }
}
