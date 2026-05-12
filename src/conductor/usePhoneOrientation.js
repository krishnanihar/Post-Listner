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

  // Beat / gesture-size signals from phone DeviceMotion. lastDownbeat is the
  // most recent fired event; consumers compare its timestamp against an
  // already-handled cursor to detect new beats.
  const lastDownbeat = useRef({ firedAt: 0, intensity: 0 })
  const gestureGain = useRef(0)
  const articulation = useRef(0)

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
        gestureGain.current = 0
        articulation.current = 0
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      })

      ws.addEventListener('error', () => {})

      ws.addEventListener('message', (e) => {
        try {
          const msg = JSON.parse(e.data)
          // Accept both the legacy 'orientation' messages and the new
          // 'gesture' messages from phone.js (which add downbeat,
          // gestureGain, articulation alongside the same q payload).
          const isMotion = (msg.type === 'orientation' || msg.type === 'gesture')
            && Array.isArray(msg.q) && msg.q.length === 4
          if (!isMotion) return

          // Timestamp samples locally. The phone-side `msg.t` is the phone's
          // performance.now(), which resets if the phone page reloads or a
          // different phone connects to the same relay. The OneEuroQuaternion
          // filter freezes when dt <= 0, so using msg.t can stall motion
          // after a reload. Local timestamps are guaranteed monotonic.
          const t = performance.now()
          const f = filter.current.filter(msg.q[0], msg.q[1], msg.q[2], msg.q[3], t)
          targetQuat.current.set(f.x, f.y, f.z, f.w)
          if (msg.raw) lastRaw.current = { ...msg.raw, t }
          if (typeof msg.calibrated === 'boolean' && msg.calibrated !== calibrated) {
            setCalibrated(msg.calibrated)
          }
          if (msg.downbeat && msg.downbeat.fired) {
            lastDownbeat.current = {
              firedAt: typeof msg.downbeat.t === 'number' ? msg.downbeat.t : t,
              intensity: typeof msg.downbeat.intensity === 'number'
                ? msg.downbeat.intensity : 1,
            }
          }
          if (typeof msg.gestureGain === 'number') gestureGain.current = msg.gestureGain
          if (typeof msg.articulation === 'number') articulation.current = msg.articulation
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
    lastDownbeat,
    gestureGain,
    articulation,
    advance,
  }
}
