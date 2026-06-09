import { useCallback } from 'react'

const STYLES = {
  panel: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 260,
    background: 'rgba(0, 0, 0, 0.78)',
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
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 4px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  rowFirst: { borderTop: 'none' },
  pill: {
    flexShrink: 0,
    width: 38,
    height: 18,
    borderRadius: 9,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    position: 'relative',
  },
  pillOn: {
    background: 'rgba(212, 160, 83, 0.55)',
    border: '1px solid rgba(212, 160, 83, 0.8)',
  },
  pillKnob: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: '#F2EBD8',
    transition: 'left 120ms ease',
  },
  pillKnobOn: {
    left: 21,
  },
  label: {
    flex: 1,
    fontSize: 11,
    lineHeight: 1.4,
  },
  sliderRow: {
    padding: '8px 4px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  sliderLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    opacity: 0.75,
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  slider: {
    width: '100%',
    accentColor: '#D4A053',
  },
  readout: {
    marginTop: 10,
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
}

function Toggle({ label, on, onChange, first }) {
  return (
    <div
      style={first ? { ...STYLES.row, ...STYLES.rowFirst } : STYLES.row}
      onClick={() => onChange(!on)}
    >
      <div style={on ? { ...STYLES.pill, ...STYLES.pillOn } : STYLES.pill}>
        <div style={on ? { ...STYLES.pillKnob, ...STYLES.pillKnobOn } : STYLES.pillKnob} />
      </div>
      <div style={STYLES.label}>{label}</div>
    </div>
  )
}

function fmt(n, places = 2) {
  if (!Number.isFinite(n)) return '–'
  return n.toFixed(places)
}

export default function ThreePlaneDebugPanel({
  middleVisible,
  setMiddleVisible,
  backDepthOn,
  setBackDepthOn,
  frontVisible,
  setFrontVisible,
  middleZ,
  setMiddleZ,
  middleBaseRate,
  setMiddleBaseRate,
  gamma,
  beta,
  avdA,
  avdV,
  avdD,
  setAvdA,
  setAvdV,
  setAvdD,
}) {
  const stop = useCallback((e) => e.stopPropagation(), [])
  const tiltMag = Math.sqrt(gamma * gamma + beta * beta)

  return (
    <div style={STYLES.panel} onClick={stop}>
      <div style={STYLES.title}>three-plane • debug</div>

      <Toggle
        first
        label="Middle plane visible"
        on={middleVisible}
        onChange={setMiddleVisible}
      />
      <Toggle
        label="Back plane depth ON"
        on={backDepthOn}
        onChange={setBackDepthOn}
      />
      <Toggle
        label="Front plane visible"
        on={frontVisible}
        onChange={setFrontVisible}
      />

      <div style={STYLES.sliderRow}>
        <div style={STYLES.sliderLabel}>
          <span>Middle plane Z</span>
          <span>{fmt(middleZ)}</span>
        </div>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.05"
          value={middleZ}
          onChange={(e) => setMiddleZ(parseFloat(e.target.value))}
          style={STYLES.slider}
        />
      </div>

      <div style={STYLES.sliderRow}>
        <div style={STYLES.sliderLabel}>
          <span>Middle rotation rate</span>
          <span>{fmt(middleBaseRate, 3)} rad/s</span>
        </div>
        <input
          type="range"
          min="0"
          max="0.5"
          step="0.01"
          value={middleBaseRate}
          onChange={(e) => setMiddleBaseRate(parseFloat(e.target.value))}
          style={STYLES.slider}
        />
      </div>

      <div style={STYLES.sliderRow}>
        <div style={STYLES.sliderLabel}>
          <span>Arousal</span>
          <span>{fmt(avdA)}</span>
        </div>
        <input
          type="range" min="-1" max="1" step="0.05" value={avdA}
          onChange={(e) => setAvdA(parseFloat(e.target.value))}
          style={STYLES.slider}
        />
      </div>
      <div style={STYLES.sliderRow}>
        <div style={STYLES.sliderLabel}>
          <span>Valence</span>
          <span>{fmt(avdV)}</span>
        </div>
        <input
          type="range" min="-1" max="1" step="0.05" value={avdV}
          onChange={(e) => setAvdV(parseFloat(e.target.value))}
          style={STYLES.slider}
        />
      </div>
      <div style={STYLES.sliderRow}>
        <div style={STYLES.sliderLabel}>
          <span>Depth</span>
          <span>{fmt(avdD)}</span>
        </div>
        <input
          type="range" min="-1" max="1" step="0.05" value={avdD}
          onChange={(e) => setAvdD(parseFloat(e.target.value))}
          style={STYLES.slider}
        />
      </div>

      <div style={STYLES.readout}>
        <div style={STYLES.readoutRow}>
          <span style={STYLES.readoutKey}>gamma</span>
          <span>{fmt(gamma, 1)}°</span>
        </div>
        <div style={STYLES.readoutRow}>
          <span style={STYLES.readoutKey}>beta</span>
          <span>{fmt(beta, 1)}°</span>
        </div>
        <div style={STYLES.readoutRow}>
          <span style={STYLES.readoutKey}>tilt mag</span>
          <span>{fmt(tiltMag, 1)}°</span>
        </div>
      </div>
    </div>
  )
}
