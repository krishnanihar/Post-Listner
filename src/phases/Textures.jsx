import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../engine/audio'
import PhaseGuide from '../components/PhaseGuide'

const TEXTURE_DATA = [
  { name: 'strings',     coord: { a: 0.25, v: 0.70, d: 0.65 }, pattern: 'wavy' },
  { name: 'synthesizer', coord: { a: 0.35, v: 0.40, d: 0.80 }, pattern: 'flow' },
  { name: 'distortion',  coord: { a: 0.85, v: 0.20, d: 0.30 }, pattern: 'jagged' },
  { name: 'keys',        coord: { a: 0.30, v: 0.75, d: 0.45 }, pattern: 'dots' },
  { name: 'voice',       coord: { a: 0.20, v: 0.55, d: 0.90 }, pattern: 'circle' },
  { name: 'glitch',      coord: { a: 0.75, v: 0.25, d: 0.55 }, pattern: 'grid' },
  { name: 'rhythm',      coord: { a: 0.80, v: 0.60, d: 0.25 }, pattern: 'lines' },
  { name: 'field',       coord: { a: 0.10, v: 0.50, d: 0.70 }, pattern: 'noise' },
]

// Pre-computed random positions for noise pattern (fixes re-render randomness bug)
const NOISE_COORDS = Array.from({ length: 20 }, (_, i) => ({
  cx: 10 + ((i * 37 + 13) % 40),
  cy: 10 + ((i * 23 + 7) % 40),
  r: 0.5 + ((i * 17) % 10) / 10,
  opacity: 0.3 + ((i * 13) % 5) / 10,
}))

const loopTransition = (duration, delay = 0) => ({
  repeat: Infinity,
  repeatType: 'mirror',
  duration,
  delay,
  ease: 'easeInOut',
})

