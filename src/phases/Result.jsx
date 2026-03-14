import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'

function generateSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function AVDBar({ label, value, delay }) {
  const barWidth = Math.round(value * 100)
  return (
    <motion.div
      className="flex items-center gap-4 font-mono"
      style={{ fontSize: '14px' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.6 }}
    >
      <span style={{ color: 'var(--text)', width: '20px' }}>{label}</span>
      <span style={{ color: 'var(--text-dim)', width: '36px' }}>{value.toFixed(2)}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--accent)' }}
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ delay: delay + 0.3, duration: 1, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

export default function Result({ avd, sessionData }) {
  const currentAVD = avd.getAVD()
  const prompt = avd.getPrompt()
  const phaseData = avd.getPhaseData()

  const session = useMemo(() => ({
    sessionId: generateSessionId(),
    timestamp: new Date().toISOString(),
    avd: currentAVD,
    phases: phaseData,
    selectedTrack: 'procedural',
    revealChoice: sessionData.revealChoice || 'show_me',
    sunoPrompt: prompt,
  }), [])

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('postlistener_session', JSON.stringify(session))
    // Also save to sessions array
    const sessions = JSON.parse(localStorage.getItem('postlistener_sessions') || '[]')
    sessions.push(session)
    localStorage.setItem('postlistener_sessions', JSON.stringify(sessions))
  }, [session])

  return (
    <div className="h-full w-full flex flex-col justify-center px-8 select-none"
         style={{ touchAction: 'manipulation' }}>

      {/* Title */}
      <motion.h2
        className="font-mono text-center mb-10"
        style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'var(--text-dim)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        YOUR MUSICAL IDENTITY
      </motion.h2>

      {/* AVD Bars */}
      <div className="max-w-sm mx-auto w-full space-y-4 mb-12">
        <AVDBar label="A" value={currentAVD.a} delay={0.3} />
        <AVDBar label="V" value={currentAVD.v} delay={0.5} />
        <AVDBar label="D" value={currentAVD.d} delay={0.7} />
      </div>

      {/* Prompt */}
      <motion.div
        className="max-w-sm mx-auto text-center mb-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      >
        <p className="font-serif" style={{ fontSize: '14px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
          &ldquo;{prompt}&rdquo;
        </p>
      </motion.div>

      {/* Dissolution Chamber link */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.8 }}
      >
        <button
          className="font-serif mb-4 block mx-auto"
          style={{
            fontSize: '16px',
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '12px 24px',
          }}
          onClick={() => {
            // Placeholder: navigate to dissolution chamber when URL is ready
            alert('Dissolution Chamber coming soon. Session data saved.')
          }}
        >
          &rarr; enter the dissolution chamber
        </button>
        <p className="font-mono" style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
          your profile has been saved
        </p>
      </motion.div>
    </div>
  )
}
