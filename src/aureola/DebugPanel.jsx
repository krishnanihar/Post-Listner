import { useCallback } from 'react'
import { ARCHETYPE_COLORS, AUREOLA_V3 } from './config'

// The 10 archetypes the brief explicitly enumerates. (config also defines
// 'constellation' but it's not in this list — sprint-1 keeps the panel to
// exactly the requested buttons.)
const BUTTONS = [
  { id: 'eye',        label: 'Eye' },
  { id: 'hand_right', label: 'Hand R' },
  { id: 'hand_left',  label: 'Hand L' },
  { id: 'bird',       label: 'Bird' },
  { id: 'serpent',    label: 'Serpent' },
  { id: 'lotus',      label: 'Lotus' },
  { id: 'planet',     label: 'Planet' },
  { id: 'flame',      label: 'Flame' },
  { id: 'wing_pair',  label: 'Wing Pair' },
  { id: 'sigil',      label: 'Sigil' },
]

const STYLES = {
  panel: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 220,
    background: 'rgba(0, 0, 0, 0.72)',
    color: '#F2EBD8',
    padding: 14,
    borderRadius: 6,
    border: '1px solid rgba(212, 160, 83, 0.25)',
    fontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, monospace',
    fontSize: 11,
    zIndex: 100,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  },
  title: {
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.55,
    marginBottom: 10,
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#F2EBD8',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    padding: '7px 9px',
    marginBottom: 4,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 11,
    textAlign: 'left',
    borderRadius: 3,
  },
  swatch: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginRight: 8,
    flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.2)',
  },
  clearButton: {
    width: '100%',
    background: 'rgba(212, 80, 80, 0.18)',
    color: '#E8B0B0',
    border: '1px solid rgba(212, 80, 80, 0.45)',
    padding: '7px 9px',
    marginTop: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 11,
    borderRadius: 3,
    letterSpacing: 1,
    textTransform: 'lowercase',
  },
  readout: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: '1px solid rgba(255, 255, 255, 0.12)',
    fontSize: 10,
    lineHeight: 1.7,
    opacity: 0.88,
  },
  readoutRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  readoutKey: {
    opacity: 0.55,
    textTransform: 'lowercase',
    letterSpacing: 0.6,
  },
  warn: {
    color: '#E8B0B0',
  },
}

function fmt(n, places = 2) {
  if (!Number.isFinite(n)) return '–'
  return n.toFixed(places)
}

export default function DebugPanel({ onSummon, onClear, readout }) {
  // Stop click propagation so panel clicks don't bubble to canvas/wrap handlers.
  const stop = useCallback((e) => e.stopPropagation(), [])

  const overWeight = readout.totalWeight >= readout.figureWeight
  const imbalance = Math.sqrt(
    (readout.F_x ?? 0) ** 2 + (readout.F_y ?? 0) ** 2,
  )

  return (
    <div style={STYLES.panel} onClick={stop}>
      <div style={STYLES.title}>aureola • debug</div>

      {BUTTONS.map((b) => {
        const arch = AUREOLA_V3.archetypes[b.id]
        const hex = ARCHETYPE_COLORS[arch?.color] ?? '#888'
        return (
          <button
            key={b.id}
            type="button"
            style={STYLES.button}
            onClick={() => onSummon(b.id)}
          >
            <span style={{ ...STYLES.swatch, background: hex }} />
            {b.label}
          </button>
        )
      })}

      <button type="button" style={STYLES.clearButton} onClick={onClear}>
        clear
      </button>

      <div style={STYLES.readout}>
        <div style={STYLES.readoutRow}>
          <span style={STYLES.readoutKey}>active</span>
          <span>
            {readout.count} / {AUREOLA_V3.saturation.maxObjectsTotal}
          </span>
        </div>
        <div style={STYLES.readoutRow}>
          <span style={STYLES.readoutKey}>Σ W_i</span>
          <span style={overWeight ? STYLES.warn : undefined}>
            {fmt(readout.totalWeight)} / {fmt(readout.figureWeight)}
          </span>
        </div>
        <div style={STYLES.readoutRow}>
          <span style={STYLES.readoutKey}>F_x</span>
          <span>{fmt(readout.F_x, 3)}</span>
        </div>
        <div style={STYLES.readoutRow}>
          <span style={STYLES.readoutKey}>F_y</span>
          <span>{fmt(readout.F_y, 3)}</span>
        </div>
        <div style={STYLES.readoutRow}>
          <span style={STYLES.readoutKey}>imbalance</span>
          <span>{fmt(imbalance, 3)}</span>
        </div>
      </div>
    </div>
  )
}
