import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Score from '../score/Score'
import { COLORS, FONTS } from '../score/tokens'
import { GEMS_TAGS, gemsExcerptsToAvdNudge } from '../lib/gemsTags'

const EXCERPTS = [
  { id: 'sublimity',  path: '/gems/sublimity.mp3',  durationMs: 15000 },
  { id: 'tenderness', path: '/gems/tenderness.mp3', durationMs: 15000 },
  { id: 'tension',    path: '/gems/tension.mp3',    durationMs: 15000 },
]

const TILE_FADE_MS = 6000

export default function Gems({ onNext, avd }) {
  const [excerptIdx, setExcerptIdx] = useState(0)
  const [stage, setStage] = useState('listening') // listening | tiles | done
  const [selectedTiles, setSelectedTiles] = useState(new Set())
  const [tilesVisible, setTilesVisible] = useState(false)

  const audioRef = useRef(null)
  const stageStartRef = useRef(Date.now())
  const resultsRef = useRef([])
  const advancedRef = useRef(false)

  // Refs to avoid stale closures inside the timeout
  const selectedTilesRef = useRef(new Set())
  useEffect(() => { selectedTilesRef.current = selectedTiles }, [selectedTiles])

  const recordSelection = useCallback((idx, tiles) => {
    const reactionMs = Date.now() - stageStartRef.current
    resultsRef.current.push({
      id: EXCERPTS[idx].id,
      tilesSelected: tiles,
      reactionMs,
    })
  }, [])

  const finishPhase = useCallback(() => {
    if (advancedRef.current) return
    advancedRef.current = true
    setStage('done')

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    avd.setPhaseData('gems', { excerpts: resultsRef.current })

    // Apply AVD nudge from selected tiles
    const nudge = gemsExcerptsToAvdNudge(resultsRef.current)
    avd.updateArousal(nudge.a, 1.0)
    avd.updateValence(nudge.v, 1.0)
    avd.updateDepth(nudge.d, 1.0)

    setTimeout(() => onNext({ gems: resultsRef.current }), 800)
  }, [avd, onNext])

  const playExcerpt = useCallback((idx) => {
    if (idx >= EXCERPTS.length) {
      finishPhase()
      return
    }
    setExcerptIdx(idx)
    setStage('listening')
    setSelectedTiles(new Set())
    setTilesVisible(false)
    stageStartRef.current = Date.now()

    // Start audio (fails silently if asset missing — placeholder paths)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    const audio = new Audio(EXCERPTS[idx].path)
    audio.volume = 0.7
    audioRef.current = audio
    audio.play().catch(() => { /* asset missing, continue */ })

    // After 15s, fade audio and show tiles
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setStage('tiles')
      setTilesVisible(true)
      stageStartRef.current = Date.now()

      // Tiles fade after 6s, then auto-advance
      setTimeout(() => {
        recordSelection(idx, Array.from(selectedTilesRef.current))
        playExcerpt(idx + 1)
      }, TILE_FADE_MS)
    }, EXCERPTS[idx].durationMs)
  }, [finishPhase, recordSelection]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    playExcerpt(0)
    return () => {
      if (audioRef.current) audioRef.current.pause()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTile = useCallback((id) => {
    setSelectedTiles(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id) else next.add(id)
      return next
    })
  }, [])

  return (
    <Score variant="cream" pageTitle="iv. tell me what you heard" pageNumber={`${excerptIdx + 1} / ${EXCERPTS.length}`}>
      {/* Listening stage */}
      <AnimatePresence>
        {stage === 'listening' && (
          <motion.foreignObject
            x="0" y="280" width="100%" height="80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div xmlns="http://www.w3.org/1999/xhtml" style={{
              width: '100%',
              textAlign: 'center',
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 14,
              color: COLORS.inkCreamSecondary,
            }}>
              listening...
            </div>
          </motion.foreignObject>
        )}
      </AnimatePresence>

      {/* Tiles stage — rendered as foreignObject for React HTML inside SVG */}
      {stage === 'tiles' && tilesVisible && (
        <foreignObject x="0" y="200" width="100%" height="320">
          <div xmlns="http://www.w3.org/1999/xhtml" style={{
            width: '100%',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'center',
            padding: '0 24px',
          }}>
            {GEMS_TAGS.map(tag => (
              <motion.button
                key={tag.id}
                onClick={() => toggleTile(tag.id)}
                style={{
                  background: selectedTiles.has(tag.id) ? COLORS.scoreAmber : 'transparent',
                  border: `1px solid ${selectedTiles.has(tag.id) ? COLORS.scoreAmber : COLORS.inkCreamSecondary}`,
                  color: selectedTiles.has(tag.id) ? COLORS.paperCream : COLORS.inkCream,
                  padding: '10px 18px',
                  borderRadius: 999,
                  fontFamily: FONTS.serif,
                  fontStyle: 'italic',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                whileTap={{ scale: 0.95 }}
              >
                {tag.label}
              </motion.button>
            ))}
          </div>
        </foreignObject>
      )}
    </Score>
  )
}
