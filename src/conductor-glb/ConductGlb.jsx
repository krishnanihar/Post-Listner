/* /conduct-glb — experiment route.
 *
 * The conducting experience: cream parchment + ink trail + sacred
 * geometry watermark + ambient audio. All rendering is 2D canvas
 * inside ConductorCelestialField; no R3F.
 */
import { createContext, useContext } from 'react'
import { usePhoneConductor } from '../conductor-codex/usePhoneConductor'
import ConductorCelestialField from './ConductorCelestialField'
import '../conductor-codex/conduct-codex.css'

const PhoneContext = createContext(null)

function PhoneProvider({ children }) {
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
  return (
    <PhoneProvider>
      <main className="conduct-codex-shell">
        <ConductorCelestialField />
        <StatusPanel />
      </main>
    </PhoneProvider>
  )
}
