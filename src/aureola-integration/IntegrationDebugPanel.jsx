import { useCallback } from 'react'

const STYLES = {
  panel: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 240,
    background: 'rgba(0, 0, 0, 0.75)',
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
    marginBottom: 12,
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
    position: 'relative',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    transition: 'background 120ms ease',
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
  labelKey: {
    opacity: 0.6,
    marginRight: 6,
    letterSpacing: 0.5,
  },
}

function Toggle({ keyLabel, label, on, onChange, first }) {
  return (
    <div
      style={first ? { ...STYLES.row, ...STYLES.rowFirst } : STYLES.row}
      onClick={() => onChange(!on)}
    >
      <div style={on ? { ...STYLES.pill, ...STYLES.pillOn } : STYLES.pill}>
        <div style={on ? { ...STYLES.pillKnob, ...STYLES.pillKnobOn } : STYLES.pillKnob} />
      </div>
      <div style={STYLES.label}>
        <span style={STYLES.labelKey}>{keyLabel}</span>
        {label}
      </div>
    </div>
  )
}

export default function IntegrationDebugPanel({
  haloOn,
  grainOn,
  desatOn,
  hideEye,
  setHaloOn,
  setGrainOn,
  setDesatOn,
  setHideEye,
}) {
  const stop = useCallback((e) => e.stopPropagation(), [])

  return (
    <div style={STYLES.panel} onClick={stop}>
      <div style={STYLES.title}>integration • debug</div>
      <Toggle
        first
        keyLabel="A"
        label="Light-wrap halo"
        on={haloOn}
        onChange={setHaloOn}
      />
      <Toggle
        keyLabel="B"
        label="Grain overlay"
        on={grainOn}
        onChange={setGrainOn}
      />
      <Toggle
        keyLabel="C"
        label="Eye desaturation −30%"
        on={desatOn}
        onChange={setDesatOn}
      />
      <Toggle
        keyLabel="D"
        label="Hide Eye"
        on={hideEye}
        onChange={setHideEye}
      />
    </div>
  )
}
