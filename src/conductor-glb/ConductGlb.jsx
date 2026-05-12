/* /conduct-glb — experiment route.
 *
 * The conducting experience: cream parchment + ink trail + sacred
 * geometry watermark + ambient audio. All rendering is 2D canvas
 * inside ConductorCelestialField; no R3F.
 */
import { createContext, useContext } from 'react'
import { usePhoneConductor } from '../conductor-codex/usePhoneConductor'
import ConductorCelestialField from './ConductorCelestialField'
import { useAmbientAudio } from './useAmbientAudio'
import '../conductor-codex/conduct-codex.css'

const AUDIO_SRC = '/music/hearth-keeper_acoustic-soft-2000s.mp3'

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

function BeginOverlay({ onBegin }) {
  return (
    <button
      type="button"
      onClick={onBegin}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(216,197,160,0.55)',
        backdropFilter: 'blur(2px)',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        fontFamily: "Georgia, 'Iowan Old Style', serif",
        color: '#3a2a14',
        cursor: 'pointer',
        zIndex: 50,
      }}
    >
      <span style={{
        fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
        opacity: 0.7,
      }}>tap anywhere</span>
      <span style={{ fontSize: 26, fontStyle: 'italic' }}>begin</span>
    </button>
  )
}

export default function ConductGlb() {
  const audio = useAmbientAudio({ src: AUDIO_SRC })

  return (
    <PhoneProvider>
      <main className="conduct-codex-shell">
        <ConductorCelestialField audio={audio} />
        <StatusPanel />
        {audio.needsGesture && <BeginOverlay onBegin={audio.tryStart} />}
      </main>
    </PhoneProvider>
  )
}
