import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OneEuroQuaternion } from './oneEuroFilter'

const SMOOTH_TIME_CONST = 0.08      // seconds; smaller = snappier
const RECONNECT_DELAY_MS = 1000

// 1€ filter parameters tuned per gesture-felt-agency-phone-as-baton.md §3:
// "The tuning procedure: set beta to zero, reduce min_cutoff until jitter at
// rest is acceptable, then increase beta until lag during fast movement is
// acceptable. Recommended starting values: min_cutoff = 1.0 Hz, beta = 0.007."
const FILTER_MIN_CUTOFF = 1.0
const FILTER_BETA = 0.007

function defaultRelayUrl() {
  if (typeof window === 'undefined') return ''
  const host = window.location.hostname || 'localhost'
  return `wss://${host}:8443/?role=desktop`
}

export function usePhoneOrientation(url) {
  const relayUrl = url ?? defaultRelayUrl()

  const [connected, setConnected] = useState(false)
  const [calibrated, setCalibrated] = useState(false)

  const targetQuat = useRef(new THREE.Quaternion())
  const currentQuat = useRef(new THREE.Quaternion())
  const lastRaw = useRef({ alpha: 0, beta: 0, gamma: 0, t: 0 })
  const filter = useRef(new OneEuroQuaternion({
    minCutoff: FILTER_MIN_CUTOFF,
    beta: FILTER_BETA,
  }))

  useEffect(() => {
    let ws = null
    let cancelled = false
    let reconnectTimer = null

    function connect() {
      if (cancelled) return
      try {
        ws = new WebSocket(relayUrl)
      } catch {
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
        return
      }

      ws.addEventListener('open', () => {
        if (!cancelled) setConnected(true)
      })

      ws.addEventListener('close', () => {
        if (cancelled) return
        setConnected(false)
        // Reset the filter so a long gap doesn't poison the next stream
        filter.current.reset()
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      })

      ws.addEventListener('error', () => {})

      ws.addEventListener('message', (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'orientation' && Array.isArray(msg.q) && msg.q.length === 4) {
            const t = typeof msg.t === 'number' ? msg.t : performance.now()
            const f = filter.current.filter(msg.q[0], msg.q[1], msg.q[2], msg.q[3], t)
            targetQuat.current.set(f.x, f.y, f.z, f.w)
            if (msg.raw) lastRaw.current = { ...msg.raw, t }
            if (typeof msg.calibrated === 'boolean' && msg.calibrated !== calibrated) {
              setCalibrated(msg.calibrated)
            }
          }
        } catch {}
      })
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws) ws.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayUrl])

  function advance(delta) {
    const factor = 1 - Math.exp(-delta / SMOOTH_TIME_CONST)
    currentQuat.current.slerp(targetQuat.current, factor)
  }

  return {
    connected,
    calibrated,
    targetQuat,
    currentQuat,
    lastRaw,
    advance,
  }
}
