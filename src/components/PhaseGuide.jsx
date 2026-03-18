import { motion } from 'framer-motion'

export default function PhaseGuide({ title, body, touchBody, phaseNumber, onDismiss, inputMode }) {
  const isMouse = inputMode === 'mouse'
  const displayBody = (!isMouse && touchBody) ? touchBody : body

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center select-none"
      style={{ background: 'var(--bg)', cursor: 'pointer' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      onClick={onDismiss}
    >
      {/* Phase number */}
      <motion.span
        className="font-mono"
        style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.1em' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.6, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {phaseNumber}
      </motion.span>

      {/* Title */}
      <motion.h2
        className="font-serif mt-4"
        style={{
          fontSize: 'clamp(24px, 6vw, 32px)',
          color: 'var(--accent)',
          textAlign: 'center',
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        {title}
      </motion.h2>

      {/* Body */}
      <motion.p
        className="font-mono mt-6 px-8"
        style={{
          fontSize: '12px',
          color: 'var(--text-dim)',
          textAlign: 'center',
          maxWidth: '340px',
          lineHeight: '1.8',
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.7, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        {displayBody}
      </motion.p>

      {/* Dismiss hint */}
      <motion.span
        className="font-mono absolute"
        style={{
          bottom: '15%',
          fontSize: '11px',
          color: 'var(--accent)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0.3, 0.5] }}
        transition={{ delay: 0.8, duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {isMouse ? 'click to begin' : 'tap to begin'}
      </motion.span>
    </motion.div>
  )
}
