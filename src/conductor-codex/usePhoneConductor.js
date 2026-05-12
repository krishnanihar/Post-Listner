import { useEffect, useRef, useState } from 'react'
import {
  RELAY_URL,
  applyRelayMessage,
  createConductorState,
  snapshotFromState,
} from './motion'

export function usePhoneConductor() {
  const stateRef = useRef(createConductorState())
  const [snapshot, setSnapshot] = useState(() => snapshotFromState(createConductorState(), 0))

  useEffect(() => {
    let cancelled = false
    let ws = null
    let reconnectTimer = 0

    const publish = () => {
      if (!cancelled) {
        setSnapshot(snapshotFromState(stateRef.current, performance.now()))
      }
    }

    const connect = () => {
      if (cancelled) return

      stateRef.current.status = 'connecting'
      stateRef.current.lastError = ''
      publish()

      try {
        ws = new WebSocket(RELAY_URL)
      } catch (error) {
        stateRef.current.status = 'error'
        stateRef.current.lastError = error?.message || String(error)
        publish()
        reconnectTimer = window.setTimeout(connect, 1600)
        return
      }

      ws.addEventListener('open', () => {
        stateRef.current.connected = true
        stateRef.current.status = 'connected'
        stateRef.current.lastError = ''
        publish()
      })

      ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message && (message.type === 'orientation' || message.type === 'gesture')) {
            applyRelayMessage(stateRef.current, message, performance.now())
          }
        } catch (error) {
          stateRef.current.lastError = error?.message || String(error)
        }
      })

      ws.addEventListener('close', () => {
        if (cancelled) return
        stateRef.current.connected = false
        stateRef.current.status = 'disconnected'
        publish()
        reconnectTimer = window.setTimeout(connect, 1600)
      })

      ws.addEventListener('error', () => {
        stateRef.current.connected = false
        stateRef.current.status = 'error'
        stateRef.current.lastError = 'relay unavailable'
        publish()
      })
    }

    connect()
    const uiTimer = window.setInterval(publish, 120)

    return () => {
      cancelled = true
      window.clearInterval(uiTimer)
      window.clearTimeout(reconnectTimer)
      if (ws) ws.close()
    }
  }, [])

  return { stateRef, snapshot }
}
