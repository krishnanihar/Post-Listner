import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import RelayClient from '../lib/relayClient.js'
import { generateSessionId } from '../lib/sessionId.js'
import { isEntryMessage } from '../lib/relayProtocol.js'
import { createEntry } from '../lib/entriesRepo.js'

/**
 * useRiteSession — the desktop's relay-viewer side (spec §5.2).
 *
 * Opens one viewer connection on a generated session id (one per page load —
 * the QR shown by FirstTimer and the Journal both encode it). Runs the
 * riteStage machine and, when the phone relays its entry at settle, writes
 * the Supabase row and calls onEntryWritten so the caller can refetch.
 *
 *   riteStage: 'idle' | 'rite' | 'orchestra' | 'settling' | 'settled'
 *
 * 'settling' covers the brief window between the entry message and the row
 * write resolving; 'settled' means the row is written and newEntryId is set.
 *
 * The viewer connects regardless of auth state — the relay is Supabase-
 * independent, so the no-backend dev fallback still mirrors a rite. Only the
 * DB write is gated on userId.
 */
export function useRiteSession({ userId, onEntryWritten }) {
  const sessionId = useMemo(() => generateSessionId(), [])
  const [riteStage, setRiteStage] = useState('idle')
  const [latestFreq, setLatestFreq] = useState(null)
  const [newEntryId, setNewEntryId] = useState(null)

  // latest values for the message callback (which closes over first render)
  const userIdRef = useRef(userId)
  const onWrittenRef = useRef(onEntryWritten)
  useLayoutEffect(() => {
    userIdRef.current = userId
    onWrittenRef.current = onEntryWritten
  })
  const conductorPhaseRef = useRef(null)
  // exactly one entry is written per rite — re-armed when the next rite
  // begins (phase:admirer). Guards against a duplicated 'entry' message.
  const entryHandledRef = useRef(false)

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
          // a new rite is beginning — re-arm the entry-write guard
          if (msg.phase === 'admirer') entryHandledRef.current = false
          setRiteStage((s) => {
            if (msg.phase === 'orchestra') return 'orchestra'
            if (msg.phase === 'admirer') return 'rite'
            // a trailing 'entry' phase after settle is the phone returning
            // home — keep 'settling'/'settled' so the new page stays; the
            // initial pairing 'entry' (stage 'idle') stays idle until the
            // rite begins
            if (msg.phase === 'entry') {
              return s === 'settled' || s === 'settling' ? s : 'idle'
            }
            return s // 'settle' — driven by the entry message, not the phase
          })
          return
        }

        if (msg.type === 'audio' && Array.isArray(msg.freq)) {
          setLatestFreq(msg.freq)
          return
        }

        if (isEntryMessage(msg)) {
          if (entryHandledRef.current) return // dedupe — already handled this rite
          entryHandledRef.current = true
          setRiteStage('settling')
          const uid = userIdRef.current
          if (!uid) {
            // no account to write to (the no-backend dev fallback) — recover
            setRiteStage('idle')
            return
          }
          createEntry(uid, { song: msg.song, summary: msg.summary, glyph: msg.glyph })
            .then((row) => {
              if (row) {
                setNewEntryId(String(row.id))
                setRiteStage('settled')
                onWrittenRef.current?.()
              } else {
                // write failed — recover instead of stranding the desktop on
                // the settled loading card
                entryHandledRef.current = false
                setRiteStage('idle')
              }
            })
            .catch(() => {
              // an unexpected throw — recover the same way as a failed write
              entryHandledRef.current = false
              setRiteStage('idle')
            })
          return
        }

        if (msg.type === 'session:end') {
          // the rite is genuinely over — clear the tracked conductor phase
          conductorPhaseRef.current = null
          setRiteStage((s) => (s === 'settled' || s === 'settling' ? s : 'idle'))
          return
        }

        if (msg.type === 'conductor:lost') {
          // a transient disconnect — keep conductorPhaseRef so a resume within
          // the grace window can restore the correct stage (e.g. orchestra)
          setRiteStage((s) => (s === 'settled' || s === 'settling' ? s : 'idle'))
          return
        }

        if (msg.type === 'conductor:resumed') {
          setRiteStage((s) => {
            if (s === 'settled' || s === 'settling') return s
            return conductorPhaseRef.current === 'orchestra' ? 'orchestra' : 'rite'
          })
        }
      },
    })
    client.start()
    return () => client.stop()
  }, [sessionId])

  return { sessionId, riteStage, latestFreq, newEntryId }
}
