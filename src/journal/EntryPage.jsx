import { useMemo } from 'react'
import { deriveHand } from '../lib/glyph.js'
import Glyph from './Glyph.jsx'
import { mulberry32 } from '../lib/mulberry32.js'

/**
 * EntryPage — the reading surface for one journal entry.
 *
 * Distinct from the 3D book (which is only the transition). A watercolour
 * cream wash, a hand-painted ink sigil, the date and the one-line summary.
 * The wash and sigil are seeded per entry so each page has its own pigment.
 * See docs/desktop-journal-design.md §5.
 */

const PAPER = '#F2EBD8'
const INK = '#1C1814'

const ROMAN = [
  '',
  'i',
  'ii',
  'iii',
  'iv',
  'v',
  'vi',
  'vii',
  'viii',
  'ix',
  'x',
  'xi',
  'xii',
]
const roman = (n) => ROMAN[n] || String(n)

/**
 * A per-entry watercolour wash: layered soft pigment pools over the cream —
 * deep sienna stains, luminous cream blooms, one muted dusty pool. Seeded
 * so each page keeps its own wash every time it is shown.
 */
function washBackground(seed) {
  const rand = mulberry32((seed + 7) * 2654435761)
  // kind: 'stain' deep warm, 'bloom' bright highlight, 'dust' muted cool
  const pool = (kind) => {
    const x = (18 + rand() * 64).toFixed(1)
    const y = (16 + rand() * 68).toFixed(1)
    const rx = (38 + rand() * 34).toFixed(1)
    const ry = (34 + rand() * 32).toFixed(1)
    let col
    if (kind === 'stain') {
      col = `rgba(${158 + Math.floor(rand() * 26)}, ${124 + Math.floor(rand() * 22)}, ${72 + Math.floor(rand() * 24)}, ${(0.2 + rand() * 0.14).toFixed(2)})`
    } else if (kind === 'bloom') {
      col = `rgba(252, 247, 231, ${(0.5 + rand() * 0.26).toFixed(2)})`
    } else {
      col = `rgba(150, 134, 138, ${(0.1 + rand() * 0.08).toFixed(2)})`
    }
    return `radial-gradient(ellipse ${rx}% ${ry}% at ${x}% ${y}%, ${col}, transparent 70%)`
  }
  return [
    pool('bloom'),
    pool('stain'),
    pool('bloom'),
    pool('stain'),
    pool('dust'),
    'radial-gradient(ellipse 92% 82% at 50% 44%, #F4EDDC, #E6D9B8)',
    PAPER,
  ].join(', ')
}

/** A hairline rule with a small centred diamond — a quiet section ornament. */
function Rule() {
  const line = {
    height: 1,
    width: 84,
    background:
      'linear-gradient(to right, transparent, rgba(28,24,20,0.32), transparent)',
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        margin: '26px 0',
      }}
    >
      <div style={line} />
      <div
        style={{
          width: 5,
          height: 5,
          transform: 'rotate(45deg)',
          background: 'rgba(28,24,20,0.42)',
        }}
      />
      <div style={line} />
    </div>
  )
}

export default function EntryPage({ entry, handStyle }) {
  const hand = useMemo(() => handStyle || deriveHand('default'), [handStyle])
  const wash = useMemo(() => (entry ? washBackground(entry.seq) : ''), [entry])
  if (!entry) return null
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: wash,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* deckle-edge warmth — a soft inset shadow drawing the eye inward */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          boxShadow: 'inset 0 0 160px rgba(70,52,28,0.22)',
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(70,52,28,0.18) 100%)',
        }}
      />
      <div style={{ textAlign: 'center', maxWidth: 600, padding: 48, position: 'relative' }}>
        <div
          style={{
            font: 'italic 15px Palatino, "Palatino Linotype", Georgia, serif',
            letterSpacing: '0.1em',
            color: 'rgba(28, 24, 20, 0.38)',
            marginBottom: 10,
          }}
        >
          {roman(entry.seq)}.
        </div>
        <div
          style={{
            font: '300 13px ui-monospace, SFMono-Regular, monospace',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(28, 24, 20, 0.5)',
          }}
        >
          {entry.date}
        </div>
        <Rule />
        <Glyph glyph={entry.glyph} seed={entry.seq} hand={hand} playing={false} />
        <div
          style={{
            font: 'italic 31px Palatino, "Palatino Linotype", Georgia, serif',
            color: INK,
            marginTop: 26,
            lineHeight: 1.52,
            textWrap: 'balance',
          }}
        >
          {entry.summary}
        </div>
        <div
          style={{
            marginTop: 30,
            font: '300 16px Palatino, Georgia, serif',
            color: 'rgba(28,24,20,0.3)',
            letterSpacing: '0.5em',
          }}
        >
          ❦
        </div>
      </div>
    </div>
  )
}
