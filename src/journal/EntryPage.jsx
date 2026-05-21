import { useEffect, useMemo, useRef } from 'react'

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

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

/**
 * Glyph — a hand-painted ink sigil. Each squiggle stroke is laid down in
 * three passes (a wide pale bleed, a mid body, a sharp core) so the edges
 * feather like wet pigment, over a couple of soft colour blooms.
 */
function Glyph({ seed }) {
  const ref = useRef(null)
  useEffect(() => {
    const W = 300
    const H = 190
    const c = ref.current
    const ctx = c.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = W * dpr
    c.height = H * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)
    const rand = mulberry32((seed + 1) * 2654435761)
    ctx.translate(W / 2, H / 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // soft pigment blooms behind the mark — warm, generous, diffuse so they
    // read as a wash halo rather than a smudge
    ctx.filter = 'blur(20px)'
    for (let i = 0; i < 3; i++) {
      const warm = rand() < 0.78
      ctx.fillStyle = warm
        ? `rgba(158, 104, 48, ${(0.11 + rand() * 0.08).toFixed(2)})`
        : `rgba(140, 96, 96, ${(0.07 + rand() * 0.05).toFixed(2)})`
      ctx.beginPath()
      ctx.arc((rand() - 0.5) * 120, (rand() - 0.5) * 70, 38 + rand() * 36, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.filter = 'none'

    // build the squiggle path once, then render it in feathered passes
    const pts = []
    let x = (rand() - 0.5) * 40
    let y = (rand() - 0.5) * 26
    const steps = 5 + Math.floor(rand() * 4)
    pts.push({ x, y })
    for (let i = 0; i < steps; i++) {
      const nx = (rand() - 0.5) * 190
      const ny = (rand() - 0.5) * 118
      const mx = (x + nx) / 2 + (rand() - 0.5) * 110
      const my = (y + ny) / 2 + (rand() - 0.5) * 110
      const w = 1.7 + rand() * 5.4
      pts.push({ x: nx, y: ny, mx, my, w })
      x = nx
      y = ny
    }

    const passes = [
      { blur: 4, mul: 2.7, alpha: 0.1, col: '74, 52, 28' }, // wet bleed
      { blur: 0, mul: 1.5, alpha: 0.24, col: '52, 38, 22' }, // body
      { blur: 0, mul: 1.0, alpha: 0.6, col: '32, 24, 16' }, // core
    ]
    for (const p of passes) {
      ctx.filter = p.blur ? `blur(${p.blur}px)` : 'none'
      ctx.strokeStyle = `rgba(${p.col}, ${p.alpha})`
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        ctx.beginPath()
        ctx.lineWidth = b.w * p.mul
        ctx.moveTo(a.x, a.y)
        ctx.quadraticCurveTo(b.mx, b.my, b.x, b.y)
        ctx.stroke()
      }
    }
    ctx.filter = 'none'

    // a few ink spatter flecks
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(40, 30, 18, ${(0.12 + rand() * 0.3).toFixed(2)})`
      ctx.beginPath()
      ctx.arc((rand() - 0.5) * 230, (rand() - 0.5) * 150, 0.6 + rand() * 2.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [seed])
  return <canvas ref={ref} style={{ width: 300, height: 190 }} />
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

export default function EntryPage({ entry }) {
  const wash = useMemo(() => (entry ? washBackground(entry.id) : ''), [entry])
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
          {roman(entry.id)}.
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
        <Glyph seed={entry.id} />
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
