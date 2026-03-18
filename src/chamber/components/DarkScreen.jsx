import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DarkScreen({ phase, onTouchMove, onTouchStart, onTouchEnd }) {
  const [showHint, setShowHint] = useState(true);
  const wakeLockRef = useRef(null);

  // Request wake lock to prevent screen sleep
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {}
    }
    requestWakeLock();

    // Re-acquire on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release();
    };
  }, []);

  // Hide hint after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Phase 5: slowly brighten background
  const isSilence = phase === 'silence';

  const handleTouch = (e) => {
    if (!onTouchMove) return;
    const touch = e.touches[0];
    if (touch) {
      onTouchMove(
        touch.clientX / window.innerWidth,
        touch.clientY / window.innerHeight
      );
    }
  };

  return (
    <div
      className="h-full w-full fixed inset-0 select-none"
      style={{
        background: isSilence ? 'var(--bg)' : 'var(--bg-dark)',
        transition: isSilence ? 'background 15s ease-in' : 'none',
        touchAction: 'none',
      }}
      onTouchMove={handleTouch}
      onTouchStart={(e) => {
        handleTouch(e);
        onTouchStart?.();
      }}
      onTouchEnd={() => onTouchEnd?.()}
    >
      <AnimatePresence>
        {showHint && phase === 'intro' && (
          <motion.p
            className="font-serif absolute inset-0 flex items-center justify-center text-center px-8"
            style={{ fontSize: '16px', color: 'rgba(255,255,255,0.15)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
          >
            Close your eyes. Hold the phone.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
