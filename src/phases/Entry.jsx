import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'

export default function Entry({ onNext }) {
  const [expanding, setExpanding] = useState(false)

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
         style={{ touchAction: 'manipulation' }}>

      {/* Title */}
      <AnimatePresence>
        {!expanding && (
          <motion.div
            className="absolute"
            style={{ top: '35%' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
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

      {/* The Eye — pulsing amber circle */}
      <motion.div
        className="absolute cursor-pointer"
        style={{ bottom: '25%' }}
        onClick={handleTap}
        onTouchEnd={(e) => { e.preventDefault(); handleTap() }}
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
        <div
          className="rounded-full"
          style={{
            width: 'clamp(60px, 12vw, 80px)',
            height: 'clamp(60px, 12vw, 80px)',
            background: 'var(--accent)',
            boxShadow: '0 0 30px rgba(212, 160, 83, 0.3)',
          }}
        />
      </motion.div>
    </div>
  )
}
