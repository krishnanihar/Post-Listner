import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import RelayClient from '../lib/relayClient.js'
import { generateSessionId } from '../lib/sessionId.js'
import StageCosmos from './StageCosmos.jsx'

/**
 * Stage — desktop landing for QR-paired conducting sessions.
 *
 * Three states:
 *   'waiting'  — QR code visible, no conductor connected
 *   'rite'     — phone connected, in phases 0..7 (pre-orchestra)
 *   'orchestra' — phone in Orchestra phase, cosmos canvas active (Step 7 wires this)
 */
export default function Stage() {
  const [stage, setStage] = useState('waiting')
  // Most recent FFT array from {type:'audio'} messages — passed to StageCosmos
  // for the cosmos canvas. Updated on every message during Orchestra phase.
  const [latestFreq, setLatestFreq] = useState(null)
  const sessionId = useMemo(() => generateSessionId(), [])
  const relayRef = useRef(null)
  // Latest conductor phase tracked in a ref — needed by onMessage callback
  // which closes over the initial render's state. State is for rendering;
  // ref is for the closure's latest-value reads.
  const conductorPhaseRef = useRef(null)

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_RELAY_URL || 'wss://localhost:8443'
    const client = new RelayClient({
      baseUrl,
      sessionId,
      role: 'viewer',
      onMessage: (msg) => {
        if (!msg || typeof msg !== 'object') return
        if (msg.type === 'phase') {
          conductorPhaseRef.current = msg.phase
          setStage(msg.phase === 'orchestra' ? 'orchestra' : 'rite')
        } else if (msg.type === 'conductor:lost') {
          setStage('waiting')
          conductorPhaseRef.current = null
        } else if (msg.type === 'conductor:resumed') {
          // Re-derive stage from last known conductor phase via the ref
          // (NOT the stale state captured at first render).
          setStage(conductorPhaseRef.current === 'orchestra' ? 'orchestra' : 'rite')
        } else if (msg.type === 'session:end') {
          // Normal rite completion — return to waiting state.
          setStage('waiting')
          conductorPhaseRef.current = null
        } else if (msg.type === 'audio' && Array.isArray(msg.freq)) {
          // FFT samples from the phone during Orchestra phase. Drives the
          // cosmos canvas visualization.
          setLatestFreq(msg.freq)
        }
      },
    })
    client.start()
    relayRef.current = client
    return () => client.stop()
  }, [sessionId])

  const joinUrl = useMemo(() => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://post-listner.com'
    return `${origin}/?s=${sessionId}`
  }, [sessionId])

  return (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{ background: '#F2EBD8' }}
    >
      <AnimatePresence mode="wait">
        {stage === 'waiting' && (
          <motion.div
            key="waiting"
            className="flex flex-col items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p
              className="font-serif italic"
              style={{
                fontSize: '28px',
                color: '#1C1814',
                marginBottom: 32,
                letterSpacing: '0.01em',
              }}
            >
              scan with your phone
            </p>
            <div
              style={{
                padding: 24,
                background: '#FFFFFF',
                borderRadius: 4,
                boxShadow: '0 8px 32px rgba(28, 24, 20, 0.08)',
              }}
            >
              <QRCodeSVG
                value={joinUrl}
                size={280}
                bgColor="#FFFFFF"
                fgColor="#1C1814"
                level="M"
              />
            </div>
            <p
              className="font-mono"
              style={{
                fontSize: '13px',
                color: '#1C1814',
                opacity: 0.55,
                marginTop: 32,
                letterSpacing: '0.08em',
              }}
            >
              {sessionId}
            </p>
          </motion.div>
        )}

        {stage === 'rite' && (
          <motion.div
            key="rite"
            className="flex flex-col items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          >
            <motion.div
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 12, height: 12, borderRadius: '50%',
                background: '#1C1814',
                marginBottom: 24,
              }}
            />
            <p
              className="font-serif italic"
              style={{ fontSize: '22px', color: '#1C1814', opacity: 0.7 }}
            >
              your conductor is in the rite
            </p>
          </motion.div>
        )}

        {stage === 'orchestra' && (
          <motion.div
            key="orchestra"
            className="h-full w-full"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
          >
            <StageCosmos sessionId={sessionId} latestFreq={latestFreq} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
