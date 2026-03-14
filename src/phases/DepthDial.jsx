import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { audioEngine } from '../engine/audio'

const LAYER_LABELS = ['root', 'harmony', 'octave', 'texture', 'sub', 'drift', 'overtone', 'everything']

export default function DepthDial({ onNext, avd, inputMode }) {
  const [activeCount, setActiveCount] = useState(1)
  const [hoveredLayer, setHoveredLayer] = useState(null)
  const layerControl = useRef(null)
  const idleTimer = useRef(null)
  const phaseTimer = useRef(null)
  const prevCount = useRef(1)
  const containerRef = useRef(null)
  const activeCountRef = useRef(1)
  const maxReachedRef = useRef(1)
  const reEngagedRef = useRef(false)
  const finishedRef = useRef(false)
  const pointerDownRef = useRef(false)
  const isMouse = inputMode === 'mouse'

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    clearTimeout(phaseTimer.current)
    clearTimeout(idleTimer.current)
    if (layerControl.current) layerControl.current.stop()

    const finalLayer = activeCountRef.current
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
    }
  }, [])

  const resetIdleTimer = useCallback(() => {
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(finish, 5000)
  }, [finish])

  // Shared: update layer count
  const updateCount = useCallback((count) => {
    if (finishedRef.current) return
    count = Math.max(1, Math.min(8, count))
    activeCountRef.current = count
    setActiveCount(count)
    if (layerControl.current) layerControl.current.setActiveCount(count)

    if (count > maxReachedRef.current) maxReachedRef.current = count
    if (count > prevCount.current && prevCount.current < maxReachedRef.current - 1) {
      reEngagedRef.current = true
    }
    prevCount.current = count

    resetIdleTimer()
  }, [resetIdleTimer])

  // Touch: drag handler
  const handleDrag = useCallback((e) => {
    if (!e.touches && !pointerDownRef.current) return
    if (!containerRef.current || finishedRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const relY = 1 - (clientY - rect.top) / rect.height
    const count = Math.max(1, Math.min(8, Math.ceil(relY * 8)))
    updateCount(count)
  }, [updateCount])

  // Mouse: scroll wheel
  useEffect(() => {
    if (!isMouse || !containerRef.current) return
    const el = containerRef.current
    const handleWheel = (e) => {
      e.preventDefault()
      if (finishedRef.current) return
      const delta = e.deltaY < 0 ? 1 : -1
      updateCount(activeCountRef.current + delta)
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [isMouse, updateCount])

  // Mouse: click on a layer line to jump to it
  const handleLayerClick = useCallback((layerIndex) => {
    if (!isMouse) return
    updateCount(layerIndex + 1)
  }, [isMouse, updateCount])

  // Keyboard: arrow keys
  useEffect(() => {
    if (!isMouse) return
    const handleKey = (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); updateCount(activeCountRef.current + 1) }
      if (e.key === 'ArrowDown') { e.preventDefault(); updateCount(activeCountRef.current - 1) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isMouse, updateCount])

  const hintText = isMouse ? 'scroll or use arrow keys to add layers' : 'drag upward to add layers'

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
        className="flex-1 flex flex-col justify-end items-center px-8 py-12 sm:py-16 relative"
        {...(isMouse ? {} : {
          onPointerDown: () => { pointerDownRef.current = true },
          onPointerUp: () => { pointerDownRef.current = false },
          onPointerLeave: () => { pointerDownRef.current = false },
          onPointerMove: handleDrag,
          onTouchMove: handleDrag,
        })}
      >
        {/* Layer lines */}
        <div className="w-full max-w-xs sm:max-w-sm flex flex-col-reverse gap-3">
          {LAYER_LABELS.map((label, i) => {
            const isActive = i < activeCount
            const isHovered = hoveredLayer === i && isMouse
            return (
              <motion.div
                key={label}
                className="flex items-center gap-4"
                style={{ cursor: isMouse ? 'pointer' : 'default' }}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: isActive ? 1 : isHovered ? 0.5 : 0.15,
                }}
                transition={{ duration: 0.3 }}
                onClick={() => handleLayerClick(i)}
                onMouseEnter={isMouse ? () => setHoveredLayer(i) : undefined}
                onMouseLeave={isMouse ? () => setHoveredLayer(null) : undefined}
              >
                {/* Line */}
                <motion.div
                  className="flex-1 relative"
                  style={{ height: isHovered ? 3 : 2 }}
                >
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: isActive ? 'var(--accent)' : isHovered ? 'var(--accent)' : 'var(--text-dim)' }}
                    animate={isActive ? {
                      scaleX: [1, 1.02, 1],
                      opacity: [0.8, 1, 0.8],
                    } : {}}
                    transition={isActive ? {
                      duration: 1.5 + i * 0.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    } : {}}
                  />
                </motion.div>
                {/* Label */}
                <motion.span
                  className="font-mono w-20 text-right"
                  style={{
                    fontSize: '10px',
                    color: isActive || isHovered ? 'var(--accent)' : 'var(--text-dim)',
                  }}
                  animate={{ opacity: isActive ? 1 : isHovered ? 0.7 : 0.3 }}
                >
                  {label}
                </motion.span>
              </motion.div>
            )
          })}
        </div>

        {/* Hint */}
        <motion.p
          className="font-mono text-center mt-8"
          style={{ fontSize: '10px', color: 'var(--text-dim)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 1 }}
        >
          {hintText}
        </motion.p>
      </div>
    </div>
  )
}
