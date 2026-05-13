import { useEffect } from 'react'
import ConductorScene from './ConductorScene'
import ConstellationOverlay from './ConstellationOverlay'
import { usePhoneConductor } from './usePhoneConductor'
import './conduct-codex.css'

function signed(value) {
  if (!Number.isFinite(value)) return '0.00'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function Meter({ label, value, bipolar = true }) {
  const normalized = bipolar ? (value + 1) / 2 : value
  return (
    <div className="conduct-codex-meter">
      <div className="conduct-codex-meter__label">
        <span>{label}</span>
        <span>{bipolar ? signed(value) : value.toFixed(2)}</span>
      </div>
      <div className={bipolar ? 'conduct-codex-meter__track is-bipolar' : 'conduct-codex-meter__track'}>
        <span style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, normalized))})` }} />
      </div>
    </div>
  )
}

export default function ConductCodex() {
  // Default session for the standalone /conduct-codex dev route. Real session
  // IDs are wired in via the QR pairing flow on the Stage route.
  const { stateRef, snapshot } = usePhoneConductor('DEV00000')
  const controls = snapshot.controls
  const signalAge = Number.isFinite(snapshot.lastMessageAgeMs)
    ? `${Math.round(snapshot.lastMessageAgeMs)}ms`
    : 'none'

  useEffect(() => {
    window.__conductCodexReady = false
    return () => {
      delete window.__conductCodexReady
      delete window.__conductCodexPose
    }
  }, [])

  return (
    <main className="conduct-codex-shell">
      <ConstellationOverlay />
      <ConductorScene stateRef={stateRef} />

      <section className="conduct-codex-panel conduct-codex-panel--status" aria-label="Conductor status">
        <div>
          <p className="conduct-codex-kicker">Codex Conductor</p>
          <h1>Conduct</h1>
        </div>
        <dl>
          <div>
            <dt>relay</dt>
            <dd className={snapshot.connected ? 'is-live' : 'is-waiting'}>{snapshot.status}</dd>
          </div>
          <div>
            <dt>signal</dt>
            <dd>{signalAge}</dd>
          </div>
          <div>
            <dt>messages</dt>
            <dd>{snapshot.messageCount}</dd>
          </div>
        </dl>
        {snapshot.lastError ? <p className="conduct-codex-error">{snapshot.lastError}</p> : null}
        <p className="conduct-codex-url">{import.meta.env.VITE_RELAY_URL || 'wss://localhost:8443'} · DEV00000</p>
      </section>

      <section className="conduct-codex-panel conduct-codex-panel--meters" aria-label="Gesture readings">
        <Meter label="forward" value={controls.pitch} />
        <Meter label="right" value={controls.roll} />
        <Meter label="yaw" value={controls.yaw} />
        <Meter label="energy" value={controls.energy} bipolar={false} />
        <Meter label="articulation" value={controls.articulation} bipolar={false} />
      </section>
    </main>
  )
}
