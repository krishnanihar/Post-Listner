// src/phases/attunement/EraSearch.jsx
// The era beat — the one typed moment in Act 1. The listener searches for a song
// that matters to them (iTunes Search API, reused from the old Autobio phase);
// the track's release YEAR is the era, which picks which version within their
// faced world plays. A boundary object: anchor the read on a real song they
// bring, not an abstract scale. onPick(year) captures the era + advances;
// onSkip advances without one (falls back to the world's default variation).
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COLORS, FONTS, EASE } from '../../score/tokens'
import { NOCTURNE_ENABLED } from '../../world/flags.js'
import { searchTracks } from '../../lib/itunesSearch.js'
// Nocturne (canon §2) — hardcoded cream inks flip to light on the dark stage
// (matching phaseTheme's --ink); byte-identical when the flag is off. INK2 stays
// a hex string so the faint `${INK2}22` alpha-suffixed divider still works.
const INK = NOCTURNE_ENABLED ? '#E8E4DD' : '#1C1814'
const INK2 = NOCTURNE_ENABLED ? '#8A7556' : '#6B5840'

export default function EraSearch({ onPick, onSkip }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const inputRef = useRef(null)

  // Debounced iTunes search. All setState lives inside the timeout / promise
  // (never synchronously in the effect body) to satisfy react-hooks lint.
  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      searchTracks(query, ctrl.signal)
        .then((r) => setResults(r))
        .catch(() => { /* aborted or failed — leave prior results */ })
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [query])

  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    // A single settling fade as the beat crosses from moving the phone (face) to
    // typing (era) — the typed field eases in rather than snapping over the
    // gesture world, so the mode switch reads as one breath, not a cut.
    <motion.div
      style={overlay}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE.settle }}
    >
      <div style={prompt}>a song from a time that matters to you?</div>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search a song"
        style={input}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />

      <div style={resultsWrap}>
        <AnimatePresence initial={false}>
          {results.slice(0, 6).map((r) => (
            <motion.button
              key={r.id}
              type="button"
              onClick={() => onPick(r.year)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={resultRow}
            >
              <span style={resultText}>
                <span style={{ color: INK }}>{r.title}</span>
                <span style={{ color: INK2 }}> · {r.artist}</span>
              </span>
              {r.year && <span style={resultYear}>{r.year}</span>}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <button type="button" onClick={onSkip} style={skip}>
        or just begin
      </button>
    </motion.div>
  )
}

const overlay = {
  position: 'absolute', inset: 0, zIndex: 7, pointerEvents: 'auto',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'flex-start',
  paddingTop: 'calc(env(safe-area-inset-top, 0px) + 140px)',
  padding: 'calc(env(safe-area-inset-top, 0px) + 140px) 28px 0',
  gap: 22,
}
const prompt = {
  fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 19,
  color: 'var(--ink, currentColor)', textAlign: 'center', opacity: 0.9,
  maxWidth: 320,
}
const input = {
  width: '100%', maxWidth: 320,
  padding: '11px 14px',
  border: `1px solid ${INK2}`,
  background: 'transparent',
  color: INK,
  fontFamily: FONTS.serif, fontSize: 16,
  outline: 'none', borderRadius: 6, textAlign: 'center',
}
const resultsWrap = {
  width: '100%', maxWidth: 360,
  display: 'flex', flexDirection: 'column', gap: 2,
}
const resultRow = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 12, width: '100%',
  padding: '10px 12px',
  background: 'transparent', border: 'none', cursor: 'pointer',
  textAlign: 'left',
  borderBottom: `1px solid ${INK2}22`,
}
const resultText = {
  fontFamily: FONTS.serif, fontSize: 14, lineHeight: 1.3,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
}
const resultYear = {
  fontFamily: FONTS.mono, fontSize: 12, color: COLORS.scoreAmber, flex: '0 0 auto',
}
const skip = {
  marginTop: 8,
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontFamily: FONTS.serif, fontStyle: 'italic', fontSize: 13,
  color: INK2, opacity: 0.7,
}
