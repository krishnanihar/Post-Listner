import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { audioEngine } from '../engine/audio'

const TEXTURE_DATA = [
  { name: 'strings',     vDelta: 0.10, dDelta: 0.10, pattern: 'wavy' },
  { name: 'synthesizer', vDelta: -0.05, dDelta: 0.15, pattern: 'flow' },
  { name: 'distortion',  vDelta: -0.15, dDelta: -0.05, pattern: 'jagged' },
  { name: 'keys',        vDelta: 0.15, dDelta: 0.05, pattern: 'dots' },
  { name: 'voice',       vDelta: 0.05, dDelta: 0.20, pattern: 'circle' },
  { name: 'glitch',      vDelta: -0.10, dDelta: 0.10, pattern: 'grid' },
  { name: 'rhythm',      vDelta: 0.05, dDelta: -0.10, pattern: 'lines' },
  { name: 'field',       vDelta: -0.05, dDelta: 0.05, pattern: 'noise' },
]

const PATTERN_SVG = {
  wavy: (
    <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full opacity-20">
      {[15, 25, 35, 45].map(y => (
        <path key={y} d={`M0 ${y} Q15 ${y-5} 30 ${y} Q45 ${y+5} 60 ${y}`} stroke="var(--accent)" fill="none" strokeWidth="0.5"/>
      ))}
    </svg>
  ),
  flow: (
    <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full opacity-20">
      <circle cx="30" cy="30" r="8" stroke="var(--accent)" fill="none" strokeWidth="0.5"/>
      <circle cx="30" cy="30" r="15" stroke="var(--accent)" fill="none" strokeWidth="0.3"/>
      <circle cx="30" cy="30" r="22" stroke="var(--accent)" fill="none" strokeWidth="0.2"/>
    </svg>
  ),
  jagged: (
    <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full opacity-20">
      <polyline points="0,30 10,15 20,40 30,10 40,45 50,20 60,35" stroke="var(--accent)" fill="none" strokeWidth="0.5"/>
      <polyline points="0,40 10,25 20,50 30,20 40,55 50,30 60,45" stroke="var(--accent)" fill="none" strokeWidth="0.3"/>
    </svg>
  ),
  dots: (
    <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full opacity-20">
      {[15,30,45].map(x => [15,30,45].map(y => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="var(--accent)"/>
      )))}
    </svg>
  ),
  circle: (
    <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full opacity-20">
      <circle cx="30" cy="30" r="20" stroke="var(--accent)" fill="none" strokeWidth="0.5"/>
      <circle cx="25" cy="28" r="8" stroke="var(--accent)" fill="none" strokeWidth="0.3"/>
      <circle cx="35" cy="32" r="6" stroke="var(--accent)" fill="none" strokeWidth="0.3"/>
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full opacity-20">
      {[10,20,30,40,50].map(x => (
        <line key={`v${x}`} x1={x} y1="5" x2={x} y2="55" stroke="var(--accent)" strokeWidth="0.3"/>
      ))}
      {[10,20,30,40,50].map(y => (
        <line key={`h${y}`} x1="5" y1={y} x2="55" y2={y} stroke="var(--accent)" strokeWidth="0.3"/>
      ))}
    </svg>
  ),
  lines: (
    <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full opacity-20">
      {[12,20,28,36,44,52].map(y => (
        <line key={y} x1="10" y1={y} x2="50" y2={y} stroke="var(--accent)" strokeWidth={y % 16 === 4 ? '1' : '0.4'}/>
      ))}
    </svg>
  ),
  noise: (
    <svg viewBox="0 0 60 60" className="absolute inset-0 w-full h-full opacity-15">
      {Array.from({length: 20}, (_, i) => (
        <circle key={i} cx={10 + Math.random()*40} cy={10 + Math.random()*40} r={0.5 + Math.random()} fill="var(--accent)" opacity={0.3 + Math.random()*0.5}/>
      ))}
    </svg>
  ),
}

