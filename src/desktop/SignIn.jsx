import { useState } from 'react'

/**
 * SignIn — the desktop's signed-out screen.
 *
 * Cream-paper aesthetic. One honest line about what the journal is, then a
 * single Google sign-in — no password, no signup wall (design doc §2: a wall
 * must never precede a first session).
 */

const PAPER = '#F2EBD8'
const INK = '#1C1814'

function GoogleG() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}

export default function SignIn({ onSignIn }) {
  const [busy, setBusy] = useState(false)
  const handle = () => {
    setBusy(true)
    onSignIn()
  }
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
          font: 'italic 44px Palatino, "Palatino Linotype", Georgia, serif',
          color: INK,
          letterSpacing: '0.03em',
        }}
      >
        the journal
      </div>
      <div
        style={{
          font: 'italic 18px Palatino, Georgia, serif',
          color: 'rgba(28,24,20,0.55)',
          marginTop: 18,
          maxWidth: 420,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        a record of who you were, and who you are becoming
      </div>
      <button
        onClick={handle}
        disabled={busy}
        style={{
          marginTop: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          background: '#fff',
          border: '1px solid rgba(28,24,20,0.22)',
          borderRadius: 3,
          padding: '12px 22px',
          cursor: busy ? 'default' : 'pointer',
          font: '500 14px Palatino, Georgia, serif',
          color: INK,
          opacity: busy ? 0.55 : 1,
        }}
      >
        <GoogleG />
        {busy ? 'opening Google…' : 'continue with Google'}
      </button>
    </div>
  )
}