const PATTERN_RENDERERS = {
  wavy: (isActive) => (
    <motion.svg
      viewBox="0 0 60 60"
      className="absolute inset-0 w-full h-full"
      animate={{ opacity: isActive ? 0.45 : 0.20 }}
      transition={{ duration: 0.3 }}
    >
      {[15, 25, 35, 45].map((y, i) => (
        <motion.path
          key={y}
          d={`M0 ${y} Q15 ${y - 5} 30 ${y} Q45 ${y + 5} 60 ${y}`}
          stroke="var(--accent)"
          fill="none"
          strokeWidth="0.5"
          animate={isActive ? { translateY: [0, -3, 0, 3, 0] } : { translateY: 0 }}
          transition={isActive ? loopTransition(2, i * 0.25) : { duration: 0.3 }}
        />
      ))}
    </motion.svg>
  ),
  flow: (isActive) => (
    <motion.svg
      viewBox="0 0 60 60"
      className="absolute inset-0 w-full h-full"
      animate={{ opacity: isActive ? 0.45 : 0.20 }}
      transition={{ duration: 0.3 }}
    >
      {[
        { r: 8, sw: 0.5, delay: 0 },
        { r: 15, sw: 0.3, delay: 0.3 },
        { r: 22, sw: 0.2, delay: 0.6 },
      ].map(({ r, sw, delay }) => (
        <motion.circle
          key={r}
          cx="30"
          cy="30"
          r={r}
          stroke="var(--accent)"
          fill="none"
          strokeWidth={sw}
          animate={isActive ? { r: [r, r + 3, r] } : { r }}
          transition={isActive ? loopTransition(1.8, delay) : { duration: 0.3 }}
        />
      ))}
    </motion.svg>
  ),
  jagged: (isActive) => (
    <motion.svg
      viewBox="0 0 60 60"
      className="absolute inset-0 w-full h-full"
      animate={{ opacity: isActive ? 0.45 : 0.20 }}
      transition={{ duration: 0.3 }}
    >
      {[
        { points: '0,30 10,15 20,40 30,10 40,45 50,20 60,35', sw: '0.5' },
        { points: '0,40 10,25 20,50 30,20 40,55 50,30 60,45', sw: '0.3' },
      ].map(({ points, sw }, i) => (
        <motion.polyline
          key={i}
          points={points}
          stroke="var(--accent)"
          fill="none"
          strokeWidth={sw}
          animate={isActive ? { translateY: [0, -2, 1, -1, 0] } : { translateY: 0 }}
          transition={isActive ? { ...loopTransition(0.3, i * 0.1), ease: 'linear' } : { duration: 0.3 }}
        />
      ))}
    </motion.svg>
  ),
  dots: (isActive) => {
    const coords = [15, 30, 45]
    let idx = 0
    return (
      <motion.svg
        viewBox="0 0 60 60"
        className="absolute inset-0 w-full h-full"
        animate={{ opacity: isActive ? 0.45 : 0.20 }}
        transition={{ duration: 0.3 }}
      >
        {coords.map(x =>
          coords.map(y => {
            const i = idx++
            return (
              <motion.circle
                key={`${x}-${y}`}
                cx={x}
                cy={y}
                r="1.5"
                fill="var(--accent)"
                animate={isActive ? { scale: [1, 1.5, 1] } : { scale: 1 }}
                transition={isActive ? loopTransition(1.2, i * 0.08) : { duration: 0.3 }}
              />
            )
          })
        )}
      </motion.svg>
    )
  },
  circle: (isActive) => (
    <motion.svg
      viewBox="0 0 60 60"
      className="absolute inset-0 w-full h-full"
      animate={{ opacity: isActive ? 0.45 : 0.20 }}
      transition={{ duration: 0.3 }}
    >
      {[
        { cx: 30, cy: 30, r: 20, sw: 0.5, dx: 0, dy: -2 },
        { cx: 25, cy: 28, r: 8, sw: 0.3, dx: 2, dy: 1 },
        { cx: 35, cy: 32, r: 6, sw: 0.3, dx: -1, dy: 2 },
      ].map(({ cx, cy, r, sw, dx, dy }, i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          stroke="var(--accent)"
          fill="none"
          strokeWidth={sw}
          animate={isActive
            ? { translateX: [0, dx, 0, -dx, 0], translateY: [0, dy, 0, -dy, 0] }
            : { translateX: 0, translateY: 0 }
          }
          transition={isActive ? loopTransition(2.5, i * 0.4) : { duration: 0.3 }}
        />
      ))}
    </motion.svg>
  ),
  grid: (isActive) => (
    <motion.svg
      viewBox="0 0 60 60"
      className="absolute inset-0 w-full h-full"
      animate={{ opacity: isActive ? 0.45 : 0.20 }}
      transition={{ duration: 0.3 }}
    >
      {[10, 20, 30, 40, 50].map((x, i) => (
        <motion.line
          key={`v${x}`}
          x1={x}
          y1="5"
          x2={x}
          y2="55"
          stroke="var(--accent)"
          strokeWidth="0.3"
          animate={isActive
            ? { opacity: [0.3, 0.8, 0.2, 0.6, 0.3] }
            : { opacity: 1 }
          }
          transition={isActive ? { ...loopTransition(0.8, i * 0.12), ease: 'linear' } : { duration: 0.3 }}
        />
      ))}
      {[10, 20, 30, 40, 50].map((y, i) => (
        <motion.line
          key={`h${y}`}
          x1="5"
          y1={y}
          x2="55"
          y2={y}
          stroke="var(--accent)"
          strokeWidth="0.3"
          animate={isActive
            ? { opacity: [0.2, 0.7, 0.4, 0.9, 0.2] }
            : { opacity: 1 }
          }
          transition={isActive ? { ...loopTransition(0.6, i * 0.15 + 0.3), ease: 'linear' } : { duration: 0.3 }}
        />
      ))}
    </motion.svg>
  ),
  lines: (isActive) => (
    <motion.svg
      viewBox="0 0 60 60"
      className="absolute inset-0 w-full h-full"
      animate={{ opacity: isActive ? 0.45 : 0.20 }}
      transition={{ duration: 0.3 }}
    >
      {[12, 20, 28, 36, 44, 52].map((y, i) => (
        <motion.line
          key={y}
          x1="10"
          y1={y}
          x2="50"
          y2={y}
          stroke="var(--accent)"
          strokeWidth={y % 16 === 4 ? '1' : '0.4'}
          animate={isActive
            ? { x1: [10, 7, 10], x2: [50, 53, 50] }
            : { x1: 10, x2: 50 }
          }
          transition={isActive ? loopTransition(1.5, i * 0.15) : { duration: 0.3 }}
        />
      ))}
    </motion.svg>
  ),
  noise: (isActive) => (
    <motion.svg
      viewBox="0 0 60 60"
      className="absolute inset-0 w-full h-full"
      animate={{ opacity: isActive ? 0.40 : 0.15 }}
      transition={{ duration: 0.3 }}
    >
      {NOISE_COORDS.map(({ cx, cy, r, opacity }, i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="var(--accent)"
          opacity={opacity}
          animate={isActive
            ? { cx: [cx, cx + 3, cx - 1, cx + 1, cx], cy: [cy, cy - 2, cy + 2, cy - 1, cy] }
            : { cx, cy }
          }
          transition={isActive ? loopTransition(2 + (i % 3) * 0.5, i * 0.1) : { duration: 0.3 }}
        />
      ))}
    </motion.svg>
  ),
}

