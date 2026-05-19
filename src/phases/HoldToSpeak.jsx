import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COLORS, FONTS } from '../score/tokens'

// Press-and-hold-to-speak button for the Admirer phase. Captures audio
// only while held; the mic is muted otherwise. Holding while the agent
// is speaking interrupts (ElevenLabs barge-in handles this natively).
//
// Props:
//   onHoldStart()  — called on pointer-down. Unmute the mic here.
//   onHoldEnd()    — called on pointer-up / cancel / leave. Mute here.
//   isAgentSpeaking — when true, the button shows it would interrupt.
//   disabled       — true while still connecting or disconnected.
export default function HoldToSpeak({
  onHoldStart,
  onHoldEnd,
  isAgentSpeaking = false,
  disabled = false,
}) {
  const [held, setHeld] = useState(false)
  const heldRef = useRef(false)

  const start = useCallback((e) => {
    if (disabled) return
    e?.preventDefault?.()
    if (heldRef.current) return
    heldRef.current = true
    setHeld(true)
    onHoldStart?.()
  }, [disabled, onHoldStart])

  const end = useCallback((e) => {
    e?.preventDefault?.()
    if (!heldRef.current) return
    heldRef.current = false
    setHeld(false)
    onHoldEnd?.()
  }, [onHoldEnd])

  // Safety: if the component unmounts mid-hold, release.
  useEffect(() => {
    return () => {
      if (heldRef.current) {
        heldRef.current = false
        try { onHoldEnd?.() } catch { /* ignore */ }
      }
    }
  }, [onHoldEnd])

  const label = disabled
    ? '…'
    : held
      ? 'I’m listening'
      : isAgentSpeaking
        ? 'hold to interrupt'
        : 'hold to speak'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        userSelect: 'none',
      }}
    >
      {/* The button itself */}
      <motion.button
        type="button"
        disabled={disabled}
        onPointerDown={start}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={(e) => { if (heldRef.current) end(e) }}
        onContextMenu={(e) => e.preventDefault()}
        animate={{
          backgroundColor: held ? COLORS.scoreAmber : 'transparent',
          borderColor: held ? COLORS.scoreAmber : COLORS.inkCreamSecondary,
          scale: held ? 0.97 : 1,
        }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          width: 132,
          height: 132,
          borderRadius: '50%',
          border: '1.5px solid',
          background: 'transparent',
          cursor: disabled ? 'default' : 'pointer',
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          opacity: disabled ? 0.35 : 1,
          color: held ? COLORS.paperCream : COLORS.inkCream,
          fontFamily: FONTS.serif,
          fontStyle: 'italic',
          fontSize: 14,
          letterSpacing: 0.2,
          lineHeight: 1.2,
          transition: 'color 0.18s ease-out',
        }}
      >
        {label}
      </motion.button>

      {/* Waveform line, only when held. Three small bars that pulse. */}
      <AnimatePresence>
        {held && (
          <motion.div
            key="waveform"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              height: 14,
            }}
            aria-hidden
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                style={{
                  display: 'inline-block',
                  width: 2,
                  background: COLORS.scoreAmber,
                  borderRadius: 1,
                }}
                animate={{ height: [4, 12, 4] }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.12,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