export default function Textures({ onNext, avd, inputMode }) {
  const [selected, setSelected] = useState(() =>
    TEXTURE_DATA.reduce((acc, t) => ({ ...acc, [t.name]: false }), {})
  )
  const [listened, setListened] = useState(() => new Set())
  const [playing, setPlaying] = useState(null)
  const hoverTimer = useRef(null)
  const playingTimeout = useRef(null)
  const isMouse = inputMode === 'mouse'

  const selectedCount = Object.values(selected).filter(Boolean).length
  const canContinue = listened.size >= 3

  const playPreview = useCallback((textureName) => {
    if (playing === textureName) return
    audioEngine.stopAll().then(() => {
      audioEngine.playTexture(textureName, 5)
      setPlaying(textureName)
      setListened(prev => {
        const next = new Set(prev)
        next.add(textureName)
        return next
      })
      clearTimeout(playingTimeout.current)
      playingTimeout.current = setTimeout(() => setPlaying(p => p === textureName ? null : p), 5000)
    })
  }, [playing])

  const stopPreview = useCallback(() => {
    audioEngine.stopAll()
    setPlaying(null)
    clearTimeout(playingTimeout.current)
  }, [])

  // Mouse: hover to preview (debounced), click to toggle select
  const handleMouseEnter = useCallback((textureName) => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => playPreview(textureName), 200)
  }, [playPreview])

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current)
    stopPreview()
  }, [stopPreview])

  const handleClick = useCallback((textureName) => {
    if (isMouse) {
      // Mouse: click toggles selection
      setSelected(prev => ({ ...prev, [textureName]: !prev[textureName] }))
    } else {
      // Touch: first tap plays preview, second tap toggles selection
      if (!listened.has(textureName) || playing !== textureName) {
        playPreview(textureName)
      } else {
        setSelected(prev => ({ ...prev, [textureName]: !prev[textureName] }))
      }
    }
  }, [isMouse, listened, playing, playPreview])

  const handleContinue = useCallback(() => {
    audioEngine.stopAll()

    const preferred = []
    const neutral = []

    TEXTURE_DATA.forEach(t => {
      if (selected[t.name]) {
        preferred.push(t.name)
        avd.updateValence(t.vDelta, 1.0)
        avd.updateDepth(t.dDelta, 1.0)
      } else {
        neutral.push(t.name)
      }
    })

    avd.setPhaseData('textures', { preferred, rejected: [], neutral })
    onNext({ textures: { preferred, rejected: [], neutral } })
  }, [selected, avd, onNext])

  return (
    <div className="h-full w-full flex flex-col select-none" style={{ touchAction: 'manipulation' }}>
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

          return (
            <motion.div
              key={texture.name}
              className="relative rounded-lg flex flex-col items-center justify-center cursor-pointer overflow-hidden"
              style={{
                background: 'var(--bg-subtle)',
                border: `1px solid ${
                  isSelected ? 'var(--accent)' :
                  isPlaying ? 'rgba(212, 160, 83, 0.4)' :
                  'rgba(90, 90, 101, 0.2)'
                }`,
                minHeight: 0,
              }}
              animate={{
                boxShadow: isSelected
                  ? '0 0 20px rgba(212, 160, 83, 0.2)'
                  : 'none',
                scale: isPlaying && !isSelected ? 1.01 : 1,
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleClick(texture.name)}
              {...(isMouse ? {
                onMouseEnter: () => handleMouseEnter(texture.name),
                onMouseLeave: handleMouseLeave,
              } : {})}
            >
              {PATTERN_SVG[texture.pattern]}
              <span
                className="font-serif relative z-10"
                style={{
                  fontSize: 'clamp(14px, 3.5vw, 18px)',
                  color: isSelected ? 'var(--accent)' : 'var(--text)',
                }}
              >
                {texture.name}
              </span>
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
         style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
        {isMouse
          ? 'hover to preview \u00B7 click to select'
          : 'tap to preview \u00B7 tap again to select'}
      </p>

      {/* Continue button */}
      {canContinue && (
        <motion.div
          className="px-6 pb-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <button
            className="font-serif"
            style={{
              fontSize: '16px',
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '12px 24px',
            }}
            onClick={handleContinue}
          >
            continue
          </button>
        </motion.div>
      )}
    </div>
  )
}