const AnimatedPattern = memo(function AnimatedPattern({ pattern, isActive }) {
  return PATTERN_RENDERERS[pattern](isActive)
})

const getCardAnimation = (isActive, isSelected, isPlaying) => {
  if (isActive && isSelected) {
    return {
      scale: 1.02,
      y: -3,
      boxShadow: '0 6px 24px rgba(212,160,83,0.35), 0 0 16px rgba(212,160,83,0.15)',
      borderColor: 'rgba(212,160,83,1)',
    }
  }
  if (isActive) {
    return {
      scale: 1.04,
      y: -6,
      boxShadow: '0 8px 32px rgba(212,160,83,0.25), 0 0 12px rgba(212,160,83,0.10)',
      borderColor: 'rgba(212,160,83,0.6)',
    }
  }
  if (isSelected) {
    return {
      scale: 1,
      y: 0,
      boxShadow: '0 0 20px rgba(212,160,83,0.2)',
      borderColor: 'rgba(212,160,83,1)',
    }
  }
  if (isPlaying) {
    return {
      scale: 1.01,
      y: 0,
      boxShadow: 'none',
      borderColor: 'rgba(212,160,83,0.4)',
    }
  }
  return {
    scale: 1,
    y: 0,
    boxShadow: 'none',
    borderColor: 'rgba(90,90,101,0.2)',
  }
}

const cardSpring = { type: 'spring', stiffness: 400, damping: 25 }

