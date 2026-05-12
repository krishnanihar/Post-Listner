/* /conduct-glb — experiment: take the real Rigify GLB humanoid from
 * /conduct, apply our /conduct-codex aesthetic (cream parchment + ink
 * silhouette + starfield shader + constellation overlay + back-view
 * camera + headphones / hair-tuft accessories tracking the head bone).
 *
 * Reuses:
 *   - usePhoneOrientation from ../conductor (drives IK)
 *   - armIK / gesturePose / idlePose / conductorAnatomy from ../conductor
 *   - starfieldMaterial + ConstellationOverlay from ../conductor-codex
 *   - conduct-codex.css for the cream parchment + foxing shell
 */
import { Suspense, createContext, useContext } from 'react'
import { usePhoneOrientation } from '../conductor/usePhoneOrientation'
import ConductorGlbScene from './ConductorGlbScene'
import ConstellationOverlay from '../conductor-codex/ConstellationOverlay'
import '../conductor-codex/conduct-codex.css'

const PhoneContext = createContext(null)

function PhoneProvider({ children }) {
  const phone = usePhoneOrientation()
  return <PhoneContext.Provider value={phone}>{children}</PhoneContext.Provider>
}

export function usePhone() {
  const ctx = useContext(PhoneContext)
  if (!ctx) throw new Error('usePhone must be used inside PhoneProvider')
  return ctx
}

function StatusPanel() {
  const phone = usePhone()
  const status = !phone.connected
    ? 'relay offline'
    : !phone.calibrated
      ? 'waiting for calibration'
      : 'conducting · live'
  const stateClass = phone.connected && phone.calibrated
    ? 'is-live'
    : phone.connected
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
  return (
    <PhoneProvider>
      <main className="conduct-codex-shell">
        <ConstellationOverlay />
        <Suspense fallback={null}>
          <ConductorGlbScene />
        </Suspense>
        <StatusPanel />
      </main>
    </PhoneProvider>
  )
}
