import { motion } from 'framer-motion';

export default function EntryScreen({ avd, onStart, loading, loadProgress }) {
  if (!avd) {
    return (
      <div
        className="h-full w-full flex flex-col items-center justify-center px-8"
        style={{ background: 'var(--bg)' }}
      >
        <h1
          className="font-serif text-center mb-6"
          style={{ fontSize: '28px', color: 'var(--text)' }}
        >
          The Dissolution Chamber
        </h1>
        <p
          className="font-mono text-center mb-8"
          style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.8 }}
        >
          Complete PostListener first to receive your musical identity.
        </p>
        <a
          href="/"
          className="font-mono"
          style={{ fontSize: '12px', color: 'var(--accent)' }}
        >
          &larr; Go to PostListener
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="h-full w-full flex flex-col items-center justify-center px-8"
        style={{ background: 'var(--bg)' }}
      >
        <p
          className="font-mono mb-6"
          style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.15em' }}
        >
          PREPARING THE CHAMBER
        </p>
        <div
          className="w-48 h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--bg-subtle)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--accent)' }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(loadProgress * 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p
          className="font-mono mt-3"
          style={{ fontSize: '10px', color: 'var(--text-dim)' }}
        >
          {Math.round(loadProgress * 100)}%
        </p>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center px-8 select-none"
      style={{ background: 'var(--bg)', touchAction: 'manipulation' }}
    >
      <motion.h1
        className="font-serif text-center mb-4"
        style={{ fontSize: '32px', color: 'var(--text)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        The Dissolution Chamber
      </motion.h1>

      <motion.p
        className="font-serif text-center mb-2"
        style={{ fontSize: '16px', color: 'var(--text)', opacity: 0.6 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        Hold your phone. Find darkness. Close your eyes.
      </motion.p>

      <motion.p
        className="font-mono text-center mb-12"
        style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.8 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
      >
        Put on headphones. Turn off the lights. Lie down if you can.
      </motion.p>

      <motion.button
        className="font-serif"
        style={{
          fontSize: '20px',
          color: 'var(--accent)',
          background: 'none',
          border: '1px solid var(--accent-dim)',
          borderRadius: '50%',
          width: '100px',
          height: '100px',
          cursor: 'pointer',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        whileTap={{ scale: 0.95 }}
        onClick={onStart}
      >
        Enter
      </motion.button>
    </div>
  );
}
