import { useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { generateSessionId } from '../lib/sessionId'

/**
 * FirstTimer — the desktop's signed-in, zero-entries screen (design doc §3).
 *
 * No empty journal is ever shown. Instead: one honest line naming the
 * promise, and the QR to begin the first session on the phone. The QR
 * encodes the same `?s=<id>` session-join URL the Stage pairing screen uses.
 */

const PAPER = '#F2EBD8'
const INK = '#1C1814'

export default function FirstTimer({ onSignOut, onSeed }) {
  const sessionId = useMemo(() => generateSessionId(), [])
  const joinUrl = `${window.location.origin}/?s=${sessionId}`
  const isDev = import.meta.env.DEV

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: PAPER,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          font: 'italic 26px Palatino, "Palatino Linotype", Georgia, serif',
          color: INK,
          maxWidth: 500,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        Each session leaves one mark. In time, this becomes the trace of you.
      </div>
      <div
        style={{
          marginTop: 42,
          padding: 18,
          background: '#fff',
          border: '1px solid rgba(28,24,20,0.14)',
          borderRadius: 4,
        }}
      >
        <QRCodeSVG value={joinUrl} size={172} fgColor={INK} bgColor="#fff" level="M" />
      </div>
      <div
        style={{
          marginTop: 20,
          font: '300 12px ui-monospace, SFMono-Regular, monospace',
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: 'rgba(28,24,20,0.5)',
        }}
      >
        scan with your phone to begin
      </div>
      <button
        onClick={onSignOut}
        style={{
          position: 'fixed',
          top: 22,
          right: 26,
          background: 'none',
          border: 'none',
          font: 'italic 13px Palatino, Georgia, serif',
          color: 'rgba(28,24,20,0.4)',
          cursor: 'pointer',
        }}
      >
        sign out
      </button>
      {isDev && (
        <button
          onClick={onSeed}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 26,
            background: 'none',
            border: 'none',
            font: 'italic 12px Palatino, Georgia, serif',
            color: 'rgba(28,24,20,0.3)',
            cursor: 'pointer',
          }}
        >
          seed sample entries (dev)
        </button>
      )}
    </div>
  )
}
