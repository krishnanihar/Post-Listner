import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'

function makeParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 2,
    opacity: 0.15 + Math.random() * 0.2,
    driftX: (Math.random() - 0.5) * 40,
    driftY: (Math.random() - 0.5) * 30,
    duration: 8 + Math.random() * 7,
  }))
}

export default function Entry({ onNext }) {
  const [expanding, setExpanding] = useState(false)
  const particles = useMemo(() => makeParticles(20), [])

  const handleTap = () => {
    if (expanding) return
    audioEngine.init()
    audioEngine.resume()
    // Play a soft welcome tone
    audioEngine.playTone(220, 'sine', 1.5, 0, 0.1)
    setExpanding(true)
    setTimeout(() => onNext(), 1000)
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center relative select-none"
         style={{ touchAction: 'none' }}>

      {/* Floating particle field */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.3 }}>
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              background: 'var(--accent)',
            }}
            animate={{
              x: [0, p.driftX, -p.driftX * 0.6, 0],
              y: [0, p.driftY, -p.driftY * 0.4, 0],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Title */}
      <AnimatePresence>
        {!expanding && (
          <motion.div
            className="absolute"
            style={{ top: '25%' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Headphones prompt */}
            <motion.div
              className="flex items-center justify-center gap-2 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
              <span className="font-mono"
                    style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                wear headphones
              </span>
            </motion.div>

            <h1 className="font-serif text-center leading-none"
                style={{
                  fontSize: 'clamp(36px, 10vw, 56px)',
                  letterSpacing: '0.2em',
                  color: 'var(--text)',
                }}>
              POST<br />LISTENER
            </h1>
            <p className="font-mono text-center mt-6"
               style={{
                 fontSize: '11px',
                 color: 'var(--text-dim)',
                 letterSpacing: '0.1em',
               }}>
              a musical identity instrument
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Eye — pulsing amber circle with radial glow */}
      <motion.div
        className="absolute cursor-pointer"
        style={{ bottom: '25%' }}
        onClick={handleTap}
        whileTap={{ scale: 0.95 }}
        animate={expanding ? {
          scale: 30,
          opacity: 0,
        } : {
          scale: [1, 1.03, 1],
        }}
        transition={expanding ? {
          duration: 1,
          ease: 'easeOut',
        } : {
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Radial glow behind eye */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: '200%',
            height: '200%',
            top: '-50%',
            left: '-50%',
            background: 'radial-gradient(circle, rgba(212,160,83,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="rounded-full relative"
          style={{
            width: 'clamp(60px, 12vw, 80px)',
            height: 'clamp(60px, 12vw, 80px)',
            background: 'var(--accent)',
            boxShadow: '0 0 30px rgba(212, 160, 83, 0.3)',
          }}
        />
      </motion.div>

      {/* Tap hint */}
      <AnimatePresence>
        {!expanding && (
          <motion.p
            className="absolute font-mono"
            style={{ bottom: '15%', fontSize: '11px', color: 'var(--text-dim)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0.4, 0.6] }}
            exit={{ opacity: 0 }}
            transition={{ delay: 1.2, duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            tap to begin
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
