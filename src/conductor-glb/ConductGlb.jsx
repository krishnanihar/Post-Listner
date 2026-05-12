/* /conduct-glb — experiment: take the real Rigify GLB humanoid from
 * /conduct, apply our /conduct-codex aesthetic + control pipeline.
 *
 * Phase 8 swap (this file): replaced the quaternion-based phone hook
 * from ../conductor with usePhoneConductor from ../conductor-codex,
 * which derives pitch/roll/yaw from raw alpha/beta/gamma Euler angles —
 * bypasses the portrait-calibration gimbal lock the original /conduct
 * hook suffered from.
 */
import { createContext, useContext, useRef } from 'react'
import { usePhoneConductor } from '../conductor-codex/usePhoneConductor'
import ConductorCelestialField from './ConductorCelestialField'
import SacredGeometryLayer from './SacredGeometryLayer'
import GhostConductorLayer from './GhostConductorLayer'
import '../conductor-codex/conduct-codex.css'

const PhoneContext = createContext(null)

function PhoneProvider({ children }) {
  // usePhoneConductor returns { stateRef, snapshot }.
  // - stateRef is the live ref read inside useFrame for immediate access.
  // - snapshot is the React-rendered version that triggers re-renders on
  //   throttled intervals; used by the UI panel.
  const phone = usePhoneConductor()
  return <PhoneContext.Provider value={phone}>{children}</PhoneContext.Provider>
}

export function usePhone() {
  const ctx = useContext(PhoneContext)
  if (!ctx) throw new Error('usePhone must be used inside PhoneProvider')
  return ctx
}

function StatusPanel() {
  const { snapshot } = usePhone()
  const status = !snapshot.connected
    ? 'relay offline'
    : !snapshot.calibrated
      ? 'waiting for calibration'
      : 'conducting · live'
  const stateClass = snapshot.connected && snapshot.calibrated
    ? 'is-live'
    : snapshot.connected
      ? 'is-waiting'
      : ''
  return (
    <section
      className="conduct-codex-panel conduct-codex-panel--status"
      aria-label="Conductor status"
    >
      <div>
        <p className="conduct-codex-kicker">GLB Conductor</p>
        <h1>Conduct</h1>
      </div>
      <dl>
        <div>
          <dt>relay</dt>
          <dd className={stateClass}>{status}</dd>
        </div>
        <div>
          <dt>route</dt>
          <dd>/conduct-glb</dd>
        </div>
      </dl>
    </section>
  )
}

export default function ConductGlb() {
  const trailTipRef = useRef({ x: 0, y: 0, active: false })

  return (
    <PhoneProvider>
      <main className="conduct-codex-shell">
        <SacredGeometryLayer trailTipRef={trailTipRef} />
        <ConductorCelestialField trailTipRef={trailTipRef} />
        <GhostConductorLayer />
        <StatusPanel />
      </main>
    </PhoneProvider>
  )
}
