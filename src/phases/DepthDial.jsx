import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'

const LAYER_LABELS = ['root', 'harmony', 'octave', 'texture', 'sub', 'drift', 'overtone', 'everything']

export default function DepthDial({ onNext, avd, inputMode }) {
  const [lockedCount, setLockedCount] = useState(1)
  const [hoverCount, setHoverCount] = useState(null)
  const [justLocked, setJustLocked] = useState(null) // flash feedback on click
  const [idleCountdown, setIdleCountdown] = useState(false) // show countdown bar
  const layerControl = useRef(null)
  const idleTimer = useRef(null)
  const phaseTimer = useRef(null)
  const prevCount = useRef(1)
  const containerRef = useRef(null)
  const lockedCountRef = useRef(1)
  const maxReachedRef = useRef(1)
  const reEngagedRef = useRef(false)
  const finishedRef = useRef(false)
  const pointerDownRef = useRef(false)
  const isMouse = inputMode === 'mouse'

  // The displayed active count: hover preview or locked value
  const displayCount = isMouse ? (hoverCount ?? lockedCount) : lockedCount

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    clearTimeout(phaseTimer.current)
    clearTimeout(idleTimer.current)
    if (layerControl.current) layerControl.current.stop()

    const finalLayer = lockedCountRef.current
    const maxLayer = maxReachedRef.current
    const reEngaged = reEngagedRef.current
    let d = (finalLayer - 1) / 7
    if (reEngaged) d = Math.min(1, d + 0.1)

    avd.setDepth(d)
    avd.setPhaseData('depth', { finalLayer, maxLayer, reEngaged })
    onNext({ depth: { finalLayer, maxLayer, reEngaged } })
  }, [avd, onNext])

  useEffect(() => {
    layerControl.current = audioEngine.playLayeredBuild(8)
    layerControl.current.setActiveCount(1)

    phaseTimer.current = setTimeout(finish, 45000)

    return () => {
      if (layerControl.current) layerControl.current.stop()
      clearTimeout(phaseTimer.current)
      clearTimeout(idleTimer.current)
      clearTimeout(idleCountdownTimer.current)
    }
  }, [])

  const idleCountdownTimer = useRef(null)

  const resetIdleTimer = useCallback(() => {
    clearTimeout(idleTimer.current)
    clearTimeout(idleCountdownTimer.current)
    setIdleCountdown(false)
    // Show countdown immediately, finish after 5s
    setIdleCountdown(true)
    idleTimer.current = setTimeout(finish, 5000)
  }, [finish])

  // Commit a locked count (click, scroll, keyboard)
  const commitCount = useCallback((count) => {
    if (finishedRef.current) return
    count = Math.max(1, Math.min(8, count))
    lockedCountRef.current = count
    setLockedCount(count)
    if (layerControl.current) layerControl.current.setActiveCount(count)

    if (count > maxReachedRef.current) maxReachedRef.current = count
    if (count > prevCount.current && prevCount.current < maxReachedRef.current - 1) {
      reEngagedRef.current = true
    }
    prevCount.current = count

    // Flash feedback
    setJustLocked(count)
    setTimeout(() => setJustLocked(null), 400)

    resetIdleTimer()
  }, [resetIdleTimer])

  // Preview count on hover (audio follows hover)
  const previewCount = useCallback((count) => {
    if (finishedRef.current) return
    count = Math.max(1, Math.min(8, count))
    setHoverCount(count)
    if (layerControl.current) layerControl.current.setActiveCount(count)
  }, [])

  // Revert audio to locked count when hover ends
  const clearPreview = useCallback(() => {
    setHoverCount(null)
    if (layerControl.current) layerControl.current.setActiveCount(lockedCountRef.current)
  }, [])

  // Touch: drag handler
  const handleDrag = useCallback((e) => {
    if (!e.touches && !pointerDownRef.current) return
    if (!containerRef.current || finishedRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const relY = 1 - (clientY - rect.top) / rect.height
    const count = Math.max(1, Math.min(8, Math.ceil(relY * 8)))
    commitCount(count)
  }, [commitCount])

  // Mouse: scroll wheel (fine-tune locked count)
  useEffect(() => {
    if (!isMouse || !containerRef.current) return
    const el = containerRef.current
    const handleWheel = (e) => {
      e.preventDefault()
      if (finishedRef.current) return
      const delta = e.deltaY < 0 ? 1 : -1
      commitCount(lockedCountRef.current + delta)
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [isMouse, commitCount])

  // Mouse: hover over a layer to preview
  const handleLayerHover = useCallback((layerIndex) => {
    if (!isMouse) return
    previewCount(layerIndex + 1)
  }, [isMouse, previewCount])

  // Mouse: click to lock
  const handleLayerClick = useCallback((layerIndex) => {
    if (!isMouse) return
    commitCount(layerIndex + 1)
  }, [isMouse, commitCount])

  // Keyboard: arrow keys
  useEffect(() => {
    if (!isMouse) return
    const handleKey = (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); commitCount(lockedCountRef.current + 1) }
      if (e.key === 'ArrowDown') { e.preventDefault(); commitCount(lockedCountRef.current - 1) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isMouse, commitCount])

  const hintText = isMouse ? 'hover to explore · click to set depth' : 'drag upward to add layers'

  return (
    <div className="h-full w-full flex flex-col select-none" style={{ touchAction: 'none' }}>
      {/* Header */}
      <div className="px-6 pt-6 sm:px-8 sm:pt-8">
        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          02 — THE DEPTH DIAL
        </span>
      </div>

      {/* Interaction area */}
      <div
        ref={containerRef}
        className="flex-1 flex flex-col justify-center items-center px-8 relative"
        onMouseLeave={isMouse ? clearPreview : undefined}
        {...(isMouse ? {} : {
          onPointerDown: () => { pointerDownRef.current = true },
          onPointerUp: () => { pointerDownRef.current = false },
          onPointerLeave: () => { pointerDownRef.current = false },
          onPointerMove: handleDrag,
          onTouchMove: handleDrag,
        })}
      >
        {/* Layer lines */}
        <div className="w-full flex flex-col-reverse gap-5 sm:gap-6" style={{ maxWidth: '60vw' }}>
          {LAYER_LABELS.map((label, i) => {
            const isActive = i < displayCount
            const isHovered = hoverCount !== null && i < hoverCount && i >= lockedCount
            const isLocked = i < lockedCount
            const isFlash = justLocked !== null && i < justLocked

            return (
              <motion.div
                key={label}
                className="flex items-center gap-5"
                style={{ cursor: isMouse ? 'pointer' : 'default' }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                onClick={() => handleLayerClick(i)}
                onMouseEnter={() => handleLayerHover(i)}
              >
                {/* Label — left side */}
                <motion.span
                  className="font-mono text-right"
                  style={{
                    fontSize: '13px',
                    width: '90px',
                    letterSpacing: '0.05em',
                    color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                  }}
                  animate={{
                    opacity: isActive ? 1 : 0.25,
                    scale: isActive ? 1.02 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {label}
                </motion.span>

                {/* Line */}
                <motion.div
                  className="flex-1 relative"
                  style={{
                    height: isActive ? 4 : 3,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      background: isActive ? 'var(--accent)' : 'var(--text-dim)',
                      borderRadius: 2,
                      boxShadow: isActive
                        ? '0 0 12px rgba(212, 160, 83, 0.4), 0 0 4px rgba(212, 160, 83, 0.2)'
                        : 'none',
                    }}
                    animate={isLocked && !isFlash ? {
                      scaleX: [1, 1.01, 1],
                      opacity: [0.85, 1, 0.85],
                    } : isHovered ? {
                      opacity: 0.6,
                    } : isFlash ? {
                      opacity: [1, 0.6, 1],
                    } : {
                      opacity: isActive ? 0.5 : 0.12,
                    }}
                    transition={isLocked ? {
                      duration: 1.5 + i * 0.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    } : isFlash ? {
                      duration: 0.3,
                    } : {
                      duration: 0.2,
                    }}
                  />
                </motion.div>

                {/* Layer number — right side */}
                <motion.span
                  className="font-mono"
                  style={{
                    fontSize: '10px',
                    width: '20px',
                    color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                  }}
                  animate={{ opacity: isActive ? 0.6 : 0.15 }}
                  transition={{ duration: 0.2 }}
                >
                  {String(i + 1).padStart(2, '0')}
                </motion.span>
              </motion.div>
            )
          })}
        </div>

        {/* Hint */}
        <motion.p
          className="font-mono text-center mt-10"
          style={{ fontSize: '11px', color: 'var(--text-dim)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1.5 }}
        >
          {hintText}
        </motion.p>

        {/* Idle countdown bar */}
        <AnimatePresence>
          {idleCountdown && (
            <motion.div
              className="mt-6 flex flex-col items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-dim)', opacity: 0.5 }}>
                continuing...
              </span>
              <div style={{ width: 120, height: 2, background: 'var(--text-dim)', borderRadius: 1, opacity: 0.2, overflow: 'hidden' }}>
                <motion.div
                  style={{ height: '100%', background: 'var(--accent)', borderRadius: 1 }}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 5, ease: 'linear' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
