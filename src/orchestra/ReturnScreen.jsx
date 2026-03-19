import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import RevealVisualizer from '../components/RevealVisualizer'
import { getCollective, addEntry } from '../chamber/data/CollectiveStore.js'

export default function ReturnScreen({ avd, onReturn }) {
  const [showButton, setShowButton] = useState(false)
  const addedRef = useRef(false)

  // Add user's AVD to collective store on mount
  useEffect(() => {
    if (!addedRef.current) {
      addedRef.current = true
      const { a, v, d } = avd.getAVD()
      addEntry({ arousal: a, valence: v, depth: d })
    }
  }, [avd])

  // Show return button after 15s
  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 15000)
    return () => clearTimeout(timer)
  }, [])

  const collective = getCollective()

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center select-none"
      style={{ position: 'relative', background: 'var(--bg)' }}
    >
      {/* User's visualization */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <RevealVisualizer
          avd={avd}
          stage="choices"
          audioElement={null}
        />
      </div>

      {/* Collective overlay (faint) */}
      {collective && (
        <div className="absolute inset-0" style={{ zIndex: 0, opacity: 0.3 }}>
          <RevealVisualizer
            avd={{
              getAVD: () => ({
                a: collective.mean.arousal,
                v: collective.mean.valence,
                d: collective.mean.depth,
              }),
              getPhaseData: () => ({}),
            }}
            stage="choices"
            audioElement={null}
          />
        </div>
      )}

      {/* Text and button */}
      <div
        className="relative text-center"
        style={{ zIndex: 1, marginTop: '60%' }}
      >
        <motion.p
          className="font-serif"
          style={{
            fontSize: 'clamp(16px, 4vw, 20px)',
            color: 'var(--accent)',
            opacity: 0.8,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 3, delay: 2 }}
        >
          You were always part of this.
        </motion.p>

        {showButton && (
          <motion.button
            className="font-serif mt-12"
            style={{
              fontSize: '16px',
              color: 'var(--text)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '12px 24px',
              minHeight: '44px',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
            whileTap={{ scale: 0.95 }}
            onClick={onReturn}
          >
            return
          </motion.button>
        )}
      </div>
    </div>
  )
}
