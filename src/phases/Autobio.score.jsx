import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { searchTracks } from '../lib/itunesSearch'
import { summarizeAutobio } from '../lib/autobio'
import { useAdmirer } from '../hooks/useAdmirer'
import { ADMIRER_LINES } from '../lib/admirerScripts'

const PROMPTS = [
  { id: 'became_someone', text: 'A song from when you became someone.' },
  { id: 'one_person',     text: 'A song that belongs to one specific person.' },
  { id: 'first_yours',    text: 'The first song that felt like it was yours — not borrowed.' },
]

const SEARCH_DEBOUNCE_MS = 300

export default function Autobio({ onNext, avd }) {
  const [promptIdx, setPromptIdx] = useState(0)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const songsRef = useRef([])
  const debounceRef = useRef(null)
  const abortRef = useRef(null)

  const admirer = useAdmirer()

  useEffect(() => {
    admirer.play(ADMIRER_LINES.autobio.intro.text, ADMIRER_LINES.autobio.intro.register)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced iTunes search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    if (!query.trim()) {
      setResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const tracks = await searchTracks(query, controller.signal)
        // Only commit results if this controller is still the active one.
        if (abortRef.current === controller) setResults(tracks.slice(0, 5))
      } catch (e) {
        if (e.name !== 'AbortError' && abortRef.current === controller) setResults([])
      } finally {
        // Only clear the loading state if no fresher request has displaced
        // this one — otherwise we'd briefly flash the free-text fallback for
        // a query that's still pending.
        if (abortRef.current === controller) setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [query])

  const recordSong = useCallback((song) => {
    songsRef.current.push({
      ...song,
      prompt: PROMPTS[promptIdx].id,
    })
    setQuery('')
    setResults([])

    if (promptIdx + 1 >= PROMPTS.length) {
      // Summarize and advance
      const summary = summarizeAutobio(songsRef.current)
      avd.setPhaseData('autobio', summary)
      setTimeout(() => onNext({ autobio: summary }), 800)
    } else {
      setPromptIdx(promptIdx + 1)
    }
  }, [promptIdx, avd, onNext])

  const handleSelectResult = (track) => {
    recordSong({
      title: track.title,
      artist: track.artist,
      year: track.year,
    })
  }

  const handleSubmitFreeText = () => {
    const trimmed = query.trim()
    if (!trimmed) return
    recordSong({ title: trimmed, artist: '', year: null })
  }

  const currentPrompt = PROMPTS[promptIdx]

  return (
    <Paper variant="cream">
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 28px',
      }}>
        <motion.div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            color: COLORS.inkCreamSecondary,
            letterSpacing: '0.18em',
            marginBottom: 20,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 0.6 }}
        >
          vi. three songs you carry · {promptIdx + 1} / {PROMPTS.length}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentPrompt.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.5 }}
            style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 19,
              color: COLORS.inkCream,
              lineHeight: 1.5,
              marginBottom: 24,
            }}
          >
            {currentPrompt.text}
          </motion.div>
        </AnimatePresence>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitFreeText() }}
          placeholder="type a song or artist..."
          autoFocus
          style={{
            width: '100%',
            padding: '12px 16px',
            border: `1px solid ${COLORS.inkCreamSecondary}`,
            background: 'transparent',
            color: COLORS.inkCream,
            fontFamily: FONTS.serif,
            fontSize: 16,
            outline: 'none',
            borderRadius: 4,
            marginBottom: 12,
          }}
        />

        {/* Autocomplete results */}
        <div style={{ minHeight: 240 }}>
          {searching && (
            <div style={{
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontSize: 12,
              color: COLORS.inkCreamSecondary,
              padding: '8px 0',
            }}>
              searching...
            </div>
          )}
          {!searching && results.map((track) => (
            <button
              key={track.id}
              onClick={() => handleSelectResult(track)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${COLORS.inkCreamSecondary}33`,
                fontFamily: FONTS.serif,
                fontSize: 14,
                color: COLORS.inkCream,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontStyle: 'italic' }}>{track.title}</div>
              <div style={{ fontSize: 12, color: COLORS.inkCreamSecondary }}>
                {track.artist}{track.year ? ` · ${track.year}` : ''}
              </div>
            </button>
          ))}
          {!searching && query.trim() && results.length === 0 && (
            <button
              onClick={handleSubmitFreeText}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: 14,
                color: COLORS.scoreAmber,
                cursor: 'pointer',
              }}
            >
              keep "{query}" as your answer
            </button>
          )}
        </div>
      </div>
    </Paper>
  )
}
