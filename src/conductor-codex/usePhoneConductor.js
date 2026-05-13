import { useEffect, useRef, useState } from 'react'
import RelayClient from '../lib/relayClient'
import {
  applyRelayMessage,
  createConductorState,
  snapshotFromState,
} from './motion'

/**
 * usePhoneConductor — desktop-side viewer hook.
 *
 * Connects to the relay as 'viewer' for the given sessionId. Decodes
 * incoming conductor messages via applyRelayMessage. Publishes a snapshot
 * to React state at ~8 Hz so renders aren't gated by message rate.
 *
 * @param {string} sessionId — the Crockford base32 ID being broadcast.
 *                             If null/undefined, the hook is inactive.
 */
export function usePhoneConductor(sessionId) {
  const stateRef = useRef(createConductorState())
  const [snapshot, setSnapshot] = useState(() =>
    snapshotFromState(createConductorState(), 0),
  )

  useEffect(() => {
    if (!sessionId) return

    const publish = () => {
      setSnapshot(snapshotFromState(stateRef.current, performance.now()))
    }

    const baseUrl = import.meta.env.VITE_RELAY_URL || 'wss://localhost:8443'
    const client = new RelayClient({
      baseUrl,
      sessionId,
      role: 'viewer',
      onOpen: () => {
        stateRef.current.status = 'connected'
        stateRef.current.connected = true
        publish()
      },
      onClose: () => {
        stateRef.current.status = 'disconnected'
        stateRef.current.connected = false
        publish()
      },
      onError: () => {
        stateRef.current.status = 'error'
        stateRef.current.lastError = 'relay unavailable'
        publish()
      },
      onMessage: (message) => {
        if (message && (message.type === 'orientation' || message.type === 'gesture')) {
          applyRelayMessage(stateRef.current, message, performance.now())
        }
      },
    })

    client.start()
    const uiTimer = window.setInterval(publish, 120)

    return () => {
      client.stop()
      window.clearInterval(uiTimer)
    }
  }, [sessionId])

  return { stateRef, snapshot }
}