export default function Textures({ onNext, avd, inputMode }) {
  const [showGuide, setShowGuide] = useState(true)
  const [selected, setSelected] = useState(() =>
    TEXTURE_DATA.reduce((acc, t) => ({ ...acc, [t.name]: false }), {})
  )
  const [listened, setListened] = useState(() => new Set())
  const [playing, setPlaying] = useState(null)
  const [hoveredCard, setHoveredCard] = useState(null)
  const [touchActive, setTouchActive] = useState(null)
  const dwellTimes = useRef({})
  const hoverTimer = useRef(null)
  const playingTimeout = useRef(null)
  const touchActiveTimer = useRef(null)
  const isMouse = inputMode === 'mouse'

  useEffect(() => {
    audioEngine.preloadTextures()
    return () => {
      audioEngine.stopTexture()
      clearTimeout(playingTimeout.current)
    }
  }, [])

  const selectedCount = Object.values(selected).filter(Boolean).length
  const canContinue = listened.size >= 3

  const playPreview = useCallback((textureName) => {
    if (playing === textureName) return
    // Accumulate dwell for the previously playing texture
    if (playing && dwellTimes.current[playing]?.start) {
      dwellTimes.current[playing].total += Date.now() - dwellTimes.current[playing].start
      dwellTimes.current[playing].start = null
    }
    audioEngine.playTexture(textureName, 30)
    setPlaying(textureName)
    dwellTimes.current[textureName] = { start: Date.now(), total: dwellTimes.current[textureName]?.total || 0 }
    setListened(prev => {
      const next = new Set(prev)
      next.add(textureName)
      return next
    })
    clearTimeout(playingTimeout.current)
    playingTimeout.current = setTimeout(() => setPlaying(p => p === textureName ? null : p), 30000)
  }, [playing])

  const stopPreview = useCallback(() => {
    if (playing && dwellTimes.current[playing]?.start) {
      dwellTimes.current[playing].total += Date.now() - dwellTimes.current[playing].start
      dwellTimes.current[playing].start = null
    }
    audioEngine.stopTexture()
    setPlaying(null)
    clearTimeout(playingTimeout.current)
  }, [playing])

  // Mouse: hover to preview (debounced), click to toggle select
  const handleMouseEnter = useCallback((textureName) => {
    setHoveredCard(textureName)
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => playPreview(textureName), 200)
  }, [playPreview])

  const handleMouseLeave = useCallback(() => {
    setHoveredCard(null)
    clearTimeout(hoverTimer.current)
    stopPreview()
  }, [stopPreview])

  const handleClick = useCallback((textureName) => {
    if (isMouse) {
      setSelected(prev => ({ ...prev, [textureName]: !prev[textureName] }))
    } else {
      // Touch: single tap toggles selection + plays preview
      playPreview(textureName)
      setSelected(prev => ({ ...prev, [textureName]: !prev[textureName] }))
    }
  }, [isMouse, playPreview])

  // Touch: pointer down activates visual, pointer up deactivates with linger
  const handlePointerDown = useCallback((textureName) => {
    if (isMouse) return
    clearTimeout(touchActiveTimer.current)
    setTouchActive(textureName)
  }, [isMouse])

  const handlePointerUp = useCallback(() => {
    if (isMouse) return
    clearTimeout(touchActiveTimer.current)
    touchActiveTimer.current = setTimeout(() => setTouchActive(null), 300)
  }, [isMouse])

  const handleContinue = useCallback(() => {
    audioEngine.stopAll()

    // Finalize any in-progress dwell tracking
    if (playing && dwellTimes.current[playing]?.start) {
      dwellTimes.current[playing].total += Date.now() - dwellTimes.current[playing].start
      dwellTimes.current[playing].start = null
    }

    const preferred = []
    const neutral = []

    TEXTURE_DATA.forEach(t => {
      if (selected[t.name]) {
        preferred.push(t.name)

        // Dwell-based commitment weight: longer listening = stronger signal
        // Normalize dwell: 2s = low confidence, 8s+ = full confidence
        const dwell = (dwellTimes.current[t.name]?.total || 0) / 1000
        const dwellWeight = Math.max(0.3, Math.min(1.0, dwell / 8))

        // Coordinate-based delta: move toward the clip's position
        const vDelta = (t.coord.v - 0.5) * dwellWeight
        const dDelta = (t.coord.d - 0.5) * dwellWeight
        const aDelta = (t.coord.a - 0.5) * dwellWeight * 0.5 // secondary contribution

        avd.updateValence(vDelta, 1.0)
        avd.updateDepth(dDelta, 1.0)
        avd.updateArousal(aDelta, 1.0)
      } else {
        neutral.push(t.name)
      }
    })

    avd.setPhaseData('textures', { preferred, rejected: [], neutral })
    onNext({ textures: { preferred, rejected: [], neutral } })
  }, [selected, avd, onNext, playing])

  return (
    <div className="h-full w-full flex flex-col select-none relative" style={{ touchAction: 'none' }}>
      <AnimatePresence>
        {showGuide && (
          <PhaseGuide
            phaseNumber="03"
            title="The Textures"
            body="Hover to preview sounds. Click to select. Choose at least 3."
            touchBody="Tap to preview and select sounds. Choose at least 3."
            onDismiss={() => setShowGuide(false)}
            inputMode={inputMode}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex justify-between items-center px-6 pt-6 sm:px-8 sm:pt-8">
        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          03 — THE TEXTURES
        </span>
        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          {selectedCount} selected
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-4 sm:grid-cols-4 sm:grid-rows-2 gap-3 p-4 sm:p-6">
        {TEXTURE_DATA.map((texture) => {
          const isSelected = selected[texture.name]
          const isPlaying = playing === texture.name
          const isCardActive = isMouse
            ? hoveredCard === texture.name
            : touchActive === texture.name

          return (
            <motion.div
              key={texture.name}
              className="relative rounded-lg flex flex-col items-center justify-center cursor-pointer overflow-hidden"
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid transparent',
                minHeight: 0,
              }}
              animate={getCardAnimation(isCardActive, isSelected, isPlaying)}
              transition={cardSpring}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleClick(texture.name)}
              onPointerDown={() => handlePointerDown(texture.name)}
              onPointerUp={handlePointerUp}
              onPointerCancel={isMouse ? undefined : handlePointerUp}
              onPointerLeave={isMouse ? handleMouseLeave : undefined}
              {...(isMouse ? {
                onMouseEnter: () => handleMouseEnter(texture.name),
              } : {})}
            >
              <AnimatedPattern pattern={texture.pattern} isActive={isCardActive} />
              <motion.span
                className="font-serif relative z-10"
                style={{ fontSize: 'clamp(14px, 3.5vw, 18px)' }}
                animate={{
                  color: isCardActive || isSelected ? '#D4A053' : '#E8E4DD',
                }}
                transition={{ duration: 0.3 }}
              >
                {texture.name}
              </motion.span>
              {isSelected && (
                <span className="font-mono relative z-10 mt-1"
                      style={{ fontSize: '8px', color: 'var(--accent)' }}>
                  selected
                </span>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Interaction hint */}
      <p className="text-center font-mono pb-1"
         style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
        {isMouse
          ? 'hover to preview \u00B7 click to select'
          : 'tap to select'}
      </p>

      {/* Continue button */}
      {canContinue && (
        <motion.div
          className="px-6 pb-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.button
            className="font-serif"
            style={{
              fontSize: '16px',
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '12px 24px',
              minHeight: '44px',
            }}
            whileTap={{ scale: 0.95 }}
            onClick={handleContinue}
          >
            continue
          </motion.button>
        </motion.div>
      )}
    </div>
  )
}
